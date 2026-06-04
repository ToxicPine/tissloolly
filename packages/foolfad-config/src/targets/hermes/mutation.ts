import type { CliIo } from "../../lib/out.ts";
import { err, ok, type Result } from "../../lib/result.ts";
import { type HermesInput, hermesInputToMutationShape } from "./arg-schema.ts";
import {
  type HermesArtifactFile,
  type MutationPayload,
  mutationSchema,
} from "./mutation-schema.ts";

export type MutationPlanningError =
  | {
    type: "missing-input";
    detail: unknown;
  }
  | {
    type: "invalid-mutation";
    detail: unknown;
  }
  | {
    type: "local-hermes-failed";
    detail: unknown;
  };

export default async function completeHermesInput(
  input: HermesInput,
  io: CliIo,
): Promise<Result<MutationPayload, MutationPlanningError>> {
  switch (input.type) {
    case "configure":
      return await completeConfigureInput(input, io);
  }
}

async function completeConfigureInput(
  input: Extract<HermesInput, { type: "configure" }>,
  io: CliIo,
): Promise<Result<MutationPayload, MutationPlanningError>> {
  if (input.configYamlFile || input.envFile || input.soulMdFile) {
    return parseMutation(() => hermesInputToMutationShape(input));
  }

  const artifact = await captureLocalHermesArtifact(io);
  if (!artifact.ok) {
    return artifact;
  }

  return parseMutation(() => ({
    type: "configure",
    files: artifact.value,
  }));
}

function parseMutation(
  shape: () => unknown,
): Result<MutationPayload, MutationPlanningError> {
  try {
    const payload = mutationSchema.safeParse(shape());
    if (!payload.success) {
      return err({
        type: "invalid-mutation",
        detail: payload.error.issues,
      });
    }

    return ok(payload.data);
  } catch (error) {
    return err({
      type: "missing-input",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

const encoder = new TextEncoder();

export async function captureLocalHermesArtifact(
  io: CliIo,
): Promise<Result<HermesArtifactFile[], MutationPlanningError>> {
  const scratchParent = await ensureScratchParent();
  if (!scratchParent.ok) {
    return scratchParent;
  }

  const scratch = await Deno.makeTempDir({
    dir: scratchParent.value,
    prefix: "hermes-",
  });
  const hermesHome = `${scratch}/hermes`;
  const home = `${scratch}/home`;

  await Deno.mkdir(hermesHome);
  await Deno.mkdir(home);

  try {
    io.stdout.writeSync(
      encoder.encode("Starting isolated `hermes setup`.\n"),
    );

    const setup = await runHermes(["setup"], hermesHome, home, "inherit");
    if (!setup.ok) {
      return setup;
    }

    return await readHermesArtifact(hermesHome);
  } finally {
    await Deno.remove(scratch, { recursive: true });
  }
}

async function readHermesArtifact(
  hermesHome: string,
): Promise<Result<HermesArtifactFile[], MutationPlanningError>> {
  const files: HermesArtifactFile[] = [];

  for (
    const path of ["config.yaml", ".env", "SOUL.md"] as HermesArtifactFile[
      "path"
    ][]
  ) {
    try {
      const content = await Deno.readTextFile(`${hermesHome}/${path}`);
      files.push({ path, content });
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        return err({
          type: "missing-input",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (!files.some((file) => file.path === "config.yaml" || file.path === ".env")) {
    return err({
      type: "missing-input",
      detail: "hermes setup did not produce config.yaml or .env",
    });
  }

  return ok(files);
}

async function ensureScratchParent(): Promise<
  Result<string, MutationPlanningError>
> {
  const home = Deno.env.get("HOME");
  if (!home) {
    return err({
      type: "local-hermes-failed",
      detail: "HOME is not set",
    });
  }

  const scratchParent = `${home}/.cache/foolfad-config`;
  try {
    await Deno.mkdir(scratchParent, { recursive: true });
    return ok(scratchParent);
  } catch (error) {
    return err({
      type: "local-hermes-failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runHermes(
  args: string[],
  hermesHome: string,
  home: string,
  stdio: "inherit" | "piped",
): Promise<Result<undefined, MutationPlanningError>> {
  try {
    const command = new Deno.Command("bash", {
      args: [
        "-c",
        `set -euo pipefail
for name in \${!HERMES_@}; do
  unset "$name"
done
export HOME="$1"
export HERMES_HOME="$2"
shift 2
exec hermes "$@"
`,
        "foolfad-config-hermes",
        home,
        hermesHome,
        ...args,
      ],
      env: {
        HOME: home,
        HERMES_HOME: hermesHome,
      },
      stdin: stdio === "inherit" ? "inherit" : "null",
      stdout: stdio,
      stderr: stdio,
    });

    const code = stdio === "inherit"
      ? (await command.spawn().status).code
      : (await command.output()).code;

    if (code === 0) {
      return ok(undefined);
    }

    return err({
      type: "local-hermes-failed",
      detail: `hermes ${args.join(" ")} exited with code ${code}`,
    });
  } catch (error) {
    return err({
      type: "local-hermes-failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

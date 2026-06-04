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
    case "auth":
      return await completeAuthInput(input, io);
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

async function completeAuthInput(
  input: Extract<HermesInput, { type: "auth" }>,
  io: CliIo,
): Promise<Result<MutationPayload, MutationPlanningError>> {
  if (input.authJsonFile) {
    return parseMutation(() => hermesInputToMutationShape(input));
  }

  const authJson = await captureLocalHermesAuthJson(input.provider, io);
  if (!authJson.ok) {
    return authJson;
  }

  return parseMutation(() => ({
    type: "configure",
    files: [
      {
        path: "auth.json",
        content: authJson.value,
      },
    ],
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
  await prepareIsolatedHome(home);

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

async function captureLocalHermesAuthJson(
  provider: string,
  io: CliIo,
): Promise<Result<string, MutationPlanningError>> {
  const scratchParent = await ensureScratchParent();
  if (!scratchParent.ok) {
    return scratchParent;
  }

  const scratch = await Deno.makeTempDir({
    dir: scratchParent.value,
    prefix: "hermes-auth-",
  });
  const hermesHome = `${scratch}/hermes`;
  const home = `${scratch}/home`;

  await Deno.mkdir(hermesHome);
  await Deno.mkdir(home);
  await prepareIsolatedHome(home);

  try {
    io.stdout.writeSync(
      encoder.encode(
        `Starting isolated \`hermes auth add ${provider} --type oauth\`.\n`,
      ),
    );

    const auth = await runHermes(
      ["auth", "add", provider, "--type", "oauth", "--no-browser"],
      hermesHome,
      home,
      "inherit",
    );
    if (!auth.ok) {
      return auth;
    }

    try {
      const content = await Deno.readTextFile(`${hermesHome}/auth.json`);
      JSON.parse(content);
      return ok(content);
    } catch (error) {
      return err({
        type: "missing-input",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
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

async function prepareIsolatedHome(home: string): Promise<void> {
  await Deno.mkdir(`${home}/.config`, { recursive: true });
  await Deno.mkdir(`${home}/.cache`, { recursive: true });
  await Deno.mkdir(`${home}/.local/share`, { recursive: true });
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
  const xdgConfigHome = `${home}/.config`;
  const xdgCacheHome = `${home}/.cache`;
  const xdgDataHome = `${home}/.local/share`;

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
export XDG_CONFIG_HOME="$3"
export XDG_CACHE_HOME="$4"
export XDG_DATA_HOME="$5"
shift 5
exec hermes "$@"
`,
        "foolfad-config-hermes",
        home,
        hermesHome,
        xdgConfigHome,
        xdgCacheHome,
        xdgDataHome,
        ...args,
      ],
      env: {
        HOME: home,
        HERMES_HOME: hermesHome,
        XDG_CONFIG_HOME: xdgConfigHome,
        XDG_CACHE_HOME: xdgCacheHome,
        XDG_DATA_HOME: xdgDataHome,
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

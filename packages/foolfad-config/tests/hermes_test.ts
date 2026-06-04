import completeHermesInput from "../src/targets/hermes/mutation.ts";
import { parseHermesInput, parseHermesMutationPayload } from "../src/targets/hermes/arg-schema.ts";
import { hermesStateSchema } from "../src/targets/hermes/state-schema.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`expected ${expectedJson}, got ${actualJson}`);
  }
}

async function writeExecutable(path: string, content: string): Promise<void> {
  await Deno.writeTextFile(path, content);
  await Deno.chmod(path, 0o755);
}

async function withEnv<T>(
  values: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(values)) {
    previous.set(key, Deno.env.get(key));
  }

  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

Deno.test("parseHermesMutationPayload reads explicit artifact files", async () => {
  const root = await Deno.makeTempDir();
  try {
    const configYaml = `${root}/config.yaml`;
    const envFile = `${root}/.env`;
    await Deno.writeTextFile(configYaml, "model:\n  provider: test\n");
    await Deno.writeTextFile(envFile, "OPENROUTER_API_KEY=test\n");

    const input = parseHermesInput("configure", [
      "--config-yaml-file",
      configYaml,
      "--env-file",
      envFile,
    ]);
    const payload = parseHermesMutationPayload(input);

    assertEquals(payload, {
      type: "configure",
      files: [
        {
          path: "config.yaml",
          content: "model:\n  provider: test\n",
        },
        {
          path: ".env",
          content: "OPENROUTER_API_KEY=test\n",
        },
      ],
    });
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("completeHermesInput runs setup under isolated HOME and HERMES_HOME", async () => {
  const root = await Deno.makeTempDir();
  try {
    const operatorHome = `${root}/operator`;
    const defaultHermesHome = `${operatorHome}/.hermes`;
    const fakeBin = `${root}/bin`;
    const envLog = `${root}/hermes-env.log`;

    await Deno.mkdir(defaultHermesHome, { recursive: true });
    await Deno.mkdir(fakeBin);
    await Deno.writeTextFile(
      `${defaultHermesHome}/config.yaml`,
      "model:\n  provider: leaked\n",
    );
    await writeExecutable(
      `${fakeBin}/hermes`,
      `#!/usr/bin/env bash
set -euo pipefail

if [[ "$1" != "setup" ]]; then
  exit 64
fi

{
  printf 'HOME=%s\\n' "$HOME"
  printf 'HERMES_HOME=%s\\n' "$HERMES_HOME"
  printf 'HERMES_MANAGED=%s\\n' "\${HERMES_MANAGED:-}"
} > "$FOOLFAD_HERMES_TEST_ENV_LOG"

if [[ "$HOME" == "$FOOLFAD_OPERATOR_HOME" ]]; then
  exit 65
fi

if [[ "$HERMES_HOME" == "$FOOLFAD_DEFAULT_HERMES_HOME" ]]; then
  exit 66
fi

if [[ -n "\${HERMES_MANAGED:-}" ]]; then
  exit 67
fi

mkdir -p "$HERMES_HOME"
printf 'model:\\n  provider: scratch\\n' > "$HERMES_HOME/config.yaml"
printf 'OPENROUTER_API_KEY=scratch\\n' > "$HERMES_HOME/.env"
printf 'scratch soul\\n' > "$HERMES_HOME/SOUL.md"
`,
    );

    const oldPath = Deno.env.get("PATH") ?? "";
    const payload = await withEnv(
      {
        PATH: `${fakeBin}:${oldPath}`,
        HOME: operatorHome,
        HERMES_HOME: defaultHermesHome,
        HERMES_MANAGED: "true",
        FOOLFAD_OPERATOR_HOME: operatorHome,
        FOOLFAD_DEFAULT_HERMES_HOME: defaultHermesHome,
        FOOLFAD_HERMES_TEST_ENV_LOG: envLog,
      },
      async () =>
        await completeHermesInput(
          { type: "configure" },
          {
            stdin: { read: () => Promise.resolve(null) },
            stdout: { writeSync: () => 0 },
            stderr: { writeSync: () => 0 },
          },
        ),
    );

    assert(payload.ok, JSON.stringify(payload));
    assertEquals(payload.value, {
      type: "configure",
      files: [
        {
          path: "config.yaml",
          content: "model:\n  provider: scratch\n",
        },
        {
          path: ".env",
          content: "OPENROUTER_API_KEY=scratch\n",
        },
        {
          path: "SOUL.md",
          content: "scratch soul\n",
        },
      ],
    });
    assertEquals(
      await Deno.readTextFile(`${defaultHermesHome}/config.yaml`),
      "model:\n  provider: leaked\n",
    );

    const env = await Deno.readTextFile(envLog);
    assert(!env.includes(`HOME=${operatorHome}\n`), env);
    assert(!env.includes(`HERMES_HOME=${defaultHermesHome}\n`), env);
    assert(env.includes("HERMES_MANAGED=\n"), env);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("Hermes MUTATE applies artifact files and returns state", async () => {
  const root = await Deno.makeTempDir();
  try {
    const script = await Deno.readTextFile(
      new URL("../src/targets/hermes/MUTATE.sh", import.meta.url),
    );
    const payload = JSON.stringify({
      type: "configure",
      files: [
        {
          path: "config.yaml",
          content: "model:\n  provider: remote\n",
        },
        {
          path: ".env",
          content: "OPENROUTER_API_KEY=remote\n",
        },
      ],
    });

    const command = new Deno.Command("bash", {
      args: ["-c", script],
      env: { HOME: root, HERMES_HOME: `${root}/.hermes` },
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });
    const child = command.spawn();
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(payload));
    await writer.close();
    const output = await child.output();

    assertEquals(output.code, 0);
    const state = hermesStateSchema.parse(
      JSON.parse(new TextDecoder().decode(output.stdout)),
    );
    assertEquals(state, {
      configured: true,
      hermesHome: `${root}/.hermes`,
      configYamlPresent: true,
      envFilePresent: true,
      soulMdPresent: false,
    });
    assertEquals(
      await Deno.readTextFile(`${root}/.hermes/config.yaml`),
      "model:\n  provider: remote\n",
    );
    assertEquals(
      await Deno.readTextFile(`${root}/.hermes/.env`),
      "OPENROUTER_API_KEY=remote\n",
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

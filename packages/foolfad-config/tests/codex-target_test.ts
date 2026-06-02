const main = new URL("../src/main.ts", import.meta.url).pathname;

Deno.test("codex target checks and configures through a tmp mock transport", async () => {
  const fixture = await createFixture();
  try {
    const before = await runCli(fixture, [
      "--json",
      "--transport",
      fixture.transport,
      "codex",
      "check",
    ]);
    assertEquals(before.code, 0, before.stderr);
    assertEquals(JSON.parse(before.stdout).state, {
      authenticated: false,
      codexHome: fixture.remoteCodexHome,
      authJsonPresent: false,
    });

    const authJson = `${fixture.root}/auth.json`;
    await Deno.writeTextFile(authJson, JSON.stringify({ tokens: { access_token: "fake-file" } }));

    const configured = await runCli(fixture, [
      "--json",
      "--transport",
      fixture.transport,
      "codex",
      "configure",
      "--auth-json-file",
      authJson,
    ]);
    assertEquals(configured.code, 0, configured.stderr);
    assertEquals(configured.stdout.includes("fake-file"), false);
    assertEquals(configured.stderr.includes("fake-file"), false);
    assertEquals(JSON.parse(configured.stdout).state, {
      authenticated: true,
      codexHome: fixture.remoteCodexHome,
      authJsonPresent: true,
      loginStatus: "Logged in using ChatGPT",
    });

    assertEquals(
      JSON.parse(await Deno.readTextFile(`${fixture.remoteCodexHome}/auth.json`)),
      { tokens: { access_token: "fake-file" } },
    );
  } finally {
    await Deno.remove(fixture.root, { recursive: true });
  }
});

Deno.test("codex configure captures local auth under isolated CODEX_HOME", async () => {
  const fixture = await createFixture();
  try {
    const configured = await runCli(fixture, [
      "--transport",
      fixture.transport,
      "codex",
      "configure",
    ]);
    assertEquals(configured.code, 0, configured.stderr || configured.stdout);
    assertEquals(configured.stdout.includes("fake-device"), false);
    assertEquals(configured.stderr.includes("fake-device"), false);

    assertEquals(
      JSON.parse(await Deno.readTextFile(`${fixture.remoteCodexHome}/auth.json`)),
      { tokens: { access_token: "fake-device" } },
    );

    const hostAuth = `${fixture.hostHome}/.codex/auth.json`;
    assertEquals(await exists(hostAuth), false);
    assertEquals(await exists(`${fixture.hostHome}/.cache/foolfad-config`), true);
  } finally {
    await Deno.remove(fixture.root, { recursive: true });
  }
});

Deno.test("codex json configure requires a complete auth artifact", async () => {
  const fixture = await createFixture();
  try {
    const configured = await runCli(fixture, [
      "--json",
      "--transport",
      fixture.transport,
      "codex",
      "configure",
    ]);

    assertEquals(configured.code, 2, configured.stderr || configured.stdout);
    assertEquals(await exists(`${fixture.hostHome}/.codex/auth.json`), false);
    assertEquals(await exists(`${fixture.remoteCodexHome}/auth.json`), false);
  } finally {
    await Deno.remove(fixture.root, { recursive: true });
  }
});

type Fixture = {
  root: string;
  fakeBin: string;
  hostHome: string;
  denoDir: string;
  remoteCodexHome: string;
  transport: string;
};

async function createFixture(): Promise<Fixture> {
  const root = await Deno.makeTempDir({ prefix: "foolfad-config-codex-test-" });
  const fakeBin = `${root}/bin`;
  const hostHome = `${root}/host-home`;
  const denoDir = Deno.env.get("DENO_DIR") ?? `${Deno.env.get("HOME")}/.cache/deno`;
  const remoteHome = `${root}/remote-home`;
  const remoteCodexHome = `${root}/remote-codex`;
  await Deno.mkdir(fakeBin);
  await Deno.mkdir(hostHome);
  await Deno.mkdir(remoteHome);

  const fakeCodex = `${fakeBin}/codex`;
  await Deno.writeTextFile(fakeCodex, fakeCodexScript);
  await Deno.chmod(fakeCodex, 0o755);

  const transportPath = `${root}/transport.sh`;
  await Deno.writeTextFile(
    transportPath,
    `#!/usr/bin/env bash
set -euo pipefail
script="${root}/remote-script.sh"
cat > "$script"
HOME=${shQuote(remoteHome)} CODEX_HOME=${shQuote(remoteCodexHome)} PATH=${
      shQuote(fakeBin)
    }:"$PATH" bash "$script"
`,
  );

  return {
    root,
    fakeBin,
    hostHome,
    denoDir,
    remoteCodexHome,
    transport: `bash ${shQuote(transportPath)}`,
  };
}

const fakeCodexScript = `#!/usr/bin/env bash
set -euo pipefail

case "\${1:-} \${2:-}" in
  "login --device-auth")
    mkdir -p "$CODEX_HOME"
    printf '{"tokens":{"access_token":"fake-device"}}\\n' > "$CODEX_HOME/auth.json"
    ;;
  "login status")
    if [[ -s "$CODEX_HOME/auth.json" ]]; then
      printf 'Logged in using ChatGPT\\n'
      exit 0
    fi
    printf 'Not logged in\\n'
    exit 1
    ;;
  *)
    printf 'unsupported fake codex command: %s\\n' "$*" >&2
    exit 2
    ;;
esac
`;

async function runCli(fixture: Fixture, args: string[]): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  const path = `${fixture.fakeBin}:${Deno.env.get("PATH") ?? ""}`;
  const output = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-run",
      "--allow-read",
      "--allow-write",
      "--allow-env=FOOLFAD_CONFIG_TRANSPORT,PATH,HOME",
      main,
      ...args,
    ],
    env: {
      PATH: path,
      HOME: fixture.hostHome,
      DENO_DIR: fixture.denoDir,
    },
    stdout: "piped",
    stderr: "piped",
  }).output();

  return {
    code: output.code,
    stdout: new TextDecoder().decode(output.stdout),
    stderr: new TextDecoder().decode(output.stderr),
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

function assertEquals(actual: unknown, expected: unknown, detail?: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${detail ? `${detail}\n` : ""}Expected ${JSON.stringify(expected)}, got ${
        JSON.stringify(actual)
      }`,
    );
  }
}

function shQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

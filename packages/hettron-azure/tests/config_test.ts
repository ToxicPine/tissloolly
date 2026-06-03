import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { show } from "../src/commands.ts";
import { parseCliArgs } from "../src/cli/args.ts";
import { resourceGroupForAccount } from "../src/domain/names.ts";
import { SecretSetInput, ShowOutput } from "../src/domain/types.ts";

const subscriptionId = "550e8400-e29b-41d4-a716-446655440000";

Deno.test("parseCliArgs parses set-secret flags in interactive mode", () => {
  assertEquals(
    parseCliArgs([
      "set-secret",
      "--name",
      "telegram-bot-token",
      "--value",
      "secret-value",
    ]),
    {
      ok: true,
      mode: "interactive",
      command: "set-secret",
      partialInput: {
        name: "telegram-bot-token",
        value: "secret-value",
      },
    },
  );
});

Deno.test("parseCliArgs parses set-secret account flags in json mode", () => {
  assertEquals(
    parseCliArgs([
      "--json",
      "set-secret",
      "--account-email",
      "user@example.com",
      "--subscription-id",
      subscriptionId,
      "--name",
      "telegram-users",
      "--value",
      "111111111",
    ]),
    {
      ok: true,
      mode: "json",
      command: "set-secret",
      partialInput: {
        accountEmail: "user@example.com",
        subscriptionId,
        name: "telegram-users",
        value: "111111111",
      },
    },
  );
});

Deno.test("SecretSetInput rejects invalid Azure secret names", () => {
  const base = {
    accountEmail: "user@example.com",
    subscriptionId,
    value: "secret-value",
  };

  assert(
    !SecretSetInput.safeParse({ ...base, name: "TELEGRAM_TOKEN" }).success,
  );
  assert(!SecretSetInput.safeParse({ ...base, name: "a".repeat(21) }).success);
});

Deno.test("parseCliArgs parses show in interactive and json modes", () => {
  assertEquals(parseCliArgs(["show"]), {
    ok: true,
    mode: "interactive",
    command: "show",
    partialInput: {},
  });
  assertEquals(parseCliArgs(["--json", "show"]), {
    ok: true,
    mode: "json",
    command: "show",
    partialInput: {},
  });
});

Deno.test("parseCliArgs rejects show flags", () => {
  assertEquals(parseCliArgs(["show", "--name", "hettron-v0"]), {
    ok: false,
    json: false,
    command: "show",
    message: "Unexpected flag: --name",
  });
});

Deno.test("ShowOutput parses setup states", () => {
  const accountEmail = "user@example.com";
  const resourceGroupName = "hettron-v0-abc123def456";
  const fqdn = "hettron-v0.example.azurecontainerapps.io";

  assert(ShowOutput.safeParse({ setupState: "no-account" }).success);
  assert(
    ShowOutput.safeParse({
      setupState: "account-selected",
      accountEmail,
    }).success,
  );
  assert(
    ShowOutput.safeParse({
      setupState: "subscription-selected",
      accountEmail,
      subscriptionId,
    }).success,
  );
  assert(
    ShowOutput.safeParse({
      setupState: "resource-group-exists",
      accountEmail,
      subscriptionId,
      resourceGroupName,
    }).success,
  );
  assert(
    ShowOutput.safeParse({
      setupState: "container-app-deployed",
      accountEmail,
      subscriptionId,
      resourceGroupName,
      containerAppName: "hettron-v0",
      fqdn,
    }).success,
  );
  assert(
    !("url" in ShowOutput.parse({
      setupState: "container-app-deployed",
      accountEmail,
      subscriptionId,
      resourceGroupName,
      containerAppName: "hettron-v0",
      fqdn,
      url: `https://${fqdn}`,
    })),
  );
});

Deno.test("show reports no-account when state is missing", async () => {
  await withHettronState(async () => {
    assertEquals(await show(undefined), {
      ok: true,
      value: { setupState: "no-account" },
    });
  });
});

Deno.test("show reports subscription-selected when resource group is missing", async () => {
  await withHettronState(async (home) => {
    const accountEmail = "user@example.com";
    await writeConfiguredState(home, accountEmail);
    const resourceGroupName = await resourceGroupForAccount(
      accountEmail,
      subscriptionId,
    );

    assertEquals(await show(undefined), {
      ok: true,
      value: {
        setupState: "subscription-selected",
        accountEmail,
        subscriptionId,
      },
    });
    assert(resourceGroupName.startsWith("hettron-v0-"));
  }, { groupExists: false });
});

Deno.test("show reports resource-group-exists when app is missing", async () => {
  await withHettronState(async (home) => {
    const accountEmail = "user@example.com";
    await writeConfiguredState(home, accountEmail);
    const resourceGroupName = await resourceGroupForAccount(
      accountEmail,
      subscriptionId,
    );

    assertEquals(await show(undefined), {
      ok: true,
      value: {
        setupState: "resource-group-exists",
        accountEmail,
        subscriptionId,
        resourceGroupName,
      },
    });
  }, { groupExists: true });
});

Deno.test("show reports container-app-deployed with fqdn", async () => {
  const fqdn = "hettron-v0.example.azurecontainerapps.io";
  await withHettronState(async (home) => {
    const accountEmail = "user@example.com";
    await writeConfiguredState(home, accountEmail);
    const resourceGroupName = await resourceGroupForAccount(
      accountEmail,
      subscriptionId,
    );

    assertEquals(await show(undefined), {
      ok: true,
      value: {
        setupState: "container-app-deployed",
        accountEmail,
        subscriptionId,
        resourceGroupName,
        containerAppName: "hettron-v0",
        fqdn,
      },
    });
  }, { groupExists: true, fqdn });
});

async function withHettronState(
  run: (home: string) => Promise<void>,
  fakeAzure: { groupExists?: boolean; fqdn?: string } = {},
): Promise<void> {
  const previousHome = Deno.env.get("HOME");
  const previousPath = Deno.env.get("PATH");
  const root = await Deno.makeTempDir();
  const home = join(root, "home");
  const bin = join(root, "bin");
  const groupExists = fakeAzure.groupExists ? "true" : "false";
  const fqdn = fakeAzure.fqdn;
  await Deno.mkdir(bin, { recursive: true });
  await Deno.writeTextFile(
    join(bin, "az"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1 $2" == "group exists" ]]; then
  printf '%s\\n' "${groupExists}"
  exit 0
fi
if [[ "$1 $2" == "containerapp show" ]]; then
  if [[ "${fqdn ? "true" : "false"}" != "true" ]]; then
    printf 'container app not found\\n' >&2
    exit 3
  fi
  printf '{"properties":{"configuration":{"ingress":{"fqdn":"%s"}}}}\\n' "${
      fqdn ?? ""
    }"
  exit 0
fi
printf 'unexpected az command: %s\\n' "$*" >&2
exit 99
`,
    { mode: 0o755 },
  );

  try {
    Deno.env.set("HOME", home);
    Deno.env.set("PATH", `${bin}:${previousPath ?? ""}`);
    await run(home);
  } finally {
    restoreEnv("HOME", previousHome);
    restoreEnv("PATH", previousPath);
    await Deno.remove(root, { recursive: true }).catch(() => {});
  }
}

async function writeConfiguredState(
  home: string,
  accountEmail: string,
): Promise<void> {
  const stateDir = join(home, ".hettron", "azure");
  await Deno.mkdir(stateDir, { recursive: true });
  await Deno.writeTextFile(
    join(stateDir, "account.json"),
    `${
      JSON.stringify(
        {
          version: 1,
          provider: "azure",
          stage: "configured",
          accountEmail,
          subscriptionId,
        },
        null,
        2,
      )
    }\n`,
  );
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    Deno.env.delete(name);
    return;
  }
  Deno.env.set(name, value);
}

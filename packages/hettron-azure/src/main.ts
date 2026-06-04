#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-net --allow-env
import { listAzureAccounts } from "./azure/account.ts";
import {
  AzMalformedOutputError,
  ConsoleError,
  runAzInteractive,
  runAzText,
} from "./azure/stdio.ts";
import { probeCachedAzureSubscriptions } from "./azure/subscription_probe.ts";
import { parseCliArgs, usage } from "./cli/args.ts";
import { type CommandError, commandError, Out } from "./cli/output.ts";
import {
  authenticateAccount,
  configureBilling,
  deploy,
  setSecret,
  show,
} from "./commands.ts";
import { readAccountArtifact, writeAccountArtifact } from "./domain/state.ts";
import {
  type AccountArtifact,
  AuthInput,
  BillingInput,
  type CommandName,
  DeployInput,
  SecretSetInput,
  type ShowOutput,
} from "./domain/types.ts";

const SUBSCRIPTION_SETUP_URL =
  "https://azure.microsoft.com/en-us/pricing/purchase-options/azure-account";

if (import.meta.main) {
  await main(Deno.args);
}

export async function main(argv: string[]): Promise<void> {
  const parsed = parseCliArgs(argv);
  const out = new Out(parsed.ok ? parsed.mode === "json" : parsed.json);

  if (!parsed.ok) {
    if (parsed.help) {
      out.stage({ ok: true, help: parsed.message });
      out.write(parsed.message);
      out.flush();
      return;
    }
    const error = commandError(
      parsed.message === usage ? "invalid-arguments" : "unknown-command",
      parsed.message,
    );
    renderFailure(out, parsed.command, error);
    Deno.exitCode = 2;
    return;
  }

  try {
    switch (parsed.command) {
      case "authenticate": {
        const input = parsed.mode === "json"
          ? await completeAuthenticateJson(
            await readJsonInputOrFlags(parsed.partialInput),
          )
          : await completeAuthenticateInteractive(parsed.partialInput, out);
        const result = await authenticateAccount(input);
        if (!result.ok) return renderFailure(out, parsed.command, result.error);
        await writeAccountArtifact({
          version: 1,
          provider: "azure",
          stage: "authenticated",
          accountEmail: input.accountEmail,
        });
        out.write(`Authenticated ${result.value.accountEmail}`);
        out.stage({ ok: true, command: parsed.command, data: result.value });
        out.flush();
        return;
      }
      case "configure-billing": {
        const input = parsed.mode === "json"
          ? await completeBillingJson(
            await readJsonInputOrFlags(parsed.partialInput),
          )
          : await completeBillingInteractive(parsed.partialInput, out);
        const result = await configureBilling(input);
        if (!result.ok) return renderFailure(out, parsed.command, result.error);
        await writeAccountArtifact({
          version: 1,
          provider: "azure",
          stage: "configured",
          accountEmail: input.accountEmail,
          subscriptionId: result.value.subscriptionId,
        });
        out.write(`Selected subscription ${result.value.subscriptionId}`);
        out.stage({ ok: true, command: parsed.command, data: result.value });
        out.flush();
        return;
      }
      case "deploy": {
        const input = parsed.mode === "json"
          ? await completeDeployJson(
            await readJsonInputOrFlags(parsed.partialInput),
          )
          : await completeDeployInteractive(parsed.partialInput);
        const result = await deploy(input);
        if (!result.ok) return renderFailure(out, parsed.command, result.error);
        out.write(`Deployed resource group ${result.value.resourceGroupName}`);
        out.stage({ ok: true, command: parsed.command, data: result.value });
        out.flush();
        return;
      }
      case "set-secret": {
        const input = parsed.mode === "json"
          ? await completeSecretSetJson(
            await readJsonInputOrFlags(parsed.partialInput),
          )
          : await completeSecretSetInteractive(parsed.partialInput);
        const result = await setSecret(input);
        if (!result.ok) return renderFailure(out, parsed.command, result.error);
        out.write(
          `Set secret ${result.value.name} on resource group ${result.value.resourceGroupName}`,
        );
        out.stage({ ok: true, command: parsed.command, data: result.value });
        out.flush();
        return;
      }
      case "show": {
        const result = await show(undefined);
        if (!result.ok) return renderFailure(out, parsed.command, result.error);
        renderShow(out, result.value);
        out.stage({ ok: true, command: parsed.command, data: result.value });
        out.flush();
        return;
      }
      default: {
        const _exhaustive: never = parsed;
        return _exhaustive;
      }
    }
  } catch (error) {
    renderFailure(out, parsed.command, mapError(error));
  }
}

function completeAuthenticateJson(input: unknown) {
  return AuthInput.parse(input);
}

async function completeAuthenticateInteractive(
  input: Partial<AuthInput>,
  _out: Out,
) {
  let accounts = await listAzureAccounts();
  if (accounts.length === 0) {
    try {
      await runAzText(
        ["config", "set", "core.login_experience_v2=off"],
        "none",
      );
      await runAzInteractive([
        "login",
        "--use-device-code",
        "--allow-no-subscriptions",
      ]);
    } catch (error) {
      if (error instanceof ConsoleError) {
        // Azure CLI can fail login after caching an ARM token, and its error output
        // does not reliably distinguish "no subscription" from other login failures.
        throw await mapFailedInteractiveLogin(error);
      }
      throw error;
    }
    accounts = await listAzureAccounts();
  }
  if (input.accountEmail) {
    return AuthInput.parse({ accountEmail: input.accountEmail });
  }
  const emails = [...new Set(accounts.map((account) => account.user.name))];
  if (emails.length === 1) {
    return AuthInput.parse({ accountEmail: emails[0] });
  }
  const accountEmail = terminalChoice(
    "Choose Azure account",
    emails,
    (email) => email,
  );
  return AuthInput.parse({ accountEmail });
}

async function mapFailedInteractiveLogin(
  error: ConsoleError,
): Promise<CommandError> {
  try {
    const probe = await probeCachedAzureSubscriptions();
    if (!probe.ok) {
      // unknown-error case: probe failed
      return commandError(
        "unknown-error",
        "Azure CLI login failed and Hettron could not verify Azure subscriptions from the token cache.",
        {
          loginCode: error.code,
          loginStderr: error.stderr.trim(),
          probeError: probe.error ?? "Unknown probe error",
        },
      );
    }
    if (probe.value.subscriptionCount === 0) {
      // no subscriptions case
      return commandError(
        "subscription-setup-required",
        "No enabled Azure subscription is visible.",
        {
          setupUrl: SUBSCRIPTION_SETUP_URL,
        },
      );
    }
    // generic error code case
    return commandError(
      "az-returned-error-code",
      "Azure CLI login failed after Hettron confirmed an Azure subscription is visible.",
      {
        code: error.code,
        stderr: error.stderr.trim(),
        tenantCount: probe.value.tenantCount,
        subscriptionCount: probe.value.subscriptionCount,
      },
    );
  } catch (probeError) {
    return commandError(
      "unknown-error",
      "Azure CLI login failed.",
      {
        loginCode: error.code,
        loginStderr: error.stderr.trim(),
        probeError: probeError instanceof Error
          ? { name: probeError.name, message: probeError.message }
          : String(probeError),
      },
    );
  }
}

async function completeBillingJson(input: unknown) {
  const partial = BillingInput.pick({ subscriptionId: true }).parse(input);
  const artifact = await readArtifact();
  return BillingInput.parse({
    accountEmail: artifact.accountEmail,
    subscriptionId: partial.subscriptionId,
  });
}

async function completeBillingInteractive(
  input: Partial<BillingInput>,
  out: Out,
) {
  const artifact = await readArtifact();
  const accounts = (await listAzureAccounts()).filter(
    (account) =>
      account.user.name === artifact.accountEmail &&
      account.state === "Enabled",
  );
  if (accounts.length === 0) {
    throw commandError(
      "subscription-setup-required",
      "No enabled Azure subscription is visible.",
      {
        setupUrl:
          "https://azure.microsoft.com/en-us/pricing/purchase-options/azure-account",
      },
    );
  }
  if (input.subscriptionId) {
    return BillingInput.parse({
      accountEmail: artifact.accountEmail,
      subscriptionId: input.subscriptionId,
    });
  }
  if (artifact.stage === "configured") {
    return BillingInput.parse({
      accountEmail: artifact.accountEmail,
      subscriptionId: artifact.subscriptionId,
    });
  }
  if (accounts.length === 1) {
    const subscription = accounts[0];
    out.write(`Using subscription ${subscription.name} (${subscription.id})`);
    return BillingInput.parse({
      accountEmail: artifact.accountEmail,
      subscriptionId: subscription.id,
    });
  }
  const subscriptionId = terminalChoice(
    "Choose Azure subscription",
    accounts.map((account) => account.id),
    (id) => {
      const account = accounts.find((candidate) => candidate.id === id)!;
      const tenant = account.tenantDisplayName ??
        account.tenantDefaultDomain ??
        account.tenantId;
      return `${account.name} (${account.id}) - ${tenant}`;
    },
  );
  return BillingInput.parse({
    accountEmail: artifact.accountEmail,
    subscriptionId,
  });
}

async function completeDeployJson(input: unknown) {
  const partial = DeployInput.partial().parse(input);
  if (partial.accountEmail || partial.subscriptionId) {
    return DeployInput.parse(partial);
  }
  const artifact = await readArtifact();
  if (artifact.stage !== "configured") {
    throw commandError(
      "invalid-account-state",
      "Run configure-billing before deploy.",
    );
  }
  return DeployInput.parse({
    accountEmail: partial.accountEmail ?? artifact.accountEmail,
    subscriptionId: partial.subscriptionId ?? artifact.subscriptionId,
    location: partial.location,
  });
}

async function completeDeployInteractive(input: Partial<DeployInput>) {
  const artifact = await readArtifact();
  if (artifact.stage !== "configured") {
    throw commandError(
      "invalid-account-state",
      "Run configure-billing before deploy.",
    );
  }
  return DeployInput.parse({
    accountEmail: artifact.accountEmail,
    subscriptionId: artifact.subscriptionId,
    location: input.location,
  });
}

async function completeSecretSetJson(input: unknown) {
  const partial = SecretSetInput.partial().parse(input);
  if (partial.accountEmail || partial.subscriptionId) {
    return SecretSetInput.parse(partial);
  }
  const artifact = await readArtifact();
  if (artifact.stage !== "configured") {
    throw commandError(
      "invalid-account-state",
      "Run configure-billing before set-secret.",
    );
  }
  return SecretSetInput.parse({
    accountEmail: artifact.accountEmail,
    subscriptionId: artifact.subscriptionId,
    name: partial.name,
    value: partial.value,
  });
}

async function completeSecretSetInteractive(input: Partial<SecretSetInput>) {
  const artifact = await readArtifact();
  if (artifact.stage !== "configured") {
    throw commandError(
      "invalid-account-state",
      "Run configure-billing before set-secret.",
    );
  }
  return SecretSetInput.parse({
    accountEmail: artifact.accountEmail,
    subscriptionId: artifact.subscriptionId,
    name: input.name,
    value: input.value,
  });
}

async function readArtifact(): Promise<AccountArtifact> {
  const result = await readAccountArtifact();
  if (result.ok) {
    return result.value;
  }
  if (result.error === "missing") {
    throw commandError(
      "invalid-account-state",
      "Run authenticate before continuing.",
    );
  }
  throw commandError(
    "invalid-account-state",
    "Hettron Azure account state is invalid.",
  );
}

async function readJsonInputOrFlags(flags: unknown): Promise<unknown> {
  const text = await readAllStdin();
  if (text.trim()) {
    return mergeJsonInput(JSON.parse(text), flags);
  }
  return flags;
}

function mergeJsonInput(json: unknown, flags: unknown): unknown {
  if (isRecord(json) && isRecord(flags)) {
    return { ...json, ...flags };
  }
  return json;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readAllStdin(): Promise<string> {
  if (Deno.stdin.isTerminal()) {
    return "";
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of Deno.stdin.readable) {
    chunks.push(chunk);
  }
  return new TextDecoder().decode(concat(chunks));
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function terminalChoice<T extends string>(
  label: string,
  choices: T[],
  render: (choice: T) => string,
): T {
  for (let index = 0; index < choices.length; index++) {
    console.error(`${index + 1}. ${render(choices[index])}`);
  }
  const answer = prompt(`${label}:`);
  const index = Number(answer) - 1;
  const choice = choices[index];
  if (!choice) {
    throw commandError("invalid-input", "Selection is invalid.");
  }
  return choice;
}

function renderShow(out: Out, output: ShowOutput): void {
  out.write(`Setup state: ${output.setupState}`);
  switch (output.setupState) {
    case "no-account":
      return;
    case "account-selected":
      out.write(`Account: ${output.accountEmail}`);
      return;
    case "subscription-selected":
      out.write(`Account: ${output.accountEmail}`);
      out.write(`Subscription: ${output.subscriptionId}`);
      return;
    case "resource-group-exists":
      out.write(`Account: ${output.accountEmail}`);
      out.write(`Subscription: ${output.subscriptionId}`);
      out.write(`Resource group: ${output.resourceGroupName}`);
      return;
    case "container-app-deployed":
      out.write(`Account: ${output.accountEmail}`);
      out.write(`Subscription: ${output.subscriptionId}`);
      out.write(`Resource group: ${output.resourceGroupName}`);
      out.write(`Container App: ${output.containerAppName}`);
      out.write(`FQDN: ${output.fqdn}`);
      out.write(`URL: https://${output.fqdn}`);
      return;
  }
}

function renderFailure(
  out: Out,
  command: CommandName | undefined,
  error: CommandError,
): void {
  out.stage(command ? { ok: false, command, error } : { ok: false, error });
  out.error(error.message);
  out.flush();
  Deno.exitCode = isCliBoundaryError(error) ? 2 : 1;
}

function isCliBoundaryError(error: CommandError): boolean {
  return (
    error.type === "invalid-arguments" ||
    error.type === "invalid-input" ||
    error.type === "unknown-command"
  );
}

function mapError(error: unknown): CommandError {
  if (isCommandError(error)) {
    return error;
  }
  if (error instanceof SyntaxError) {
    return commandError("invalid-input", error.message);
  }
  if (error instanceof ConsoleError) {
    return commandError(
      "az-returned-error-code",
      error.message.trim() || "Azure CLI command failed.",
      {
        code: error.code,
      },
    );
  }
  if (error instanceof AzMalformedOutputError) {
    return commandError("az-returned-malformed-output", error.message);
  }
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "ZodError"
  ) {
    return commandError("invalid-input", String(error));
  }
  if (error instanceof Error && error.name === "NotFound") {
    return commandError("az-not-found", "Azure CLI executable was not found.");
  }
  if (error instanceof Error) {
    return commandError("unknown-error", error.message);
  }
  return commandError("unknown-error", String(error));
}

function isCommandError(error: unknown): error is CommandError {
  return (
    !!error &&
    typeof error === "object" &&
    "type" in error &&
    "message" in error
  );
}

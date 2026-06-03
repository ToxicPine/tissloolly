import z from "zod";
import { findEnabledSubscription, listAzureAccounts } from "./azure/account.ts";
import { deployAzureResources } from "./azure/deploy.ts";
import { setContainerAppSecret } from "./azure/secrets.ts";
import { resourceGroupExists, showContainerAppFqdn } from "./azure/show.ts";
import {
  AzMalformedOutputError,
  ConsoleError,
  runWithAz,
} from "./azure/stdio.ts";
import { type CommandError, commandError } from "./cli/output.ts";
import type {
  AuthInput,
  AuthOutput,
  BillingInput,
  BillingOutput,
  DeployInput,
  DeployOutput,
  SecretSetInput,
  SecretSetOutput,
  ShowOutput,
} from "./domain/types.ts";
import { CONTAINER_APP_NAME, resourceGroupForAccount } from "./domain/names.ts";
import { readAccountArtifact } from "./domain/state.ts";
import { ok, type Result } from "./lib/result.ts";

const SUBSCRIPTION_SETUP_URL =
  "https://azure.microsoft.com/en-us/pricing/purchase-options/azure-account";

export type CommandRunner<Input, Output> = (
  input: Input,
) => Promise<Result<Output, CommandError>>;

export const authenticateAccount: CommandRunner<AuthInput, AuthOutput> = (
  input,
) =>
  runCore(async () => {
    const accounts = await listAzureAccounts();
    if (accounts.some((account) => account.user.name === input.accountEmail)) {
      return { accountEmail: input.accountEmail };
    }
    throw commandError(
      "not-authenticated",
      `Azure account ${input.accountEmail} is not authenticated in Hettron's Azure CLI config.`,
    );
  });

export const configureBilling: CommandRunner<BillingInput, BillingOutput> = (
  input,
) =>
  runCore(async () => {
    const accounts = await listAzureAccounts();
    const subscription = findEnabledSubscription(
      accounts,
      input.accountEmail,
      input.subscriptionId,
    );
    if (!subscription) {
      throw commandError(
        "subscription-setup-required",
        "No enabled Azure subscription is visible.",
        {
          setupUrl: SUBSCRIPTION_SETUP_URL,
        },
      );
    }
    await runWithAz(["account", "set", "--subscription", subscription.id]);
    return { subscriptionId: subscription.id };
  });

export const deploy: CommandRunner<DeployInput, DeployOutput> = (input) =>
  runCore(async () => {
    const accounts = await listAzureAccounts();
    const subscription = findEnabledSubscription(
      accounts,
      input.accountEmail,
      input.subscriptionId,
    );
    if (!subscription) {
      throw commandError(
        "subscription-setup-required",
        "No enabled Azure subscription is visible.",
        {
          setupUrl: SUBSCRIPTION_SETUP_URL,
        },
      );
    }

    return await deployAzureResources(input, subscription.tenantId);
  });

export const setSecret: CommandRunner<SecretSetInput, SecretSetOutput> = (
  input,
) =>
  runCore(async () => {
    const accounts = await listAzureAccounts();
    const subscription = findEnabledSubscription(
      accounts,
      input.accountEmail,
      input.subscriptionId,
    );
    if (!subscription) {
      throw commandError(
        "subscription-setup-required",
        "No enabled Azure subscription is visible.",
        {
          setupUrl: SUBSCRIPTION_SETUP_URL,
        },
      );
    }

    const resourceGroupName = await resourceGroupForAccount(
      input.accountEmail,
      subscription.id,
    );
    await setContainerAppSecret(
      subscription.id,
      resourceGroupName,
      input.name,
      input.value,
    );
    return { resourceGroupName, name: input.name };
  });

export const show: CommandRunner<void, ShowOutput> = () =>
  runCore(async () => {
    const artifactResult = await readAccountArtifact();
    if (!artifactResult.ok && artifactResult.error === "missing") {
      return { setupState: "no-account" };
    }
    if (!artifactResult.ok) {
      throw commandError(
        "invalid-account-state",
        "Hettron Azure account state is invalid.",
      );
    }

    const artifact = artifactResult.value;
    if (artifact.stage === "authenticated") {
      return {
        setupState: "account-selected",
        accountEmail: artifact.accountEmail,
      };
    }

    const resourceGroupName = await resourceGroupForAccount(
      artifact.accountEmail,
      artifact.subscriptionId,
    );
    if (
      !(await resourceGroupExists(artifact.subscriptionId, resourceGroupName))
    ) {
      return {
        setupState: "subscription-selected",
        accountEmail: artifact.accountEmail,
        subscriptionId: artifact.subscriptionId,
      };
    }

    const fqdn = await showContainerAppFqdn(
      artifact.subscriptionId,
      resourceGroupName,
    );
    if (!fqdn) {
      return {
        setupState: "resource-group-exists",
        accountEmail: artifact.accountEmail,
        subscriptionId: artifact.subscriptionId,
        resourceGroupName,
      };
    }

    return {
      setupState: "container-app-deployed",
      accountEmail: artifact.accountEmail,
      subscriptionId: artifact.subscriptionId,
      resourceGroupName,
      containerAppName: CONTAINER_APP_NAME,
      fqdn,
    };
  });

async function runCore<Output>(
  body: () => Promise<Output>,
): Promise<Result<Output, CommandError>> {
  try {
    return ok(await body());
  } catch (error) {
    return { ok: false, error: mapCoreError(error) };
  }
}

function mapCoreError(error: unknown): CommandError {
  if (isCommandError(error)) {
    return error;
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
  if (
    error instanceof AzMalformedOutputError ||
    error instanceof SyntaxError ||
    error instanceof z.ZodError
  ) {
    return commandError("az-returned-malformed-output", error.message);
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

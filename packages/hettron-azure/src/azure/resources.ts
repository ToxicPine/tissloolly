import z from "zod";
import { commandError } from "../cli/output.ts";
import {
  CONTAINER_APPS_ENVIRONMENT_NAME,
  FILE_SHARES,
  LOG_ANALYTICS_WORKSPACE_NAME,
  MANAGED_IDENTITY_NAME,
} from "../domain/names.ts";
import { runAzRaw, runAzText, runWithAz } from "./stdio.ts";

const ProviderState = z
  .object({ registrationState: z.string() })
  .transform((value) => value.registrationState);
const StorageNameAvailable = z
  .object({ nameAvailable: z.boolean() })
  .transform((value) => value.nameAvailable);
const EnvironmentDefaultDomain = z.string().min(1);
const REQUIRED_PROVIDERS = [
  "Microsoft.App",
  "Microsoft.OperationalInsights",
  "Microsoft.ManagedIdentity",
  "Microsoft.Storage",
] as const;

export async function selectSubscription(
  subscriptionId: string,
): Promise<void> {
  await runWithAz(["account", "set", "--subscription", subscriptionId]);
}

export async function ensureProviders(subscriptionId: string): Promise<void> {
  for (const namespace of REQUIRED_PROVIDERS) {
    const state = ProviderState.parse(
      await runWithAz([
        "provider",
        "show",
        "--subscription",
        subscriptionId,
        "--namespace",
        namespace,
        "--query",
        "{registrationState:registrationState}",
      ]),
    );
    if (state !== "Registered") {
      await runWithAz([
        "provider",
        "register",
        "--subscription",
        subscriptionId,
        "--namespace",
        namespace,
      ]);
    }
  }

  for (let attempt = 0; attempt < 24; attempt++) {
    const states = await Promise.all(
      REQUIRED_PROVIDERS.map((namespace) =>
        runWithAz([
          "provider",
          "show",
          "--subscription",
          subscriptionId,
          "--namespace",
          namespace,
          "--query",
          "{registrationState:registrationState}",
        ]).then((value) => ProviderState.parse(value)),
      ),
    );
    if (states.every((state) => state === "Registered")) {
      return;
    }
    await delay(5000);
  }

  throw commandError(
    "provider-registration-timeout",
    "Azure resource providers did not finish registering.",
  );
}

export async function ensureResourceGroup(
  subscriptionId: string,
  resourceGroupName: string,
  location: string,
): Promise<void> {
  await runWithAz([
    "group",
    "create",
    "--subscription",
    subscriptionId,
    "--name",
    resourceGroupName,
    "--location",
    location,
  ]);
}

export async function ensureStorageAccount(
  subscriptionId: string,
  resourceGroupName: string,
  storageAccountName: string,
  location: string,
): Promise<void> {
  await ensureStorageAccountNameAvailable(
    subscriptionId,
    resourceGroupName,
    storageAccountName,
  );
  await runWithAz([
    "storage",
    "account",
    "create",
    "--subscription",
    subscriptionId,
    "--resource-group",
    resourceGroupName,
    "--name",
    storageAccountName,
    "--location",
    location,
    "--sku",
    "Standard_LRS",
    "--kind",
    "StorageV2",
  ]);
}

export async function ensureFileShares(
  subscriptionId: string,
  resourceGroupName: string,
  storageAccountName: string,
): Promise<void> {
  for (const share of FILE_SHARES) {
    await runWithAz([
      "storage",
      "share-rm",
      "create",
      "--subscription",
      subscriptionId,
      "--resource-group",
      resourceGroupName,
      "--storage-account",
      storageAccountName,
      "--name",
      share,
      "--quota",
      "100",
    ]);
  }
}

export async function ensureManagedIdentity(
  subscriptionId: string,
  resourceGroupName: string,
  location: string,
): Promise<void> {
  await runWithAz([
    "identity",
    "create",
    "--subscription",
    subscriptionId,
    "--resource-group",
    resourceGroupName,
    "--name",
    MANAGED_IDENTITY_NAME,
    "--location",
    location,
  ]);
}

export async function ensureLogWorkspace(
  subscriptionId: string,
  resourceGroupName: string,
  location: string,
): Promise<void> {
  await runWithAz([
    "monitor",
    "log-analytics",
    "workspace",
    "create",
    "--subscription",
    subscriptionId,
    "--resource-group",
    resourceGroupName,
    "--workspace-name",
    LOG_ANALYTICS_WORKSPACE_NAME,
    "--location",
    location,
  ]);
}

export async function ensureContainerAppEnvironment(
  subscriptionId: string,
  resourceGroupName: string,
  location: string,
): Promise<void> {
  const workspaceCustomerId = await runAzText([
    "monitor",
    "log-analytics",
    "workspace",
    "show",
    "--subscription",
    subscriptionId,
    "--resource-group",
    resourceGroupName,
    "--workspace-name",
    LOG_ANALYTICS_WORKSPACE_NAME,
    "--query",
    "customerId",
  ]);
  const workspaceKey = await runAzText([
    "monitor",
    "log-analytics",
    "workspace",
    "get-shared-keys",
    "--subscription",
    subscriptionId,
    "--resource-group",
    resourceGroupName,
    "--workspace-name",
    LOG_ANALYTICS_WORKSPACE_NAME,
    "--query",
    "primarySharedKey",
  ]);

  await runWithAz([
    "containerapp",
    "env",
    "create",
    "--subscription",
    subscriptionId,
    "--resource-group",
    resourceGroupName,
    "--name",
    CONTAINER_APPS_ENVIRONMENT_NAME,
    "--location",
    location,
    "--logs-workspace-id",
    workspaceCustomerId,
    "--logs-workspace-key",
    workspaceKey,
  ]);
}

export async function configureEnvironmentStorage(
  subscriptionId: string,
  resourceGroupName: string,
  storageAccountName: string,
): Promise<void> {
  const storageAccountKey = await runAzText([
    "storage",
    "account",
    "keys",
    "list",
    "--subscription",
    subscriptionId,
    "--resource-group",
    resourceGroupName,
    "--account-name",
    storageAccountName,
    "--query",
    "[0].value",
  ]);
  for (const share of FILE_SHARES) {
    await runAzText(
      [
        "containerapp",
        "env",
        "storage",
        "set",
        "--subscription",
        subscriptionId,
        "--resource-group",
        resourceGroupName,
        "--name",
        CONTAINER_APPS_ENVIRONMENT_NAME,
        "--storage-name",
        share,
        "--access-mode",
        "ReadWrite",
        "--azure-file-account-name",
        storageAccountName,
        "--azure-file-account-key",
        storageAccountKey,
        "--azure-file-share-name",
        share,
      ],
      "none",
    );
  }
}

export async function getEnvironmentDefaultDomain(
  subscriptionId: string,
  resourceGroupName: string,
): Promise<string> {
  return EnvironmentDefaultDomain.parse(
    await runWithAz([
      "containerapp",
      "env",
      "show",
      "--subscription",
      subscriptionId,
      "--resource-group",
      resourceGroupName,
      "--name",
      CONTAINER_APPS_ENVIRONMENT_NAME,
      "--query",
      "properties.defaultDomain",
    ]),
  );
}

async function ensureStorageAccountNameAvailable(
  subscriptionId: string,
  resourceGroupName: string,
  storageAccountName: string,
): Promise<void> {
  const existing = await runAzRaw(
    [
      "storage",
      "account",
      "show",
      "--subscription",
      subscriptionId,
      "--resource-group",
      resourceGroupName,
      "--name",
      storageAccountName,
    ],
    { output: "json" },
  );
  if (existing.code === 0) {
    return;
  }

  const nameAvailable = StorageNameAvailable.parse(
    await runWithAz([
      "storage",
      "account",
      "check-name",
      "--name",
      storageAccountName,
    ]),
  );
  if (!nameAvailable) {
    throw commandError(
      "storage-account-name-unavailable",
      `Storage account name ${storageAccountName} is unavailable.`,
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

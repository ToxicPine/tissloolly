import z from "zod";
import { CONTAINER_APP_NAME, entraAppDisplayName } from "../domain/names.ts";
import type { DeployInput } from "../domain/types.ts";
import { signedInUser } from "./account.ts";
import { runAzRaw, runWithAz } from "./stdio.ts";

const AppCreate = z.object({ appId: z.uuid() });
const AppListItem = z.object({ appId: z.uuid() });
const CredentialReset = z.object({ password: z.string().min(1) });

export async function ensureEntraApp(
  input: DeployInput,
  fqdn: string,
): Promise<string> {
  const displayName = await entraAppDisplayName(
    input.accountEmail,
    input.subscriptionId,
  );
  const existing = z
    .array(AppListItem)
    .parse(
      await runWithAz(["ad", "app", "list", "--display-name", displayName]),
    );
  const appId =
    existing[0]?.appId ??
    AppCreate.parse(
      await runWithAz([
        "ad",
        "app",
        "create",
        "--display-name",
        displayName,
        "--sign-in-audience",
        "AzureADMyOrg",
      ]),
    ).appId;

  await runWithAz([
    "ad",
    "app",
    "update",
    "--id",
    appId,
    "--enable-id-token-issuance",
    "true",
    "--web-redirect-uris",
    `https://${fqdn}/.auth/login/aad/callback`,
  ]);
  await ensureServicePrincipal(appId);
  return appId;
}

export async function configureEasyAuth(
  subscriptionId: string,
  resourceGroupName: string,
  tenantId: string,
  appId: string,
): Promise<void> {
  const secret = CredentialReset.parse(
    await runWithAz([
      "ad",
      "app",
      "credential",
      "reset",
      "--id",
      appId,
      "--display-name",
      "hettron-v0-easyauth",
    ]),
  ).password;
  await runWithAz([
    "containerapp",
    "auth",
    "microsoft",
    "update",
    "--subscription",
    subscriptionId,
    "--resource-group",
    resourceGroupName,
    "--name",
    CONTAINER_APP_NAME,
    "--client-id",
    appId,
    "--client-secret",
    secret,
    "--tenant-id",
    tenantId,
    "--yes",
  ]);
  await runWithAz([
    "containerapp",
    "auth",
    "update",
    "--subscription",
    subscriptionId,
    "--resource-group",
    resourceGroupName,
    "--name",
    CONTAINER_APP_NAME,
    "--enabled",
    "true",
    "--unauthenticated-client-action",
    "RedirectToLoginPage",
    "--redirect-provider",
    "azureactivedirectory",
  ]);
}

export async function restrictEasyAuthToSignedInUser(
  subscriptionId: string,
  resourceGroupName: string,
): Promise<void> {
  const user = await signedInUser();
  const authConfigId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.App/containerApps/${CONTAINER_APP_NAME}/authConfigs/current`;
  await runWithAz([
    "resource",
    "update",
    "--ids",
    authConfigId,
    "--api-version",
    "2025-02-02-preview",
    "--set",
    `properties.identityProviders.azureActiveDirectory.validation=${JSON.stringify(
      {
        defaultAuthorizationPolicy: {
          allowedPrincipals: {
            identities: [user.id],
          },
        },
      },
    )}`,
  ]);
}

async function ensureServicePrincipal(appId: string): Promise<void> {
  const existing = await runAzRaw(["ad", "sp", "show", "--id", appId], {
    output: "json",
  });
  if (existing.code === 0) {
    return;
  }
  await runWithAz(["ad", "sp", "create", "--id", appId]);
}

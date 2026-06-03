import { commandError } from "../cli/output.ts";
import {
  CONTAINER_APP_NAME,
  CONTAINER_APPS_ENVIRONMENT_NAME,
  CONTAINER_IMAGE,
  CONTAINER_PORT,
  MANAGED_IDENTITY_NAME,
} from "../domain/names.ts";
import { runAzRaw, runAzText, runWithAz } from "./stdio.ts";

export async function createOrUpdateContainerApp(
  subscriptionId: string,
  resourceGroupName: string,
  location: string,
): Promise<void> {
  const yaml = containerAppYaml(subscriptionId, resourceGroupName, location);
  const path = await Deno.makeTempFile({
    prefix: "hettron-containerapp-",
    suffix: ".yaml",
  });
  try {
    await Deno.writeTextFile(path, yaml);
    const existing = await runAzRaw(
      [
        "containerapp",
        "show",
        "--subscription",
        subscriptionId,
        "--resource-group",
        resourceGroupName,
        "--name",
        CONTAINER_APP_NAME,
      ],
      { output: "json" },
    );
    const verb = existing.code === 0 ? "update" : "create";
    if (
      existing.code === 0 &&
      (await hasExternalIngress(subscriptionId, resourceGroupName))
    ) {
      await runWithAz([
        "containerapp",
        "ingress",
        "disable",
        "--subscription",
        subscriptionId,
        "--resource-group",
        resourceGroupName,
        "--name",
        CONTAINER_APP_NAME,
      ]);
    }
    await runWithAz([
      "containerapp",
      verb,
      "--subscription",
      subscriptionId,
      "--resource-group",
      resourceGroupName,
      "--name",
      CONTAINER_APP_NAME,
      "--yaml",
      path,
    ]);
  } finally {
    await Deno.remove(path).catch(() => {});
  }
}

export async function enableExternalIngress(
  subscriptionId: string,
  resourceGroupName: string,
): Promise<void> {
  await runWithAz([
    "containerapp",
    "ingress",
    "enable",
    "--subscription",
    subscriptionId,
    "--resource-group",
    resourceGroupName,
    "--name",
    CONTAINER_APP_NAME,
    "--type",
    "external",
    "--target-port",
    String(CONTAINER_PORT),
    "--transport",
    "auto",
    "--allow-insecure",
    "false",
  ]);
}

export async function probeAppAuth(fqdn: string): Promise<void> {
  await probeProtected(`https://${fqdn}/`);
  await probeLogin(`https://${fqdn}/.auth/login/aad`);
}

async function hasExternalIngress(
  subscriptionId: string,
  resourceGroupName: string,
): Promise<boolean> {
  const external = await runAzText([
    "containerapp",
    "show",
    "--subscription",
    subscriptionId,
    "--resource-group",
    resourceGroupName,
    "--name",
    CONTAINER_APP_NAME,
    "--query",
    "properties.configuration.ingress.external",
  ]);
  return external === "true";
}

function containerAppYaml(
  subscriptionId: string,
  resourceGroupName: string,
  location: string,
): string {
  const identityId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/${MANAGED_IDENTITY_NAME}`;
  return [
    `name: ${CONTAINER_APP_NAME}`,
    "type: Microsoft.App/containerApps",
    `location: ${location}`,
    "identity:",
    "  type: UserAssigned",
    "  userAssignedIdentities:",
    `    ${identityId}: {}`,
    "properties:",
    "  managedEnvironmentId: " +
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.App/managedEnvironments/${CONTAINER_APPS_ENVIRONMENT_NAME}`,
    "  configuration:",
    "    activeRevisionsMode: Single",
    "  template:",
    "    containers:",
    `      - name: ${CONTAINER_APP_NAME}`,
    `        image: ${CONTAINER_IMAGE}`,
    "        env:",
    "          - name: WEBHOOK_ENABLED",
    '            value: "true"',
    "          - name: WEBHOOK_PORT",
    '            value: "8644"',
    "        volumeMounts:",
    "          - volumeName: data",
    "            mountPath: /data",
    "          - volumeName: nix",
    "            mountPath: /nix",
    "    volumes:",
    "      - name: data",
    "        storageType: AzureFile",
    "        storageName: data",
    "      - name: nix",
    "        storageType: AzureFile",
    "        storageName: nix",
    "",
  ].join("\n");
}

async function probeProtected(url: string): Promise<void> {
  const response = await fetch(url, { redirect: "manual" });
  if (response.status >= 200 && response.status < 300) {
    throw commandError(
      "deployment-probe-failed",
      "Container App responded publicly after Easy Auth setup.",
      {
        url,
        status: response.status,
      },
    );
  }
}

async function probeLogin(url: string): Promise<void> {
  const response = await fetch(url, { redirect: "manual" });
  if (
    response.status < 300 ||
    response.status >= 400 ||
    !response.headers
      .get("location")
      ?.startsWith("https://login.microsoftonline.com/")
  ) {
    throw commandError(
      "deployment-probe-failed",
      "Container App Easy Auth login endpoint did not redirect to Microsoft login.",
      {
        url,
        status: response.status,
        location: response.headers.get("location"),
      },
    );
  }
}

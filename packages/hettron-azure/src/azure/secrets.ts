import { commandError } from "../cli/output.ts";
import { CONTAINER_APP_NAME } from "../domain/names.ts";
import { runAzRaw, runAzText } from "./stdio.ts";

export async function setContainerAppSecret(
  subscriptionId: string,
  resourceGroupName: string,
  name: string,
  value: string,
): Promise<void> {
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
  if (existing.code !== 0) {
    throw commandError(
      "invalid-account-state",
      "Run deploy before set-secret.",
    );
  }

  await runAzText(
    [
      "containerapp",
      "secret",
      "set",
      "--subscription",
      subscriptionId,
      "--resource-group",
      resourceGroupName,
      "--name",
      CONTAINER_APP_NAME,
      "--secrets",
      `${name}=${value}`,
    ],
    "none",
  );
}

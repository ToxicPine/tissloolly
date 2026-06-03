import z from "zod";
import { CONTAINER_APP_NAME } from "../domain/names.ts";
import { AzMalformedOutputError, runAzRaw, runAzText } from "./stdio.ts";

const ContainerAppFqdn = z
  .object({
    properties: z.object({
      configuration: z.object({
        ingress: z.object({
          fqdn: z.string().min(1).optional().nullable(),
        }).optional().nullable(),
      }).optional().nullable(),
    }).optional().nullable(),
  })
  .transform((value) =>
    value.properties?.configuration?.ingress?.fqdn ?? undefined
  );

export async function resourceGroupExists(
  subscriptionId: string,
  resourceGroupName: string,
): Promise<boolean> {
  const exists = await runAzText([
    "group",
    "exists",
    "--subscription",
    subscriptionId,
    "--name",
    resourceGroupName,
  ]);
  return exists === "true";
}

export async function showContainerAppFqdn(
  subscriptionId: string,
  resourceGroupName: string,
): Promise<string | undefined> {
  const result = await runAzRaw(
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
  if (result.code !== 0) {
    return undefined;
  }

  try {
    return ContainerAppFqdn.parse(JSON.parse(result.stdout));
  } catch (error) {
    throw new AzMalformedOutputError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

import z from "zod";
import { AccountEmail, SubscriptionId } from "./types.ts";

export const ProductSlug = z.literal("hettron-v0");
export type ProductSlug = z.infer<typeof ProductSlug>;

export const ResourceGroupName = z.string().regex(/^hettron-v0-[a-z0-9]{12}$/);
export type ResourceGroupName = z.infer<typeof ResourceGroupName>;

export const ContainerAppName = z.literal("hettron-v0");
export type ContainerAppName = z.infer<typeof ContainerAppName>;

export const ContainerAppsEnvironmentName = z.literal("hettron-v0-env");
export type ContainerAppsEnvironmentName = z.infer<
  typeof ContainerAppsEnvironmentName
>;

export const LogAnalyticsWorkspaceName = z.literal("hettron-v0-log");
export type LogAnalyticsWorkspaceName = z.infer<
  typeof LogAnalyticsWorkspaceName
>;

export const ManagedIdentityName = z.literal("hettron-v0-run");
export type ManagedIdentityName = z.infer<typeof ManagedIdentityName>;

export const StorageAccountName = z.string().regex(/^hettronv0[a-z0-9]{12}$/);
export type StorageAccountName = z.infer<typeof StorageAccountName>;

export const FileShareName = z.union([z.literal("data"), z.literal("nix")]);
export type FileShareName = z.infer<typeof FileShareName>;

export const PRODUCT_SLUG: ProductSlug = "hettron-v0";
export const CONTAINER_APP_NAME: ContainerAppName = "hettron-v0";
export const CONTAINER_APPS_ENVIRONMENT_NAME: ContainerAppsEnvironmentName =
  "hettron-v0-env";
export const LOG_ANALYTICS_WORKSPACE_NAME: LogAnalyticsWorkspaceName =
  "hettron-v0-log";
export const MANAGED_IDENTITY_NAME: ManagedIdentityName = "hettron-v0-run";
export const FILE_SHARES: readonly FileShareName[] = ["data", "nix"];

export const CONTAINER_IMAGE =
  "docker.io/cardellier/container-agent:latest-opinionated";
export const CONTAINER_PORT = 4096;
export const DEFAULT_LOCATION = "eastus";

export async function deploymentHash(
  accountEmail: string,
  subscriptionId: string,
): Promise<string> {
  const account = AccountEmail.parse(accountEmail);
  const subscription = SubscriptionId.parse(subscriptionId);
  const bytes = new TextEncoder().encode(`${account}${subscription}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return hex(digest).slice(0, 12);
}

export async function resourceGroupForAccount(
  accountEmail: string,
  subscriptionId: string,
): Promise<ResourceGroupName> {
  return ResourceGroupName.parse(
    `${PRODUCT_SLUG}-${await deploymentHash(accountEmail, subscriptionId)}`,
  );
}

export function storageAccountForResourceGroup(
  resourceGroupName: ResourceGroupName,
): StorageAccountName {
  return StorageAccountName.parse(
    resourceGroupName.replace("hettron-v0-", "hettronv0"),
  );
}

export async function entraAppDisplayName(
  accountEmail: string,
  subscriptionId: string,
): Promise<string> {
  return `Hettron v0 ${await deploymentHash(accountEmail, subscriptionId)}`;
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

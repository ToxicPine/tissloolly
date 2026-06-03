import z from "zod";
import {
  AccountEmail,
  AzureLocation,
  ContainerAppName,
  ResourceGroupName,
  SubscriptionId,
} from "./schemas.ts";

export {
  AccountEmail,
  AzureLocation,
  ContainerAppName,
  ResourceGroupName,
  SubscriptionId,
};

export const COMMANDS = [
  "authenticate",
  "configure-billing",
  "deploy",
  "set-secret",
  "show",
] as const;
export type CommandName = (typeof COMMANDS)[number];
const COMMAND_SET: ReadonlySet<string> = new Set(COMMANDS);

export function isCommand(value: unknown): value is CommandName {
  return typeof value === "string" && COMMAND_SET.has(value);
}

export const SecretName = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{0,19}$/);
export type SecretName = z.infer<typeof SecretName>;

export const AuthInput = z.object({
  accountEmail: AccountEmail,
});

export const AuthOutput = z.object({
  accountEmail: AccountEmail,
});

export const BillingInput = z.object({
  accountEmail: AccountEmail,
  subscriptionId: SubscriptionId,
});

export const BillingOutput = z.object({
  subscriptionId: SubscriptionId,
});

export const DeployInput = z.object({
  accountEmail: AccountEmail,
  subscriptionId: SubscriptionId,
  location: AzureLocation.optional(),
});

export const DeployOutput = z.object({
  resourceGroupName: z.string().regex(/^hettron-v0-[a-z0-9]{12}$/),
});

export const SecretSetInput = z.object({
  accountEmail: AccountEmail,
  subscriptionId: SubscriptionId,
  name: SecretName,
  value: z.string().min(1),
});

export const SecretSetOutput = z.object({
  resourceGroupName: ResourceGroupName,
  name: SecretName,
});

export const ShowOutput = z.discriminatedUnion("setupState", [
  z.object({
    setupState: z.literal("no-account"),
  }),
  z.object({
    setupState: z.literal("account-selected"),
    accountEmail: AccountEmail,
  }),
  z.object({
    setupState: z.literal("subscription-selected"),
    accountEmail: AccountEmail,
    subscriptionId: SubscriptionId,
  }),
  z.object({
    setupState: z.literal("resource-group-exists"),
    accountEmail: AccountEmail,
    subscriptionId: SubscriptionId,
    resourceGroupName: ResourceGroupName,
  }),
  z.object({
    setupState: z.literal("container-app-deployed"),
    accountEmail: AccountEmail,
    subscriptionId: SubscriptionId,
    resourceGroupName: ResourceGroupName,
    containerAppName: ContainerAppName,
    fqdn: z.string().min(1),
  }),
]);

export const AccountArtifact = z.discriminatedUnion("stage", [
  z.object({
    version: z.literal(1),
    provider: z.literal("azure"),
    stage: z.literal("authenticated"),
    accountEmail: AccountEmail,
  }),
  z.object({
    version: z.literal(1),
    provider: z.literal("azure"),
    stage: z.literal("configured"),
    accountEmail: AccountEmail,
    subscriptionId: SubscriptionId,
  }),
]);

export type AuthInput = z.infer<typeof AuthInput>;
export type AuthOutput = z.infer<typeof AuthOutput>;
export type BillingInput = z.infer<typeof BillingInput>;
export type BillingOutput = z.infer<typeof BillingOutput>;
export type DeployInput = z.infer<typeof DeployInput>;
export type DeployOutput = z.infer<typeof DeployOutput>;
export type SecretSetInput = z.infer<typeof SecretSetInput>;
export type SecretSetOutput = z.infer<typeof SecretSetOutput>;
export type ShowOutput = z.infer<typeof ShowOutput>;
export type AccountArtifact = z.infer<typeof AccountArtifact>;

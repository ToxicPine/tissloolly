import z from "zod";

export const COMMANDS = [
  "authenticate",
  "configure-billing",
  "deploy",
] as const;
export type CommandName = (typeof COMMANDS)[number];
const COMMAND_SET: ReadonlySet<string> = new Set(COMMANDS);

export function isCommand(value: unknown): value is CommandName {
  return typeof value === "string" && COMMAND_SET.has(value);
}

export const AccountEmail = z.string().trim().toLowerCase().min(1);
export type AccountEmail = z.infer<typeof AccountEmail>;

export const SubscriptionId = z.string().trim().toLowerCase().uuid();
export type SubscriptionId = z.infer<typeof SubscriptionId>;

export const AzureLocation = z.string().trim().min(1);
export type AzureLocation = z.infer<typeof AzureLocation>;

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
export type AccountArtifact = z.infer<typeof AccountArtifact>;

import z from "zod";

export const AccountEmail = z.string().trim().toLowerCase().min(1);
export type AccountEmail = z.infer<typeof AccountEmail>;

export const SubscriptionId = z.string().trim().toLowerCase().uuid();
export type SubscriptionId = z.infer<typeof SubscriptionId>;

export const AzureLocation = z.string().trim().min(1);
export type AzureLocation = z.infer<typeof AzureLocation>;

export const ResourceGroupName = z.string().regex(/^hettron-v0-[a-z0-9]{12}$/);
export type ResourceGroupName = z.infer<typeof ResourceGroupName>;

export const ContainerAppName = z.literal("hettron-v0");
export type ContainerAppName = z.infer<typeof ContainerAppName>;

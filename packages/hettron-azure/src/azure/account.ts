import z from "zod";
import { runWithAz } from "./stdio.ts";
import { AccountEmail, SubscriptionId } from "../domain/types.ts";

export const AzureAccount = z.object({
  id: SubscriptionId,
  name: z.string().min(1),
  state: z.string().min(1),
  tenantId: z.uuid(),
  tenantDisplayName: z.string().nullable().optional(),
  tenantDefaultDomain: z.string().nullable().optional(),
  user: z.object({
    name: AccountEmail,
  }),
});
export type AzureAccount = z.infer<typeof AzureAccount>;

export const SignedInUser = z.object({
  id: z.uuid(),
});
export type SignedInUser = z.infer<typeof SignedInUser>;

export async function listAzureAccounts(): Promise<AzureAccount[]> {
  return z.array(AzureAccount).parse(await runWithAz(["account", "list"]));
}

export function enabledAccountsForEmail(
  accounts: AzureAccount[],
  accountEmail: string,
): AzureAccount[] {
  const email = AccountEmail.parse(accountEmail);
  return accounts.filter(
    (account) => account.state === "Enabled" && account.user.name === email,
  );
}

export function findEnabledSubscription(
  accounts: AzureAccount[],
  accountEmail: string,
  subscriptionId: string,
): AzureAccount | undefined {
  const id = SubscriptionId.parse(subscriptionId);
  return enabledAccountsForEmail(accounts, accountEmail).find(
    (account) => account.id === id,
  );
}

export async function signedInUser(): Promise<SignedInUser> {
  return SignedInUser.parse(
    await runWithAz(["ad", "signed-in-user", "show", "--query", "{id:id}"]),
  );
}

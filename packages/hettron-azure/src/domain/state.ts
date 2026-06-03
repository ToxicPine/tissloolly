import { join } from "@std/path";
import { AccountArtifact } from "./types.ts";
import { hettronAzureStateDir } from "../azure/stdio.ts";
import { commandError } from "../cli/output.ts";

export function accountArtifactPath(): string {
  return join(hettronAzureStateDir(), "account.json");
}

export async function readAccountArtifact(): Promise<AccountArtifact> {
  try {
    const text = await Deno.readTextFile(accountArtifactPath());
    return AccountArtifact.parse(JSON.parse(text));
  } catch {
    throw commandError(
      "invalid-account-state",
      "Run authenticate before continuing.",
    );
  }
}

export async function writeAccountArtifact(
  artifact: AccountArtifact,
): Promise<void> {
  try {
    await Deno.mkdir(hettronAzureStateDir(), { recursive: true });
    await Deno.writeTextFile(
      accountArtifactPath(),
      `${JSON.stringify(artifact, null, 2)}\n`,
    );
  } catch {
    throw commandError("io-error", "Could not write Azure account state.");
  }
}

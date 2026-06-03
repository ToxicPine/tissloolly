import { join } from "@std/path";
import { AccountArtifact } from "./types.ts";
import { hettronAzureStateDir } from "../azure/stdio.ts";
import { commandError } from "../cli/output.ts";
import { err, ok, type Result } from "../lib/result.ts";

export function accountArtifactPath(): string {
  return join(hettronAzureStateDir(), "account.json");
}

export type AccountArtifactReadError = "missing" | "invalid";

export async function readAccountArtifact(): Promise<
  Result<AccountArtifact, AccountArtifactReadError>
> {
  try {
    const text = await Deno.readTextFile(accountArtifactPath());
    return ok(AccountArtifact.parse(JSON.parse(text)));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return err("missing");
    }
    return err("invalid");
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

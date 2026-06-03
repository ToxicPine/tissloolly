import { assert, assertEquals } from "@std/assert";
import { parseCliArgs } from "../src/cli/args.ts";
import { SecretSetInput } from "../src/domain/types.ts";

const subscriptionId = "550e8400-e29b-41d4-a716-446655440000";

Deno.test("parseCliArgs parses set-secret flags in interactive mode", () => {
  assertEquals(
    parseCliArgs([
      "set-secret",
      "--name",
      "telegram-bot-token",
      "--value",
      "secret-value",
    ]),
    {
      ok: true,
      mode: "interactive",
      command: "set-secret",
      partialInput: {
        name: "telegram-bot-token",
        value: "secret-value",
      },
    },
  );
});

Deno.test("parseCliArgs parses set-secret account flags in json mode", () => {
  assertEquals(
    parseCliArgs([
      "--json",
      "set-secret",
      "--account-email",
      "user@example.com",
      "--subscription-id",
      subscriptionId,
      "--name",
      "telegram-users",
      "--value",
      "111111111",
    ]),
    {
      ok: true,
      mode: "json",
      command: "set-secret",
      partialInput: {
        accountEmail: "user@example.com",
        subscriptionId,
        name: "telegram-users",
        value: "111111111",
      },
    },
  );
});

Deno.test("SecretSetInput rejects invalid Azure secret names", () => {
  const base = {
    accountEmail: "user@example.com",
    subscriptionId,
    value: "secret-value",
  };

  assert(
    !SecretSetInput.safeParse({ ...base, name: "TELEGRAM_TOKEN" }).success,
  );
  assert(!SecretSetInput.safeParse({ ...base, name: "a".repeat(21) }).success);
});

import { parseArgs } from "@std/cli/parse-args";
import {
  type AuthInput,
  AuthInput as AuthInputSchema,
  type BillingInput,
  BillingInput as BillingInputSchema,
  type CommandName,
  type DeployInput,
  DeployInput as DeployInputSchema,
  isCommand,
} from "../domain/types.ts";

export const usage = `Usage: hettron-azure [--json] COMMAND [FLAGS]

Manage the Hettron self-hosted Azure Container Apps deployment.

Commands:
  authenticate        Select an Azure account.
  configure-billing   Select and validate an Azure subscription.
  deploy              Deploy the Hettron artifacts to Azure Container Apps.
`;

export type CliMode = "interactive" | "json";

export type ParsedCli =
  | {
      ok: true;
      mode: CliMode;
      command: "authenticate";
      partialInput: Partial<AuthInput>;
    }
  | {
      ok: true;
      mode: CliMode;
      command: "configure-billing";
      partialInput: Partial<BillingInput>;
    }
  | {
      ok: true;
      mode: CliMode;
      command: "deploy";
      partialInput: Partial<DeployInput>;
    }
  | {
      ok: false;
      json: boolean;
      message: string;
      command?: CommandName;
      help?: boolean;
    };

export function parseCliArgs(argv: string[]): ParsedCli {
  const parsed = parseArgs(argv, {
    boolean: ["json", "help"],
    string: ["account-email", "subscription-id", "location"],
    alias: { h: "help" },
    "--": false,
  });
  const json = Boolean(parsed.json);

  if (parsed.help) {
    return { ok: false, json, message: usage, help: true };
  }

  const command = parsed._[0];
  if (!isCommand(command)) {
    return {
      ok: false,
      json,
      message: command === undefined ? usage : `Unknown command: ${command}`,
    };
  }
  if (parsed._.length > 1) {
    return {
      ok: false,
      json,
      command,
      message: `Unexpected argument: ${parsed._[1]}`,
    };
  }

  const mode: CliMode = json ? "json" : "interactive";
  const invalidFlag = firstInvalidFlag(parsed, allowedFlags(command, mode));
  if (invalidFlag) {
    return {
      ok: false,
      json,
      command,
      message: `Unexpected flag: --${invalidFlag}`,
    };
  }
  const raw = compact({
    accountEmail: parsed["account-email"],
    subscriptionId: parsed["subscription-id"],
    location: parsed.location,
  });

  switch (command) {
    case "authenticate": {
      const input = AuthInputSchema.partial().safeParse(raw);
      return input.success
        ? { ok: true, mode, command, partialInput: input.data }
        : { ok: false, json, command, message: input.error.message };
    }
    case "configure-billing": {
      const input = BillingInputSchema.partial().safeParse(raw);
      return input.success
        ? { ok: true, mode, command, partialInput: input.data }
        : { ok: false, json, command, message: input.error.message };
    }
    case "deploy": {
      const input = DeployInputSchema.partial().safeParse(raw);
      return input.success
        ? { ok: true, mode, command, partialInput: input.data }
        : { ok: false, json, command, message: input.error.message };
    }
  }
}

function allowedFlags(command: CommandName, mode: CliMode): Set<string> {
  return new Set([...GLOBAL_FLAGS, ...COMMAND_FLAGS[mode][command]]);
}

const GLOBAL_FLAGS = ["_", "json", "help", "h"];

const COMMAND_FLAGS = {
  interactive: {
    authenticate: ["account-email"],
    "configure-billing": ["subscription-id"],
    deploy: ["location"],
  },
  json: {
    authenticate: ["account-email"],
    "configure-billing": ["subscription-id"],
    deploy: ["account-email", "subscription-id", "location"],
  },
} satisfies Record<CliMode, Record<CommandName, string[]>>;

function firstInvalidFlag(
  parsed: Record<string, unknown>,
  allowed: Set<string>,
): string | undefined {
  return Object.keys(parsed).find((key) => !allowed.has(key));
}

function compact(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(
      (entry): entry is [string, unknown] => entry[1] !== undefined,
    ),
  );
}

import { err, ok, type Result } from "./result.ts";

export type CliOptions = {
  json: boolean;
  transport?: string;
  target: string;
  command: string;
  targetArgs: string[];
};

export type ParseError = {
  type: "help" | "invalid-args";
  message?: string;
};

export const usage =
  `Usage: foolfad-configure [global-options] TARGET COMMAND [target-command-options]

Configure a known target on a remote machine through a foolfad transport.

Global options:
  --transport COMMAND STRING      Transport that runs a bash script from stdin.
  --json                          Read/write local CLI data as JSON.
  -h, --help                      Show this help.

Environment:
  FOOLFAD_CONFIG_TRANSPORT        Transport command string fallback.

Targets:
  gh check
  gh configure [--token TOKEN] [--git-user-name NAME] [--git-user-email EMAIL]

Examples:
  foolfad-configure --transport "foolfad-ssh box" gh check
  foolfad-configure --json --transport "foolfad-ssh box" gh configure --token "$GITHUB_TOKEN"
`;

export function parseCliArgs(argv: string[]): Result<CliOptions, ParseError> {
  let json = false;
  let transport: string | undefined;
  const rest: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "-h" || arg === "--help") {
      return err({ type: "help" });
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--transport") {
      const value = argv[index + 1];
      if (!value) {
        return err({ type: "invalid-args", message: "--transport requires a value" });
      }
      transport = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--transport=")) {
      transport = arg.slice("--transport=".length);
      if (!transport) {
        return err({ type: "invalid-args", message: "--transport requires a value" });
      }
      continue;
    }

    rest.push(arg);
  }

  const [target, command, ...targetArgs] = rest;
  if (!target || !command) {
    return err({ type: "invalid-args", message: "TARGET and COMMAND are required" });
  }

  return ok({
    json,
    transport,
    target,
    command,
    targetArgs,
  });
}

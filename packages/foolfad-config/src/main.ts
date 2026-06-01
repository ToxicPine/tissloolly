#!/usr/bin/env -S deno run --allow-run --allow-read
import { parseCliArgs, usage } from "./lib/args.ts";
import { type CliBoundaryError, invalidCliArgs, invalidCliArgsFrom } from "./lib/cli-error.ts";
import { Out, printError } from "./lib/out.ts";
import type { Result } from "./lib/result.ts";
import * as gh from "./targets/gh/index.ts";
import {
  type CliMode,
  type GhMutationCommand,
  parseGhMutationCommand,
} from "./targets/gh/mutation-command-schema.ts";

type JsonEnvelope =
  | {
    ok: true;
    target: string;
    command: string;
    state: unknown;
  }
  | {
    ok: true;
    help: string;
  }
  | {
    ok: false;
    target?: string;
    command?: string;
    error: {
      type: string;
      detail: unknown;
    };
  };

async function main(): Promise<void> {
  const parsed = parseCliArgs(Deno.args);
  const out = new Out<JsonEnvelope>(parsed.ok ? parsed.value.json : parsed.error.json);
  if (!parsed.ok) {
    if (parsed.error.type === "help") {
      out.write(`${usage}\n`);
      out.stage({ ok: true, help: usage });
      out.flush();
      return;
    }

    fail(
      out,
      2,
      {
        ok: false,
        error: invalidCliArgs(parsed.error.message ?? "invalid arguments"),
      },
      parsed.error.message ?? "invalid arguments",
      "Run `foolfad-configure --help` for usage.",
    );
  }

  const opts = parsed.value;
  const mode = opts.json ? "json" : "interactive";
  const transport = opts.transport ?? Deno.env.get("FOOLFAD_CONFIG_TRANSPORT");
  if (!transport) {
    fail(
      out,
      2,
      {
        ok: false,
        target: opts.target,
        command: opts.command,
        error: {
          type: "transport-command-missing",
          detail: "set --transport or FOOLFAD_CONFIG_TRANSPORT",
        },
      },
      "set --transport or FOOLFAD_CONFIG_TRANSPORT",
    );
  }

  switch (opts.target) {
    case "gh":
      await runGh(out, transport, mode, opts.command, opts.targetArgs);
      return;
    default:
      fail(
        out,
        2,
        {
          ok: false,
          target: opts.target,
          command: opts.command,
          error: { type: "unknown-target", detail: opts.target },
        },
        `unknown target: ${opts.target}`,
      );
  }
}

async function runGh(
  out: Out<JsonEnvelope>,
  transport: string,
  mode: CliMode,
  command: string,
  commandArgs: string[],
): Promise<void> {
  const ctx: gh.CommandContext = { transport };
  let result: Result<gh.CommandSuccess, gh.CommandError>;

  switch (command) {
    case "check":
      result = await gh.check(ctx);
      break;
    default: {
      const parsedCommand = parseGhMutationCommandAtBoundary(mode, command, commandArgs);
      if (!parsedCommand.ok) {
        fail(
          out,
          2,
          {
            ok: false,
            target: "gh",
            command,
            error: parsedCommand.error,
          },
          parsedCommand.error.type,
          parsedCommand.error.detail,
        );
      }

      const input = mode === "json"
        ? { mode, command: parsedCommand.value }
        : { mode, command: parsedCommand.value, tui: out };
      result = await gh.mutate(ctx, input);
      break;
    }
  }

  if (!result.ok) {
    fail(
      out,
      1,
      {
        ok: false,
        target: "gh",
        command,
        error: result.error,
      },
      result.error.type,
      result.error.detail,
    );
  }

  out.stage({
    ok: true,
    target: "gh",
    command,
    state: result.value.state,
  });

  gh.printResult(out, command, result.value.state);
  out.flush();
}

function parseGhMutationCommandAtBoundary(
  mode: CliMode,
  command: string,
  argv: string[],
): Result<GhMutationCommand, CliBoundaryError> {
  try {
    return { ok: true, value: parseGhMutationCommand(mode, command, argv) };
  } catch (error) {
    return { ok: false, error: invalidCliArgsFrom(error) };
  }
}

function fail(
  out: Out<JsonEnvelope>,
  code: number,
  artifact: JsonEnvelope,
  message: string,
  detail?: unknown,
): never {
  out.stage(artifact);
  printError(out, "foolfad-configure", message, detail);
  out.flush();
  Deno.exit(code);
}

if (import.meta.main) {
  await main();
}

#!/usr/bin/env -S deno run --allow-run --allow-read
import { parseCliArgs, usage } from "./lib/args.ts";
import { invalidCliArgs } from "./lib/cli-error.ts";
import { fail, Out } from "./lib/out.ts";
import type { Result } from "./lib/result.ts";
import { resolveTransportCommand } from "./lib/transport.ts";
import * as gh from "./targets/gh/index.ts";

type SuccessEnvelope = {
  ok: true;
  target: "gh";
  command: gh.GhCommand;
  state: unknown;
};

type HelpEnvelope = {
  ok: true;
  help: string;
};

type ErrorEnvelope = {
  ok: false;
  target?: string;
  command?: string;
  error: {
    type: string;
    detail: unknown;
  };
};

type JsonEnvelope = SuccessEnvelope | HelpEnvelope | ErrorEnvelope;

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
  const transport = resolveTransportCommand(opts.transport);
  if (!transport.ok) {
    fail(
      out,
      2,
      {
        ok: false,
        target: opts.target,
        command: opts.command,
        error: transport.error,
      },
      transport.error.type,
      transport.error.detail,
    );
  }

  switch (opts.target) {
    case "gh": {
      const command = gh.parseGhCommand(opts.command);
      if (!command) {
        fail(
          out,
          2,
          {
            ok: false,
            target: "gh",
            command: opts.command,
            error: invalidCliArgs(`unknown gh command: ${opts.command}`),
          },
          `unknown gh command: ${opts.command}`,
        );
      }
      await runGh(out, transport.value, mode, command, opts.targetArgs);
      return;
    }
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
  mode: gh.CliMode,
  command: gh.GhCommand,
  commandArgs: string[],
): Promise<void> {
  const ctx: gh.CommandContext = { transport };
  let result: Result<gh.CommandSuccess, gh.CommandError>;

  switch (command) {
    case "check":
      result = await gh.check(ctx);
      break;
    default: {
      const parsedInput = gh.parseMutationInput(mode, command, commandArgs);
      if (!parsedInput.ok) {
        fail(
          out,
          2,
          {
            ok: false,
            target: "gh",
            command,
            error: parsedInput.error,
          },
          parsedInput.error.type,
          parsedInput.error.detail,
        );
      }

      const input = parsedInput.value.mode === "json"
        ? parsedInput.value
        : { ...parsedInput.value, tui: out };
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

if (import.meta.main) {
  await main();
}

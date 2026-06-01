#!/usr/bin/env -S deno run --allow-run --allow-read
import { parseCliArgs, usage } from "./lib/args.ts";
import { type CliBoundaryError, invalidCliArgs, invalidCliArgsFrom } from "./lib/cli-error.ts";
import { Out, printError } from "./lib/out.ts";
import { err, ok, type Result } from "./lib/result.ts";
import { parseConfigureArgs } from "./targets/gh/arg-schema.ts";
import * as gh from "./targets/gh/index.ts";
import type { MutationInput } from "./targets/gh/mutation.ts";

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
  const out = new Out<JsonEnvelope>(Deno.args.includes("--json"));

  const parsed = parseCliArgs(Deno.args);
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
      await runGh(out, transport, opts.command, opts.targetArgs);
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
  command: string,
  commandArgs: string[],
): Promise<void> {
  const ctx: gh.CommandContext = { transport };
  let result: Result<gh.CommandSuccess, gh.CommandError>;

  switch (command) {
    case "check":
      result = await gh.check(ctx);
      break;
    case "configure": {
      const input = parseGhConfigureInput(out, commandArgs);
      if (!input.ok) {
        fail(
          out,
          2,
          {
            ok: false,
            target: "gh",
            command,
            error: input.error,
          },
          input.error.type,
          input.error.detail,
        );
      }
      result = await gh.configure(ctx, input.value);
      break;
    }
    default:
      fail(
        out,
        2,
        {
          ok: false,
          target: "gh",
          command,
          error: { type: "unknown-command", detail: command },
        },
        `unknown command for gh: ${command}`,
      );
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

function parseGhConfigureInput(
  out: Out<JsonEnvelope>,
  argv: string[],
): Result<MutationInput, CliBoundaryError> {
  try {
    const args = parseConfigureArgs(out.json ? "json" : "interactive", argv);
    if (args.mode === "json") {
      return ok({ mode: "json", args });
    }
    return ok({ mode: "interactive", args, output: out });
  } catch (error) {
    return err(invalidCliArgsFrom(error));
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

#!/usr/bin/env -S deno run --allow-run --allow-read
import { parseCliArgs, usage } from "./lib/args.ts";
import { Out, printError } from "./lib/out.ts";
import * as gh from "./targets/gh/index.ts";

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
        error: {
          type: "invalid-cli-args",
          detail: parsed.error.message ?? "invalid arguments",
        },
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

  if (opts.target !== "gh") {
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

  const ctx: gh.CommandContext = {
    json: out.json,
    transport,
    targetArgs: opts.targetArgs,
    output: out,
  };

  const command = opts.command;
  const result = command === "check"
    ? await gh.check(ctx)
    : command === "configure"
    ? await gh.configure(ctx)
    : undefined;

  if (!result) {
    fail(
      out,
      2,
      {
        ok: false,
        target: opts.target,
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
        target: opts.target,
        command,
        error: result.error,
      },
      result.error.type,
      result.error.detail,
    );
  }

  out.stage({
    ok: true,
    target: opts.target,
    command,
    state: result.value.state,
  });

  gh.printResult(ctx.output, command, result.value.state);
  out.flush();
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

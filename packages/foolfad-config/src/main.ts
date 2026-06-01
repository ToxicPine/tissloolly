#!/usr/bin/env -S deno run --allow-run --allow-read
import { parseCliArgs, usage } from "./lib/args.ts";
import { createTui } from "./lib/tui.ts";
import * as gh from "./targets/gh/index.ts";

type JsonEnvelope =
  | {
    ok: true;
    target: string;
    command: string;
    state: unknown;
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

function writeJson(envelope: JsonEnvelope): void {
  console.log(JSON.stringify(envelope, null, 2));
}

function failHuman(message: string, detail?: unknown): never {
  console.error(`foolfad-configure: ${message}`);
  if (typeof detail === "string" && detail) {
    console.error(detail);
  }
  Deno.exit(1);
}

async function main(): Promise<void> {
  const parsed = parseCliArgs(Deno.args);
  if (!parsed.ok) {
    const json = Deno.args.includes("--json");
    if (parsed.error.type === "help") {
      console.log(usage);
      return;
    }
    if (json) {
      writeJson({
        ok: false,
        error: {
          type: "invalid-cli-args",
          detail: parsed.error.message ?? "invalid arguments",
        },
      });
      Deno.exit(2);
    }
    console.error(`foolfad-configure: ${parsed.error.message}`);
    console.error("Run `foolfad-configure --help` for usage.");
    Deno.exit(2);
  }

  const opts = parsed.value;
  const transport = opts.transport ?? Deno.env.get("FOOLFAD_CONFIG_TRANSPORT");
  if (!transport) {
    if (opts.json) {
      writeJson({
        ok: false,
        target: opts.target,
        command: opts.command,
        error: {
          type: "transport-command-missing",
          detail: "set --transport or FOOLFAD_CONFIG_TRANSPORT",
        },
      });
      Deno.exit(2);
    }
    failHuman("set --transport or FOOLFAD_CONFIG_TRANSPORT");
  }

  if (opts.target !== "gh") {
    if (opts.json) {
      writeJson({
        ok: false,
        target: opts.target,
        command: opts.command,
        error: { type: "unknown-target", detail: opts.target },
      });
      Deno.exit(2);
    }
    failHuman(`unknown target: ${opts.target}`);
  }

  const ctx: gh.CommandContext = {
    json: opts.json,
    transport,
    targetArgs: opts.targetArgs,
    tui: createTui(),
  };

  const command = opts.command;
  const result = command === "check"
    ? await gh.check(ctx)
    : command === "configure"
    ? await gh.configure(ctx)
    : undefined;

  if (!result) {
    if (opts.json) {
      writeJson({
        ok: false,
        target: opts.target,
        command,
        error: { type: "unknown-command", detail: command },
      });
      Deno.exit(2);
    }
    failHuman(`unknown command for gh: ${command}`);
  }

  if (!result.ok) {
    if (opts.json) {
      writeJson({
        ok: false,
        target: opts.target,
        command,
        error: result.error,
      });
      Deno.exit(1);
    }
    failHuman(result.error.type, result.error.detail);
  }

  if (opts.json) {
    writeJson({
      ok: true,
      target: opts.target,
      command,
      state: result.value.state,
    });
  } else if (command === "configure") {
    console.log(`Configured gh.\n${gh.summarize(result.value.state)}`);
  } else {
    console.log(gh.summarize(result.value.state));
  }
}

if (import.meta.main) {
  await main();
}

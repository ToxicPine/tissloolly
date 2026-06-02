#!/usr/bin/env -S deno run --allow-run --allow-read
import { parseCliArgs, usage } from "./lib/args.ts";
import { invalidCliArgs } from "./lib/cli-error.ts";
import { fail, Out } from "./lib/out.ts";
import { resolveTransportCommand } from "./lib/transport.ts";
import * as gh from "./targets/gh/index.ts";

type SuccessEnvelope = {
  ok: true;
  target: "gh";
  command: string;
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
      const ctx: gh.CommandContext = { transport: transport.value };
      const command = opts.command;

      if (command === "check") {
        const parsedCheck = gh.parseCheckInput(opts.targetArgs);
        if (!parsedCheck.ok) {
          fail(
            out,
            2,
            {
              ok: false,
              target: "gh",
              command,
              error: parsedCheck.error,
            },
            parsedCheck.error.type,
            parsedCheck.error.detail,
          );
        }

        const result = await gh.check(ctx);
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
        return;
      }

      const strictMutation = gh.parseStrictMutationPayload(command, opts.targetArgs);
      if (strictMutation.ok) {
        const result = await gh.mutate(ctx, strictMutation.value);
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
        return;
      }

      if (mode !== "interactive") {
        fail(
          out,
          2,
          {
            ok: false,
            target: "gh",
            command,
            error: strictMutation.error,
          },
          strictMutation.error.type,
          strictMutation.error.detail,
        );
      }

      const draft = gh.parseInteractiveMutationDraft(command, opts.targetArgs);
      if (!draft.ok) {
        fail(
          out,
          2,
          {
            ok: false,
            target: "gh",
            command,
            error: draft.error,
          },
          draft.error.type,
          draft.error.detail,
        );
      }

      const candidatePayload = await gh.completeMutationDraft(draft.value, out);
      if (!candidatePayload.ok) {
        const error = {
          type: "mutation-planning-failed" as const,
          detail: candidatePayload.error,
        };
        fail(
          out,
          1,
          {
            ok: false,
            target: "gh",
            command,
            error,
          },
          error.type,
          error.detail,
        );
      }

      const finalPayload = gh.mutationSchema.safeParse(candidatePayload.value);
      if (!finalPayload.success) {
        const error = {
          type: "mutation-planning-failed" as const,
          detail: {
            type: "invalid-mutation",
            detail: finalPayload.error.issues,
          },
        };
        fail(
          out,
          1,
          {
            ok: false,
            target: "gh",
            command,
            error,
          },
          error.type,
          error.detail,
        );
      }

      const result = await gh.mutate(ctx, finalPayload.data);
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

if (import.meta.main) {
  await main();
}

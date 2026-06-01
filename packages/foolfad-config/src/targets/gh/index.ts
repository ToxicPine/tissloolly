import { z } from "zod";
import type { OutputControl } from "../../lib/out.ts";
import { err, ok, type Result } from "../../lib/result.ts";
import { mutateWrapper, runTransport } from "../../lib/transport.ts";
import { parseConfigureArgs } from "./arg-schema.ts";
import { type GuardResult, guardSchema } from "./guard-schema.ts";
import planGhMutation from "./mutation.ts";
import { mutationSchema } from "./mutation-schema.ts";
import { type GhState, ghStateSchema } from "./state-schema.ts";

export type TargetCommand = "check" | "configure";

export type CommandContext = {
  json: boolean;
  transport: string;
  targetArgs: string[];
  output: OutputControl;
};

export type CommandSuccess = {
  state: GhState;
};

export type CommandError = {
  type:
    | "invalid-cli-args"
    | "guard-failed"
    | "transport-failed"
    | "remote-failed"
    | "invalid-remote-json"
    | "invalid-remote-schema"
    | "mutation-planning-failed"
    | "invalid-mutation";
  detail: unknown;
};

const textDecoder = new TextDecoder();

async function script(name: "GUARD.sh" | "QUERY.sh" | "MUTATE.sh"): Promise<string> {
  return textDecoder.decode(
    await Deno.readFile(new URL(`./${name}`, import.meta.url)),
  );
}

function parseJson(stdout: string): Result<unknown, CommandError> {
  try {
    return ok(JSON.parse(stdout));
  } catch (error) {
    return err({
      type: "invalid-remote-json",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function parseSchema<T>(
  schema: z.ZodType<T>,
  value: unknown,
): Result<T, CommandError> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return err({ type: "invalid-remote-schema", detail: parsed.error.issues });
  }
  return ok(parsed.data);
}

async function remoteJson<T>(
  ctx: CommandContext,
  remoteScript: string,
  schema: z.ZodType<T>,
): Promise<Result<T, CommandError>> {
  const result = await runTransport(ctx.transport, remoteScript);
  if (!result.ok) {
    return err({ type: "transport-failed", detail: result.error });
  }
  if (result.value.code !== 0) {
    return err({
      type: "remote-failed",
      detail: {
        code: result.value.code,
        stderr: result.value.stderr,
      },
    });
  }
  const json = parseJson(result.value.stdout);
  if (!json.ok) {
    return json;
  }
  return parseSchema(schema, json.value);
}

async function guard(ctx: CommandContext): Promise<Result<GuardResult, CommandError>> {
  return await remoteJson(ctx, await script("GUARD.sh"), guardSchema);
}

async function query(ctx: CommandContext): Promise<Result<GhState, CommandError>> {
  return await remoteJson(ctx, await script("QUERY.sh"), ghStateSchema);
}

async function mutate(
  ctx: CommandContext,
  payload: unknown,
): Promise<Result<GhState, CommandError>> {
  return await remoteJson(
    ctx,
    mutateWrapper(await script("MUTATE.sh"), payload),
    ghStateSchema,
  );
}

async function guarded(ctx: CommandContext): Promise<Result<undefined, CommandError>> {
  const guardResult = await guard(ctx);
  if (!guardResult.ok) {
    return guardResult;
  }
  if (!guardResult.value.ok) {
    return err({
      type: "guard-failed",
      detail: guardResult.value.error,
    });
  }
  return ok(undefined);
}

export async function check(ctx: CommandContext): Promise<Result<CommandSuccess, CommandError>> {
  const guardResult = await guarded(ctx);
  if (!guardResult.ok) {
    return guardResult;
  }

  const state = await query(ctx);
  if (!state.ok) {
    return state;
  }

  return ok({ state: state.value });
}

export async function configure(
  ctx: CommandContext,
): Promise<Result<CommandSuccess, CommandError>> {
  let args;
  try {
    args = parseConfigureArgs(ctx.json ? "json" : "interactive", ctx.targetArgs);
  } catch (error) {
    return err({
      type: "invalid-cli-args",
      detail: error instanceof z.ZodError
        ? error.issues
        : error instanceof Error
        ? error.message
        : String(error),
    });
  }

  const guardResult = await guarded(ctx);
  if (!guardResult.ok) {
    return guardResult;
  }

  const planned = await planGhMutation(
    args.mode === "json"
      ? { mode: "json", args }
      : { mode: "interactive", args, output: ctx.output },
  );
  if (!planned.ok) {
    return err({ type: "mutation-planning-failed", detail: planned.error });
  }

  const payload = mutationSchema.safeParse(planned.value);
  if (!payload.success) {
    return err({ type: "invalid-mutation", detail: payload.error.issues });
  }

  const state = await mutate(ctx, payload.data);
  if (!state.ok) {
    return state;
  }

  return ok({ state: state.value });
}

export function summarize(state: GhState): string {
  const lines = [
    `gh authenticated: ${state.authenticated ? "yes" : "no"}`,
  ];

  if (state.account) lines.push(`gh account: ${state.account}`);
  if (state.host) lines.push(`gh host: ${state.host}`);
  if (state.gitUserName) lines.push(`git user.name: ${state.gitUserName}`);
  if (state.gitUserEmail) lines.push(`git user.email: ${state.gitUserEmail}`);
  if (state.credentialHelper) lines.push(`git credential.helper: ${state.credentialHelper}`);

  return `${lines.join("\n")}\n`;
}

export function printResult(
  output: OutputControl,
  command: string,
  state: GhState,
): void {
  if (command === "configure") {
    output.write(`Configured gh.\n${summarize(state)}`);
  } else {
    output.write(summarize(state));
  }
}

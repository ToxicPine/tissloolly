import type { OutputControl } from "../../lib/out.ts";
import { remoteJson, type RemoteJsonError } from "../../lib/remote.ts";
import { err, ok, type Result } from "../../lib/result.ts";
import { mutateWrapper } from "../../lib/transport.ts";
import { type GuardResult, guardSchema } from "./guard-schema.ts";
import planGhMutation, { type MutationInput } from "./mutation.ts";
import { mutationSchema } from "./mutation-schema.ts";
import { type GhState, ghStateSchema } from "./state-schema.ts";

export type CommandContext = {
  transport: string;
};

export type CommandSuccess = {
  state: GhState;
};

export type CommandError = {
  type:
    | RemoteJsonError["type"]
    | "guard-failed"
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

async function guard(ctx: CommandContext): Promise<Result<GuardResult, CommandError>> {
  return await remoteJson(ctx.transport, await script("GUARD.sh"), guardSchema);
}

async function query(ctx: CommandContext): Promise<Result<GhState, CommandError>> {
  return await remoteJson(ctx.transport, await script("QUERY.sh"), ghStateSchema);
}

async function applyMutation(
  ctx: CommandContext,
  payload: unknown,
): Promise<Result<GhState, CommandError>> {
  return await remoteJson(
    ctx.transport,
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

export async function mutate(
  ctx: CommandContext,
  input: MutationInput,
): Promise<Result<CommandSuccess, CommandError>> {
  const guardResult = await guarded(ctx);
  if (!guardResult.ok) {
    return guardResult;
  }

  const planned = await planGhMutation(input);
  if (!planned.ok) {
    return err({ type: "mutation-planning-failed", detail: planned.error });
  }

  const payload = mutationSchema.safeParse(planned.value);
  if (!payload.success) {
    return err({ type: "invalid-mutation", detail: payload.error.issues });
  }

  const state = await applyMutation(ctx, payload.data);
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

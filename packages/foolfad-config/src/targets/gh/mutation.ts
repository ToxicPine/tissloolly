import { err, ok, type Result } from "../../lib/result.ts";
import type { TuiControl } from "../../lib/out.ts";
import type { GhMutationCommand } from "./mutation-command-schema.ts";
import { type MutationPayload, mutationSchema } from "./mutation-schema.ts";

export type MutationInput =
  | {
    mode: "json";
    command: GhMutationCommand;
  }
  | {
    mode: "interactive";
    command: GhMutationCommand;
    tui: TuiControl;
  };

export type MutationPlanningError = {
  type: "missing-input" | "invalid-mutation";
  detail: unknown;
};

export default async function planGhMutation(
  input: MutationInput,
): Promise<Result<MutationPayload, MutationPlanningError>> {
  switch (input.command.type) {
    case "configure":
      return await planConfigureMutation(input);
  }
}

async function planConfigureMutation(
  input: MutationInput,
): Promise<Result<MutationPayload, MutationPlanningError>> {
  const token = input.command.token ??
    (input.mode === "interactive"
      ? await input.tui.prompt("GitHub token for remote gh auth: ")
      : undefined);

  if (!token) {
    return err({
      type: "missing-input",
      detail: "github token is required",
    });
  }

  const payload = {
    githubToken: token,
    gitUserName: input.command.gitUserName,
    gitUserEmail: input.command.gitUserEmail,
  };

  const parsed = mutationSchema.safeParse(payload);
  if (!parsed.success) {
    return err({
      type: "invalid-mutation",
      detail: parsed.error.issues,
    });
  }

  return ok(parsed.data);
}

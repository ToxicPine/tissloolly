import { err, ok, type Result } from "../../lib/result.ts";
import type { TuiControl } from "../../lib/tui.ts";
import type { InteractiveConfigureArgs, JsonConfigureArgs } from "./arg-schema.ts";
import { type MutationPayload, mutationSchema } from "./mutation-schema.ts";

export type MutationInput =
  | {
    mode: "json";
    args: JsonConfigureArgs;
  }
  | {
    mode: "interactive";
    args: InteractiveConfigureArgs;
    tui: TuiControl;
  };

export type MutationPlanningError = {
  type: "missing-input" | "invalid-mutation";
  detail: unknown;
};

export default async function planGhMutation(
  input: MutationInput,
): Promise<Result<MutationPayload, MutationPlanningError>> {
  const token = input.args.token ??
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
    gitUserName: input.args.gitUserName,
    gitUserEmail: input.args.gitUserEmail,
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

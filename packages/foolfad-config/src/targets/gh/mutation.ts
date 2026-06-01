import { err, ok, type Result } from "../../lib/result.ts";
import type { TuiControl } from "../../lib/out.ts";
import type { ParsedMutationInput } from "./mutation-command-schema.ts";
import { type MutationPayload, mutationSchema } from "./mutation-schema.ts";

export type MutationInput =
  | Extract<ParsedMutationInput, { mode: "json" }>
  | (Extract<ParsedMutationInput, { mode: "interactive" }> & { tui: TuiControl });

export type MutationCompletionError = {
  type: "missing-input" | "invalid-mutation";
  detail: unknown;
};

export async function completeGhMutationInput(
  input: MutationInput,
): Promise<Result<MutationPayload, MutationCompletionError>> {
  if (input.mode === "json") {
    return ok(input.payload);
  }

  switch (input.draft.type) {
    case "configure":
      return await completeConfigureMutation(input);
  }
}

async function completeConfigureMutation(
  input: Extract<MutationInput, { mode: "interactive" }>,
): Promise<Result<MutationPayload, MutationCompletionError>> {
  const token = input.draft.token ?? await input.tui.prompt("GitHub token for remote gh auth: ");

  if (!token) {
    return err({
      type: "missing-input",
      detail: "github token is required",
    });
  }

  const payload = {
    githubToken: token,
    gitUserName: input.draft.gitUserName,
    gitUserEmail: input.draft.gitUserEmail,
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

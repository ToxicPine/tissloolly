import type { TuiControl } from "../../lib/out.ts";
import { err, ok, type Result } from "../../lib/result.ts";
import type { InteractiveMutationDraft } from "./mutation-command-schema.ts";

export type MutationCompletionError = {
  type: "missing-input";
  detail: unknown;
};

export async function completeGhMutationDraft(
  draft: InteractiveMutationDraft,
  tui: TuiControl,
): Promise<Result<unknown, MutationCompletionError>> {
  switch (draft.type) {
    case "configure":
      return await completeConfigureMutation(draft, tui);
  }
}

async function completeConfigureMutation(
  draft: Extract<InteractiveMutationDraft, { type: "configure" }>,
  tui: TuiControl,
): Promise<Result<unknown, MutationCompletionError>> {
  const token = draft.token ?? await tui.prompt("GitHub token for remote gh auth: ");

  if (!token) {
    return err({
      type: "missing-input",
      detail: "github token is required",
    });
  }

  const payload = {
    type: "configure",
    githubToken: token,
    gitUserName: draft.gitUserName,
    gitUserEmail: draft.gitUserEmail,
  };

  return ok(payload);
}

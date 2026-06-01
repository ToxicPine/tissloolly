import { parseArgs } from "node:util";
import { z } from "zod";
import { type MutationPayload, mutationSchema } from "./mutation-schema.ts";

export type CliMode = "json" | "interactive";

const configureDraftSchema = z.object({
  type: z.literal("configure"),
  token: z.string().min(1).optional(),
  gitUserName: z.string().min(1).optional(),
  gitUserEmail: z.string().email().optional(),
});

type ConfigureMutationDraft = z.infer<typeof configureDraftSchema>;
type CompleteConfigureMutationDraft = ConfigureMutationDraft & { token: string };

const completeConfigureDraftSchema = configureDraftSchema.extend({
  token: z.string().min(1),
}).transform(configureDraftToPayload).pipe(mutationSchema);

type InteractiveMutationDraft = ConfigureMutationDraft;

export type ParsedMutationInput =
  | {
    mode: "json";
    payload: MutationPayload;
  }
  | {
    mode: "interactive";
    draft: InteractiveMutationDraft;
  };

const configureDraftArgvSchema = z.array(z.string()).transform((argv, ctx) => {
  let draft: unknown;
  try {
    const parsed = parseArgs({
      args: argv,
      allowPositionals: false,
      strict: true,
      options: {
        token: { type: "string" },
        "git-user-name": { type: "string" },
        "git-user-email": { type: "string" },
      },
    });

    draft = {
      type: "configure",
      token: parsed.values.token,
      gitUserName: parsed.values["git-user-name"],
      gitUserEmail: parsed.values["git-user-email"],
    };
  } catch (error) {
    ctx.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : String(error),
    });
    return z.NEVER;
  }

  return draft;
});

const jsonConfigureArgvSchema = configureDraftArgvSchema
  .pipe(completeConfigureDraftSchema)
  .transform((payload) => ({ mode: "json" as const, payload }));

const interactiveConfigureArgvSchema = configureDraftArgvSchema
  .pipe(configureDraftSchema)
  .transform((draft) => ({ mode: "interactive" as const, draft }));

const configureArgvSchema = (mode: CliMode) =>
  mode === "json" ? jsonConfigureArgvSchema : interactiveConfigureArgvSchema;

const ghMutationInputArgvSchema = (mode: CliMode) =>
  z.array(z.string()).min(1, "gh mutation command is required").transform((argv, ctx) => {
    const [command, ...commandArgs] = argv;

    switch (command) {
      case "configure": {
        const parsed = configureArgvSchema(mode).safeParse(commandArgs);
        if (!parsed.success) {
          addIssues(ctx, parsed.error.issues);
          return z.NEVER;
        }
        return parsed.data;
      }
      default:
        ctx.addIssue({
          code: "custom",
          message: `unknown gh mutation command: ${command}`,
        });
        return z.NEVER;
    }
  });

export function parseGhMutationInput(
  mode: CliMode,
  command: string,
  argv: string[],
): ParsedMutationInput {
  return ghMutationInputArgvSchema(mode).parse([command, ...argv]);
}

function addIssues(ctx: z.RefinementCtx, issues: z.core.$ZodIssue[]): void {
  for (const issue of issues) {
    ctx.addIssue({
      code: "custom",
      message: issue.message,
      path: issue.path,
    });
  }
}

function configureDraftToPayload(draft: CompleteConfigureMutationDraft): MutationPayload {
  return {
    githubToken: draft.token,
    ...(draft.gitUserName ? { gitUserName: draft.gitUserName } : {}),
    ...(draft.gitUserEmail ? { gitUserEmail: draft.gitUserEmail } : {}),
  };
}

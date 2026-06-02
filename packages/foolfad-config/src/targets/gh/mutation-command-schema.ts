import { parseArgs } from "node:util";
import { z } from "zod";
import { type MutationPayload, mutationSchema } from "./mutation-schema.ts";

export type CliMode = "json" | "interactive";
export type GhStateCommand = "check";
export type GhMutationCommand = "configure";
export type GhCommand = GhStateCommand | GhMutationCommand;

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

export type InteractiveMutationDraft = ConfigureMutationDraft;

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

const strictConfigureArgvSchema = configureDraftArgvSchema.pipe(completeConfigureDraftSchema);

const interactiveConfigureArgvSchema = configureDraftArgvSchema.pipe(configureDraftSchema);

const checkArgvSchema = z.array(z.string()).length(0, "gh check does not accept arguments");

const ghMutationPayloadArgvSchema = z
  .array(z.string())
  .min(1, "gh mutation command is required")
  .transform((argv, ctx) => {
    const [command, ...commandArgs] = argv;

    switch (command) {
      case "configure": {
        const parsed = strictConfigureArgvSchema.safeParse(commandArgs);
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

const ghInteractiveMutationDraftArgvSchema = z
  .array(z.string())
  .min(1, "gh mutation command is required")
  .transform((argv, ctx) => {
    const [command, ...commandArgs] = argv;

    switch (command) {
      case "configure": {
        const parsed = interactiveConfigureArgvSchema.safeParse(commandArgs);
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

export function parseGhCheckArgs(argv: string[]): undefined {
  checkArgvSchema.parse(argv);
  return undefined;
}

export function parseGhMutationPayload(
  command: string,
  argv: string[],
): MutationPayload {
  return ghMutationPayloadArgvSchema.parse([command, ...argv]);
}

export function parseGhInteractiveMutationDraft(
  command: string,
  argv: string[],
): InteractiveMutationDraft {
  return ghInteractiveMutationDraftArgvSchema.parse([command, ...argv]);
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
    type: "configure",
    githubToken: draft.token,
    ...(draft.gitUserName ? { gitUserName: draft.gitUserName } : {}),
    ...(draft.gitUserEmail ? { gitUserEmail: draft.gitUserEmail } : {}),
  };
}

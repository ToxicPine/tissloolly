import { parseArgs } from "node:util";
import { z } from "zod";

export type CliMode = "json" | "interactive";

const configureMutationCommandSchema = z.object({
  type: z.literal("configure"),
  token: z.string().min(1).optional(),
  gitUserName: z.string().min(1).optional(),
  gitUserEmail: z.string().email().optional(),
});

const jsonConfigureMutationCommandSchema = configureMutationCommandSchema.extend({
  token: z.string().min(1),
});

export type ConfigureMutationCommand = z.infer<typeof configureMutationCommandSchema>;

export type GhMutationCommand = ConfigureMutationCommand;

const configureArgvSchema = (mode: CliMode) =>
  z.array(z.string()).transform((argv, ctx) => {
    let command: unknown;
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

      command = {
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

    const parsed = mode === "json"
      ? jsonConfigureMutationCommandSchema.safeParse(command)
      : configureMutationCommandSchema.safeParse(command);
    if (!parsed.success) {
      addIssues(ctx, parsed.error.issues);
      return z.NEVER;
    }

    return parsed.data;
  });

const ghMutationCommandArgvSchema = (mode: CliMode) =>
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

export function parseGhMutationCommand(
  mode: CliMode,
  command: string,
  argv: string[],
): GhMutationCommand {
  return ghMutationCommandArgvSchema(mode).parse([command, ...argv]);
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

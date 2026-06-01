import { z } from "zod";

export const jsonConfigureArgsSchema = z.object({
  mode: z.literal("json"),
  token: z.string().min(1),
  gitUserName: z.string().min(1).optional(),
  gitUserEmail: z.string().email().optional(),
});

export const interactiveConfigureArgsSchema = z.object({
  mode: z.literal("interactive"),
  token: z.string().min(1).optional(),
  gitUserName: z.string().min(1).optional(),
  gitUserEmail: z.string().email().optional(),
});

export const configureArgsSchema = z.discriminatedUnion("mode", [
  jsonConfigureArgsSchema,
  interactiveConfigureArgsSchema,
]);

export type JsonConfigureArgs = z.infer<typeof jsonConfigureArgsSchema>;
export type InteractiveConfigureArgs = z.infer<typeof interactiveConfigureArgsSchema>;
export type ConfigureArgs = z.infer<typeof configureArgsSchema>;

export type ConfigureArgParseError = {
  type: "invalid-cli-args";
  detail: unknown;
};

export function parseConfigureArgs(mode: "json" | "interactive", argv: string[]): ConfigureArgs {
  const values: Record<string, unknown> = { mode };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = (name: string): string => {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${name} requires a value`);
      }
      index += 1;
      return value;
    };

    if (arg === "--token") {
      values.token = readValue("--token");
    } else if (arg.startsWith("--token=")) {
      values.token = arg.slice("--token=".length);
    } else if (arg === "--git-user-name") {
      values.gitUserName = readValue("--git-user-name");
    } else if (arg.startsWith("--git-user-name=")) {
      values.gitUserName = arg.slice("--git-user-name=".length);
    } else if (arg === "--git-user-email") {
      values.gitUserEmail = readValue("--git-user-email");
    } else if (arg.startsWith("--git-user-email=")) {
      values.gitUserEmail = arg.slice("--git-user-email=".length);
    } else {
      throw new Error(`unknown gh configure option: ${arg}`);
    }
  }

  return configureArgsSchema.parse(values);
}

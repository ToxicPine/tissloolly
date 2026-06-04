import { parseArgs } from "node:util";
import { z } from "zod";
import {
  type HermesArtifactFile,
  type MutationPayload,
  mutationSchema,
} from "./mutation-schema.ts";

const configureFlagSchema = z.object({
  configYamlFile: z.string().min(1).optional(),
  envFile: z.string().min(1).optional(),
  soulMdFile: z.string().min(1).optional(),
});
type ConfigureFlags = z.infer<typeof configureFlagSchema>;

const authFlagSchema = z.object({
  provider: z.string().min(1).default("nous"),
  authJsonFile: z.string().min(1).optional(),
});
type AuthFlags = z.infer<typeof authFlagSchema>;

export const configureInputSchema = configureFlagSchema.extend({
  type: z.literal("configure"),
});

export const authInputSchema = authFlagSchema.extend({
  type: z.literal("auth"),
});

export type ConfigureInput = z.infer<typeof configureInputSchema>;
export type AuthInput = z.infer<typeof authInputSchema>;
export type HermesInput = ConfigureInput | AuthInput;

const checkArgvSchema = z
  .array(z.string())
  .length(0, "hermes check does not accept arguments");

export function parseHermesCheckArgs(argv: string[]): undefined {
  checkArgvSchema.parse(argv);
  return undefined;
}

export function parseHermesInput(command: string, argv: string[]): HermesInput {
  switch (command) {
    case "configure":
      return configureInputSchema.parse({
        type: "configure",
        ...parseConfigureFlags(argv),
      });
    case "auth":
      return authInputSchema.parse({
        type: "auth",
        ...parseAuthFlags(argv),
      });
    default:
      throw new Error(`unknown hermes command: ${command}`);
  }
}

export function parseHermesMutationPayload(
  input: HermesInput,
): MutationPayload {
  return mutationSchema.parse(hermesInputToMutationShape(input));
}

function parseConfigureFlags(argv: string[]): ConfigureFlags {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: false,
    strict: true,
    options: {
      "config-yaml-file": { type: "string" },
      "env-file": { type: "string" },
      "soul-md-file": { type: "string" },
    },
  });

  return configureFlagSchema.parse({
    configYamlFile: parsed.values["config-yaml-file"],
    envFile: parsed.values["env-file"],
    soulMdFile: parsed.values["soul-md-file"],
  });
}

function parseAuthFlags(argv: string[]): AuthFlags {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: false,
    strict: true,
    options: {
      provider: { type: "string" },
      "auth-json-file": { type: "string" },
    },
  });

  return authFlagSchema.parse({
    provider: parsed.values.provider,
    authJsonFile: parsed.values["auth-json-file"],
  });
}

export function hermesInputToMutationShape(input: HermesInput): unknown {
  switch (input.type) {
    case "configure": {
      const files = readExplicitHermesArtifactFiles(input);
      if (files.length === 0) {
        throw new Error(
          "hermes configure requires --config-yaml-file, --env-file, or --soul-md-file for noninteractive configuration",
        );
      }

      return {
        type: "configure",
        files,
      };
    }
    case "auth":
      if (!input.authJsonFile) {
        throw new Error(
          "hermes auth requires --auth-json-file for noninteractive configuration",
        );
      }

      return {
        type: "configure",
        files: [
          {
            path: "auth.json",
            content: Deno.readTextFileSync(input.authJsonFile),
          },
        ],
      };
  }
}

function readExplicitHermesArtifactFiles(
  input: ConfigureInput,
): HermesArtifactFile[] {
  const files: HermesArtifactFile[] = [];

  if (input.configYamlFile) {
    files.push({
      path: "config.yaml",
      content: Deno.readTextFileSync(input.configYamlFile),
    });
  }

  if (input.envFile) {
    files.push({
      path: ".env",
      content: Deno.readTextFileSync(input.envFile),
    });
  }

  if (input.soulMdFile) {
    files.push({
      path: "SOUL.md",
      content: Deno.readTextFileSync(input.soulMdFile),
    });
  }

  return files;
}

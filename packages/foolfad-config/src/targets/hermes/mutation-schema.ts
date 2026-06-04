import { z } from "zod";

export const hermesArtifactPathSchema = z.enum([
  "config.yaml",
  ".env",
  "SOUL.md",
]);

export const hermesArtifactFileSchema = z.object({
  path: hermesArtifactPathSchema,
  content: z.string(),
});

export const mutationSchema = z.object({
  type: z.literal("configure"),
  files: z.array(hermesArtifactFileSchema).min(1),
});

export type HermesArtifactFile = z.infer<typeof hermesArtifactFileSchema>;
export type MutationPayload = z.infer<typeof mutationSchema>;

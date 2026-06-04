import { z } from "zod";

export const hermesStateSchema = z.object({
  configured: z.boolean(),
  hermesHome: z.string().min(1),
  configYamlPresent: z.boolean(),
  envFilePresent: z.boolean(),
  soulMdPresent: z.boolean(),
});

export type HermesState = z.infer<typeof hermesStateSchema>;

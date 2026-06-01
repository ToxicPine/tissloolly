import { z } from "zod";
import { err, ok, type Result } from "./result.ts";
import { runTransport } from "./transport.ts";

export type RemoteJsonError = {
  type:
    | "transport-failed"
    | "remote-failed"
    | "invalid-remote-json"
    | "invalid-remote-schema";
  detail: unknown;
};

export async function remoteJson<T>(
  transport: string,
  remoteScript: string,
  schema: z.ZodType<T>,
): Promise<Result<T, RemoteJsonError>> {
  const result = await runTransport(transport, remoteScript);
  if (!result.ok) {
    return err({ type: "transport-failed", detail: result.error });
  }
  if (result.value.code !== 0) {
    return err({
      type: "remote-failed",
      detail: {
        code: result.value.code,
        stderr: result.value.stderr,
      },
    });
  }

  const json = parseJson(result.value.stdout);
  if (!json.ok) {
    return json;
  }

  return parseSchema(schema, json.value);
}

function parseJson(stdout: string): Result<unknown, RemoteJsonError> {
  try {
    return ok(JSON.parse(stdout));
  } catch (error) {
    return err({
      type: "invalid-remote-json",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function parseSchema<T>(
  schema: z.ZodType<T>,
  value: unknown,
): Result<T, RemoteJsonError> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return err({ type: "invalid-remote-schema", detail: parsed.error.issues });
  }
  return ok(parsed.data);
}

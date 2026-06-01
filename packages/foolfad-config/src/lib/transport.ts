import { err, ok, type Result } from "./result.ts";

export type TransportResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export type TransportError =
  | { type: "transport-command-missing"; detail: string }
  | { type: "transport-process-failed"; detail: string };

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export async function runTransport(
  transport: string,
  script: string,
): Promise<Result<TransportResult, TransportError>> {
  if (!transport.trim()) {
    return err({
      type: "transport-command-missing",
      detail: "set --transport or FOOLFAD_CONFIG_TRANSPORT",
    });
  }

  try {
    const command = new Deno.Command("bash", {
      args: ["-c", transport],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });
    const child = command.spawn();
    const writer = child.stdin.getWriter();
    await writer.write(encoder.encode(script));
    await writer.close();

    const output = await child.output();
    return ok({
      code: output.code,
      stdout: decoder.decode(output.stdout),
      stderr: decoder.decode(output.stderr),
    });
  } catch (error) {
    return err({
      type: "transport-process-failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function writeHeredoc(destination: string, label: string, body: string): string {
  return `cat > ${destination} <<'${label}'\n${body.replace(/\n?$/, "\n")}${label}\n`;
}

export function mutateWrapper(script: string, payload: unknown): string {
  const payloadJson = JSON.stringify(payload);
  return `set -euo pipefail
tmp_script="$(mktemp)"
cleanup() {
  rm -f "$tmp_script"
}
trap cleanup EXIT
${writeHeredoc('"$tmp_script"', "FOOLFAD_CONFIG_MUTATE_SCRIPT", script)}
bash "$tmp_script" <<'FOOLFAD_CONFIG_MUTATION_PAYLOAD'
${payloadJson}
FOOLFAD_CONFIG_MUTATION_PAYLOAD
`;
}

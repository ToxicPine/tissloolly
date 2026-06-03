import { join } from "@std/path";

export class ConsoleError extends Error {
  code: number;
  stderr: string;

  constructor(message: string, code: number) {
    super(message);
    this.code = code;
    this.stderr = message;
    this.name = "ConsoleError";
  }
}

export class AzMalformedOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AzMalformedOutputError";
  }
}

export interface CommandOutput extends Deno.CommandStatus {
  stdout: string;
  stderr: string;
}

function homeDir(): string {
  const home = Deno.env.get("HOME");
  if (!home) {
    throw new Error("HOME is required to locate Hettron Azure state.");
  }
  return home;
}

export function hettronAzureStateDir(): string {
  return join(homeDir(), ".hettron", "azure");
}

export function azureCliConfigDir(): string {
  return join(hettronAzureStateDir(), "az-config");
}

export type AzFormat = "json" | "none" | "tsv";
type AzStdio = "piped" | "inherit";

export async function runAzRaw(
  args: string[],
  options: {
    output?: AzFormat;
    stdin?: "null" | "inherit";
    stdout?: AzStdio;
    stderr?: AzStdio;
  } = {},
): Promise<CommandOutput> {
  const configDir = azureCliConfigDir();
  await Deno.mkdir(configDir, { recursive: true });

  const stdout = options.stdout ?? "piped";
  const stderr = options.stderr ?? "piped";
  const outputArgs = options.output
    ? [...args, "--output", options.output]
    : args;
  const child = new Deno.Command("az", {
    args: [...outputArgs, "--only-show-errors"],
    env: {
      AZURE_CONFIG_DIR: configDir,
    },
    stdin: options.stdin ?? "null",
    stdout,
    stderr,
  });
  if (stdout === "inherit" || stderr === "inherit") {
    const process = child.spawn();
    const [status, stdoutText, stderrText] = await Promise.all([
      process.status,
      stdout === "piped" ? readStream(process.stdout) : "",
      stderr === "piped" ? readStream(process.stderr) : "",
    ]);
    return {
      ...status,
      stdout: stdoutText,
      stderr: stderrText,
    };
  }

  const output = await child.output();
  return {
    ...output,
    stdout: output.stdout ? new TextDecoder().decode(output.stdout) : "",
    stderr: new TextDecoder().decode(output.stderr),
  };
}

export async function runWithAz(args: string[]): Promise<unknown> {
  const result = await runAzRaw(args, { output: "json" });
  if (result.code !== 0) {
    throw new ConsoleError(result.stderr, result.code);
  }
  const text = result.stdout.trim();
  try {
    return text ? JSON.parse(text) : null;
  } catch (error) {
    throw new AzMalformedOutputError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function runAzText(
  args: string[],
  output: "tsv" | "none" = "tsv",
): Promise<string> {
  const result = await runAzRaw(args, { output });
  if (result.code !== 0) {
    throw new ConsoleError(result.stderr, result.code);
  }
  return result.stdout.trim();
}

export async function runAzInteractive(args: string[]): Promise<void> {
  const result = await runAzRaw(args, {
    output: "json",
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.code !== 0) {
    throw new ConsoleError(result.stderr, result.code);
  }
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return new TextDecoder().decode(concat(chunks));
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

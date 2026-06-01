export type OutputControl = {
  prompt(message: string): Promise<string | undefined>;
  write(message: string): void;
};

export type OutputIo = {
  input?: Pick<typeof Deno.stdin, "read">;
  write?: Pick<typeof Deno.stdout, "writeSync">;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class Out<JsonArtifact> {
  readonly json: boolean;
  #input: Pick<typeof Deno.stdin, "read">;
  #write: Pick<typeof Deno.stdout, "writeSync">;
  #artifact: JsonArtifact | undefined;

  constructor(json: boolean, io: OutputIo = {}) {
    this.json = json;
    this.#input = io.input ?? Deno.stdin;
    this.#write = io.write ?? Deno.stdout;
  }

  stage(artifact: JsonArtifact): void {
    if (this.json) {
      this.#artifact = artifact;
    }
  }

  write(message: string): void {
    if (!this.json) {
      this.#write.writeSync(encoder.encode(message));
    }
  }

  async prompt(message: string): Promise<string | undefined> {
    this.write(message);

    const chunks: Uint8Array[] = [];
    const buffer = new Uint8Array(1024);

    while (true) {
      const count = await this.#input.read(buffer);
      if (count === null) {
        break;
      }

      const chunk = buffer.slice(0, count);
      const newline = chunk.indexOf(10);
      if (newline >= 0) {
        chunks.push(chunk.slice(0, newline));
        break;
      }
      chunks.push(chunk);
    }

    const value = decoder.decode(concat(chunks)).replace(/\r$/, "");
    return value.length > 0 ? value : undefined;
  }

  flush(): void {
    if (this.json && this.#artifact !== undefined) {
      this.#write.writeSync(encoder.encode(`${jsonLines(this.#artifact)}\n`));
    }
  }
}

export function printError(
  out: OutputControl,
  prefix: string,
  message: string,
  detail?: unknown,
): void {
  out.write(`${prefix}: ${message}\n`);
  const rendered = renderDetail(detail);
  if (rendered) {
    out.write(`${rendered}\n`);
  }
}

export function jsonLines(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function renderDetail(detail: unknown): string | undefined {
  if (detail === undefined || detail === null || detail === "") {
    return undefined;
  }
  if (typeof detail === "string") {
    return detail;
  }
  return jsonLines(detail);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export type TuiControl = {
  prompt(message: string): Promise<string | undefined>;
  write(message: string): void;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function createTui(): TuiControl {
  return {
    async prompt(message: string): Promise<string | undefined> {
      Deno.stderr.writeSync(encoder.encode(message));
      const chunks: Uint8Array[] = [];
      const buffer = new Uint8Array(1024);

      while (true) {
        const count = await Deno.stdin.read(buffer);
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
    },
    write(message: string): void {
      console.error(message);
    },
  };
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

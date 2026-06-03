import type {
  AuthOutput,
  BillingOutput,
  CommandName,
  DeployOutput,
  SecretSetOutput,
} from "../domain/types.ts";

export type CommandSuccessCases =
  | { command: "authenticate"; data: AuthOutput }
  | { command: "configure-billing"; data: BillingOutput }
  | { command: "deploy"; data: DeployOutput }
  | { command: "set-secret"; data: SecretSetOutput };

export type AssertAllCommandsCovered =
  Exclude<CommandName, CommandSuccessCases["command"]> extends never ? true
    : [
      "Missing CommandSuccessCases for",
      Exclude<CommandName, CommandSuccessCases["command"]>,
    ];

export type CommandErrorType =
  | "invalid-arguments"
  | "invalid-account-state"
  | "invalid-input"
  | "az-returned-error-code"
  | "az-returned-malformed-output"
  | "az-not-found"
  | "not-authenticated"
  | "subscription-setup-required"
  | "resource-group-unavailable"
  | "storage-account-name-unavailable"
  | "provider-registration-timeout"
  | "deployment-probe-failed"
  | "unknown-command"
  | "unknown-error"
  | "io-error";

export type CommandError = {
  type: CommandErrorType;
  message: string;
  detail?: unknown;
};

export type CommandOutputEnvelope =
  | {
    ok: true;
    command: CommandName;
    data: AuthOutput | BillingOutput | DeployOutput | SecretSetOutput;
  }
  | { ok: true; help: string }
  | { ok: false; command?: CommandName; error: CommandError };

export class Out {
  #staged: CommandOutputEnvelope | undefined;
  #encoder = new TextEncoder();

  constructor(
    readonly json: boolean,
    private readonly stdout: Pick<
      typeof Deno.stdout,
      "writeSync"
    > = Deno.stdout,
    private readonly stderr: Pick<
      typeof Deno.stderr,
      "writeSync"
    > = Deno.stderr,
  ) {}

  stage(artifact: CommandOutputEnvelope): void {
    this.#staged = artifact;
  }

  write(message: string): void {
    if (!this.json) {
      this.stdout.writeSync(this.#encoder.encode(`${message}\n`));
    }
  }

  error(message: string): void {
    if (!this.json) {
      this.stderr.writeSync(this.#encoder.encode(`${message}\n`));
    }
  }

  flush(): void {
    if (this.json && this.#staged) {
      this.stdout.writeSync(
        this.#encoder.encode(`${JSON.stringify(this.#staged)}\n`),
      );
    }
  }
}

export function commandError(
  type: CommandErrorType,
  message: string,
  detail?: unknown,
): CommandError {
  return detail === undefined ? { type, message } : { type, message, detail };
}

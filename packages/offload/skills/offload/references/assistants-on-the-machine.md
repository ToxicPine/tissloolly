# Coding assistants on the machine

Open-ended hand-offs use `boondoggle` to run a coding assistant on the target machine. The assistant
may be **Codex** or **Claude Code**, depending on machine and user setup. Configure the assistant on
the target once before using this path. If it is not configured, open-ended runs fail before they
start.

A fixed-command hand-off (`nix run github:ToxicPine/tissloolly#foolfad -- -- <cmd>`) does not need
assistant setup. Only the open-ended "let it work toward a goal" path does.

Assistant setup is also what lets the user **check in on a run and steer it** while it is running.

## Configure the assistant

Use the `foolfad-config` skill for assistant setup. It runs `foolfad-configure` over the same
transport `foolfad` uses (`FOOLFAD_TRANSPORT`) and owns target-specific setup.

For Codex, use the `codex` option/target in `foolfad-configure`. For Claude Code, use the
`claude-code` option/target. Follow the `foolfad-config` skill for any account prompts, device-code
flows, API keys, or token handling. Do not duplicate those details in the offload skill.

Setup is saved on the machine's persistent disk, so it should be one-time work for each assistant.

After assistant setup, open-ended hand-offs will work:

```bash
nix run github:ToxicPine/tissloolly#foolfad -- -- bash -lc 'printf "%s" "<task>" | nix run github:ToxicPine/tissloolly#boondoggle'
```

## Checking in and steering a run from your phone

Some assistants have remote-control or session-following features. After assistant setup, the user
may be able to connect from another device, watch the run, send a nudge, or point it somewhere new
without SSHing back into the machine. This is the "check in and steer" path: open-ended work keeps
running on the machine, while the user can inspect or guide it from elsewhere.

These features are assistant-specific. Enable them through that assistant's app, settings, or CLI
docs rather than expecting a fixed offload command here. The offload-side requirement is the setup
above.

If the user wants passive updates rather than hands-on steering, use Telegram pings instead; see
`references/setup-telegram.md`.

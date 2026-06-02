# Coding assistants on the machine

The open-ended hand-off (the `boondoggle` path) runs a coding assistant on the other computer. The
assistant might be **Codex** or **Claude Code**, depending on what the machine and the user are set
up to use. For that to work, the assistant has to be configured on that computer once. If it isn't,
open-ended runs will fail before they start. A fixed-command hand-off (`foolfad -- <cmd>`) doesn't
need this; only the open-ended, "let it work toward a goal" path does.

This is also how the user can **check in on a run and steer it** while it's going.

## Configure the assistant

Use the `foolfad-config` skill for assistant setup. It runs `foolfad-configure` over the same
transport foolfad uses (`FOOLFAD_TRANSPORT`) and owns the target-specific setup flow.

For Codex, use the `codex` option/target in `foolfad-configure`. For Claude Code, use the
`claude-code` option/target. Follow the `foolfad-config` skill for any account prompts, device-code
flows, API keys, or token handling; don't duplicate those details in the offload skill.

The setup is saved on the machine's own disk, the part that survives restarts, so it should be a
one-time step for each assistant.

After assistant setup, open-ended hand-offs will work:

```bash
foolfad -- bash -lc 'printf "%s" "<task>" | boondoggle'
```

## Checking in and steering a run from your phone

Some assistants have remote-control or session-following features. Once the assistant is configured
on the machine, the user may be able to connect from another device and steer it from there — watch
what it's doing, send it a nudge, or point it somewhere new — without having to SSH back into the
machine each time. This is the "check in and steer" path: the open-ended work keeps running on the
machine, but the user can look in on it from wherever they are.

Because these features are assistant-specific, turn them on from that assistant's app/settings or
CLI docs rather than expecting a fixed offload command here. The one requirement on this end is the
setup above.

If the user just wants passive updates rather than hands-on steering, that's what the Telegram
pings are for instead — see `references/setup-telegram.md`.

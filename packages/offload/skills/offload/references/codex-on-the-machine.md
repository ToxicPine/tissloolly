# Using Codex on the machine — signing in, getting in, and steering

The open-ended hand-off (the `boondoggle` path) runs a coding assistant called **Codex** on the
other computer. For that to work, Codex has to be signed in *on that computer* — once. If it
isn't, open-ended runs will fail before they start. A fixed-command hand-off (`foolfad -- <cmd>`)
doesn't need this; only the open-ended, "let it work toward a goal" path does.

This is also how the user can **check in on a run and steer it** while it's going.

## Signing Codex in (one time, with a device code)

You already have a way to run things on the machine: the transport foolfad uses
(`FOOLFAD_TRANSPORT`). Signing Codex in is just one more command run over it — no separate shell to
set up. A normal sign-in would open a browser on the machine, but the machine has no browser, so use
the **device-code** flow, which is built for signing in to a computer you're reaching remotely.

One prerequisite: device-code login has to be allowed on the account first — in ChatGPT,
**Settings → Security → "Allow device code login"** (on a workspace account, a workspace admin has to
enable it). Without it, the command fails with a message telling the user to ask their workspace
admin to enable device code authentication.

Run it straight through the transport:

```bash
echo 'codex login --device-auth' | $FOOLFAD_TRANSPORT
```

Codex prints two things, and they stream back to you:

1. A link to open in a browser.
2. A short one-time code (it expires in about 15 minutes).

The user opens that link on their *own* phone or laptop, signs in to their ChatGPT account, and
enters the code. Codex on the machine finishes signing in on its own and the command returns. Treat
that code like a password while it's valid — don't share it or paste it anywhere except that sign-in
page.

That's it — the sign-in is saved on the machine's own disk, the part that survives restarts, so this
is a one-time thing.

To use an API key instead of a ChatGPT account, don't pass the key on the command line — Codex reads
it from stdin via `codex login --with-api-key`. Put the key in the machine's environment as
`OPENAI_API_KEY` (the same way as the GitHub token, e.g. `ambit secrets set`), then feed it in over
the transport so the key only ever exists on the machine:

```bash
echo 'printenv OPENAI_API_KEY | codex login --with-api-key' | $FOOLFAD_TRANSPORT
```

The transport runs without a terminal, which is fine for device-auth — there's nothing to type on
this end. If the code doesn't stream back, or Codex complains that it needs a terminal, fall back to
an interactive shell and run `codex login --device-auth` there directly:

- ssh / tailscale transports: `ssh <machine>.<network>` (for example `ssh box.lab`) — works from the
  user's own devices on that network, whatever the machine is hosted on.
- fly transport: `fly ssh console --app <app> --machine <machine-id>`.

`<machine>.<network>` is the address this skill reported when it sent work off.

After signing in, open-ended hand-offs will work:

```bash
foolfad -- bash -lc 'printf "%s" "<task>" | boondoggle'
```

## Checking in and steering a run from your phone

Codex has an experimental **remote-control** feature. Once Codex is signed in on the machine, the
user can connect to a running session from Codex on another device (the app or the web) and steer
it from there — watch what it's doing, send it a nudge, or point it somewhere new — without having
to SSH back into the machine each time. This is the "check in and steer" path: the open-ended work
keeps running on the machine, but the user can look in on it from wherever they are.

Because it's experimental, turn it on and connect from the Codex side (the app/its settings) rather
than expecting a fixed command here. The one requirement on this end is the sign-in above — remote
control needs Codex signed in on the machine first.

If the user just wants passive updates rather than hands-on steering, that's what the Telegram
pings are for instead — see `references/setup-telegram.md`.

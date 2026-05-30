# Using Codex on the machine — signing in, getting in, and steering

The open-ended hand-off (the `boondoggle` path) runs a coding assistant called **Codex** on the
other computer. For that to work, Codex has to be signed in *on that computer* — once. If it
isn't, open-ended runs will fail before they start. A fixed-command hand-off (`foolfad -- <cmd>`)
doesn't need this; only the open-ended, "let it work toward a goal" path does.

This is also how the user can **check in on a run and steer it** while it's going.

## Getting into the machine

To sign Codex in, you need a shell on the machine. Two ways in, both reach the same place:

- Over the private network the machine lives on: `ssh <machine>.<network>` (for example
  `ssh box.lab`). This works from the user's own devices — the ones joined to that network — the
  same ones that can open its web links.
- Or through the hosting service's own shell, using the app name from the provisioning steps. (See
  `references/provision-remote-machine.md` for how to get that name.)

`<machine>.<network>` is the address this skill reported when it sent work off.

## Signing Codex in (one time, with a device code)

A normal sign-in opens a browser on the same computer — but the machine has no browser, so use the
**device-code** way instead. It's built for exactly this: signing in on a computer you're reaching
remotely.

On the machine, run:

```bash
codex login --device-auth
```

It prints two things:

1. A link to open in a browser.
2. A short one-time code (it expires in about 15 minutes).

The user opens that link on their *own* phone or laptop, signs in to their ChatGPT account, and
enters the code. Codex on the machine then finishes signing in on its own. Treat that code like a
password while it's valid — don't share it or paste it anywhere except that sign-in page.

That's it — the sign-in is saved on the machine's own disk, the part that survives restarts, so
this is a one-time thing. (If the user signs in with an API key instead of a ChatGPT account, the
equivalent is `codex login --api-key <key>`.)

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

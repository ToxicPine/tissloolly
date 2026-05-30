---
name: offload
description: Use when the user wants to run a long or heavy task on another computer instead of their own — so their own machine stays free, the work keeps going even if they close their laptop or lose their connection, and the finished result comes back to them as a branch in their project, ready to review and merge. If there is no other computer set up yet, this skill helps them set one up.
disable-model-invocation: true   # Claude Code only; Codex ignores it
allowed-tools: Bash, Read         # Claude Code only; Codex ignores it
argument-hint: <plain description of the work to hand off>
---

# Offload

The user wants to take the work below off their own computer and run it somewhere else — so
their own machine is free to do other things, the work keeps running even if they disconnect,
and the result comes back as a branch in their project that they can look over and merge. Your
job is to get the work running cleanly over there. You are not doing the work yourself; you are
handing it off.

Talk to the user like a person. Figure out what you can from their project and their request,
and only stop to ask when there's a real choice to make, or when something costs money or needs
a password or key.

The work to hand off:

> $ARGUMENTS

## The three tools you'll use

These are custom commands the user has installed. They aren't standard tools, so here's what
each one does:

- **foolfad** — run this from inside a git project. It copies the project's current state over to
  the other computer (as a branch named `foolfad/<user>/<run-id>`) and runs the work there. This
  is the hand-off itself. On its own it does not save whatever the work changes — see "Hand it
  off" below for how the results come back.
- **boondoggle** — runs a coding assistant (Codex) on its own toward a goal you give it, working
  until the goal is done, then saving and sending the result back as a branch. Use this (through
  foolfad) when the task is open-ended — "make this feature work" — rather than one exact command.
  Codex has to be signed in on the machine for this to work — a one-time setup, and also how the
  user can check in on a run and steer it from their phone. See `references/codex-on-the-machine.md`.
- **vusperize** — wraps a command so it can send live progress pings to something like Telegram
  while it runs. Optional, nice for long jobs or when the user wants updates. If the user wants
  Telegram pings (or to chat with the agent on the machine from their phone) and that isn't set up
  yet, it's a one-time setup — see `references/setup-telegram.md`.

The "other computer" is a small server. It already has these three tools on it and a disk that
keeps its files between restarts. Your project's own dependencies get rebuilt on it fresh. If no
such computer exists yet, setting one up is a separate one-time job — see
`references/provision-remote-machine.md`. This skill assumes one already exists unless you find
that it doesn't.

## Running the hand-off

**One thing must be installed on the user's own machine: Nix.** The other computer rebuilds the
project's environment from the project's `flake.nix`, and Nix is what makes that work, so it has
to be present here too. If `nix` isn't available, don't give up — tell the user it's needed,
point them at https://install.determinate.systems, and offer to run the installer for them. If
foolfad, boondoggle, or vusperize themselves aren't installed locally, you don't need to stop
either — run them straight from source, e.g.
`nix run github:ToxicPine/tissloolly#foolfad -- …`.

**Check the project will actually work over there.** Have a quick look at `flake.nix` and any
`.envrc`. Ask yourself: if this project gets rebuilt on the other computer, will it have the
dependencies and settings this task needs? A sanity check, not a line-by-line audit. If it looks
incomplete, or there's no `flake.nix` at all, tell the user what you found and offer to fix it
before sending something that's going to break — usually by adding or extending a `devShell`
(with an `.envrc` so it loads on its own). Be careful with secrets: foolfad copies the whole
project over, so any secret the devShell can't provide must not travel as plain text — offer to
encrypt it into a file the other computer can unlock (using `age` or `sops-nix`). Ask before
changing anything.

**Make sure there's actually a computer to send the work to.** This is the key check, and it's
where the user might get confused, so be clear about it:

- First, look at the user's environment for a transport. `FOOLFAD_TRANSPORT` set (e.g.
  `foolfad-ssh box.lab`, `foolfad-tailscale box.lab`, or `foolfad-fly --app … --machine …`) means a
  computer is already set up and pointed to — use it. `FOOLFAD_APP` and `FOOLFAD_MACHINE_ID` both
  set is the older fly-only form and works too (foolfad derives a fly transport from them).
- If none of those are set, say so plainly — something like: *"There's no machine listed in your
  environment to hand this off to. Let me check whether one exists that just isn't pointed to
  yet."* Then go look (see the provisioning doc for how to list what's out there).
- If you still can't find one, don't bury it in jargon. Tell the user straight: *"I can't find a
  machine to hand this off to. Do you want me to set one up? That means renting a small server
  from a hosting service called Fly.io, which costs a little money."* If they say yes, open
  `references/provision-remote-machine.md`, walk through it with them, then come back here.
- If a machine *is* set up but foolfad can't reach the project or send results back, its access
  to GitHub probably needs fixing — that's also in the provisioning doc, in the git section.

**Hand it off.** Once there's a working computer and the project will rebuild over there:

- For one exact command: `foolfad -- <command>`. This runs the command on the branch over there.
  To get any changes it makes back, the command has to save and send them itself — or use the
  open-ended path below, which sends results back for you.
- For an open-ended task: `foolfad -- bash -lc 'printf "%s" "<task>" | boondoggle'`. The coding
  assistant works until it's done and sends what it produced back as a branch. This uses Codex, so
  it has to be signed in on the machine first — if it isn't, the run fails before it starts.
  Signing in is a one-time, device-code step, and once done the user can also check in on the run
  and steer it from another device. Walk through it with `references/codex-on-the-machine.md`.

foolfad moves into the project on the other computer itself, so the environment loads on its own —
you don't need to wrap anything to make that happen. For long jobs or progress pings, wrap the
remote command with vusperize. If the user wants those pings on Telegram and it's the first time,
set it up using `references/setup-telegram.md`.

**Then tell the user, plainly, what happened:** the branch the work will land on, which computer
it's running on and its address (`http://<machine>.<network>`), and that they can check on it
later using the foolfad-target or boondoggle-runs skills.

## Common follow-up questions

After the hand-off, people often ask how to view a dev server or web page running on the other
computer, why an address won't load, or whether anyone else can see it. Answers to those are in
`references/faq.md` — read it before answering.

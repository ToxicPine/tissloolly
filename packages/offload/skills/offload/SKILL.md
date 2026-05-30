---
name: offload
description: Use when the user wants to run a long or heavy task on another computer instead of their own — so their own machine stays free, the work keeps going even if they close their laptop or lose their connection, and the finished result comes back to them as a branch in their project, ready to review and merge. If there is no other computer set up yet, this skill helps them set one up.
disable-model-invocation: true   # Claude Code only; Codex ignores it
allowed-tools: Bash, Read         # Claude Code only; Codex ignores it
argument-hint: <plain description of the work to hand off>
---

# Offload

You are handing the work below off to another computer and getting the result back as a branch in
the user's project. You set it running over there — you don't do the work yourself.

> $ARGUMENTS

Work out what you can from the project and the request. Only stop to ask when there's a real choice
to make, or when something costs money or needs a key.

## The tools

Custom commands, already present on the remote machine:

- **foolfad** — run from inside a git project. Pushes the project's current state to the machine as
  a branch `foolfad/<user>/<run-id>` and runs the work there. It does not save what the work
  changes; results come back only via the open-ended path below, or a command that pushes them
  itself.
- **boondoggle** — runs Codex toward a goal until it's done, then pushes the result back as a
  branch. Use it (through foolfad) for open-ended tasks ("make this feature work") rather than one
  exact command. Codex must be signed in on the machine first — see `references/codex-on-the-machine.md`.
- **vusperize** — wraps a command to send live progress pings (e.g. Telegram) while it runs.
  Optional. First-time Telegram setup: `references/setup-telegram.md`.

The machine keeps its files between restarts; your project's dependencies rebuild on it fresh. If no
machine exists yet, set one up with `references/provision-remote-machine.md`. Otherwise assume one
exists.

## Running the hand-off

**Nix must be installed locally.** The machine rebuilds the project's environment from its
`flake.nix`, which needs Nix here too. If `nix` is missing, point the user at
https://install.determinate.systems and offer to run the installer. If foolfad/boondoggle/vusperize
aren't installed locally, run them from source: `nix run github:ToxicPine/tissloolly#foolfad -- …`.

**Check the project rebuilds over there.** Glance at `flake.nix` and any `.envrc`: will the rebuilt
project have the dependencies and settings this task needs? A sanity check, not an audit. If it's
incomplete or there's no `flake.nix`, tell the user and offer to fix it first — usually by adding or
extending a `devShell` (with an `.envrc` so it loads itself). foolfad copies the whole project, so
any secret the devShell can't provide must not travel as plaintext; offer to encrypt it (`age` or
`sops-nix`). Ask before changing anything.

**Find the machine.** foolfad reaches it through `FOOLFAD_TRANSPORT` (e.g. `foolfad-ssh box.lab`,
`foolfad-tailscale box.lab`, or `foolfad-fly --app … --machine …`).

- If `FOOLFAD_TRANSPORT` is set, use it.
- If not, check whether a machine exists that just isn't pointed to (the provisioning doc shows how
  to list what's out there) and set `FOOLFAD_TRANSPORT` to reach it.
- If none exists, tell the user setting one up means renting a small server from Fly.io, which costs
  a little money. If they agree, walk through `references/provision-remote-machine.md`.
- If a machine is set up but foolfad can't reach the repo or push results back, its GitHub access
  needs fixing — see the git section of the provisioning doc.

**Hand it off.**

- One exact command: `foolfad -- <command>`. Runs on the branch over there; to get changes back, the
  command must push them itself.
- Open-ended task: `foolfad -- bash -lc 'printf "%s" "<task>" | boondoggle'`. Codex works until done
  and pushes the result back as a branch. Requires Codex signed in (`references/codex-on-the-machine.md`).

foolfad enters the project on the machine itself, so the environment loads on its own. For long jobs
or progress pings, wrap the remote command with vusperize.

**Report back:** the branch the work lands on, the machine and its address
(`http://<machine>.<network>`), and that the user can check progress later with the foolfad-target
or boondoggle-runs skills.

## Follow-up questions

For how to view a dev server on the machine, why an address won't load, or who else can see it, read
`references/faq.md` before answering.

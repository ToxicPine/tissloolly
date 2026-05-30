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

Three custom commands. You only ever run the first one — it does everything else for you, on the
other computer.

- **foolfad** — runs here, on the user's own machine, from inside the git project. It pushes the
  project's current state up to the other computer as a branch `foolfad/<user>/<run-id>`, then
  starts the work over there. It doesn't bring results back on its own: a plain command has to push
  whatever it changed itself, while the open-ended path below pushes results back for you.
- **boondoggle** — runs over on the other computer, inside the copied-over project. It puts a coding
  assistant (Codex) to work toward a goal, lets it run until the goal is done, then commits what
  changed and pushes it back on the run branch. Reach for it (through foolfad) when the task is
  open-ended — "make this feature work" — rather than one exact command. Codex has to be signed in
  on that computer first — see `references/codex-on-the-machine.md`.
- **vusperize** — also runs over on the other computer, wrapped around the work so it can send live
  progress pings (for example to Telegram) while the job runs. Optional, nice for long jobs. If the
  user wants Telegram pings and it's not set up yet, see `references/setup-telegram.md`.

So foolfad is the only one the user runs themselves; it reaches the other computer through a
transport (see "Find the machine" below) and runs boondoggle and vusperize over there. That other
computer keeps its files between restarts, rebuilds the project's dependencies fresh each time, and
already has boondoggle, vusperize and the rest installed on it. If there's no such computer yet, set
one up with `references/provision-remote-machine.md`. Otherwise assume one exists.

## Running the hand-off

**Nix must be installed on the user's own machine.** The other computer rebuilds the project's
environment from its `flake.nix`, and Nix is what makes that work, so it has to be here too. If
`nix` is missing, point the user at https://install.determinate.systems and offer to run the
installer. The only pieces that need to be here locally are foolfad and the transport it uses
(`foolfad-ssh`, `foolfad-tailscale`, or `foolfad-fly`) — boondoggle and vusperize live on the other
computer. If foolfad or its transport isn't installed here, run from source, e.g.
`nix run github:ToxicPine/tissloolly#foolfad -- …` (the transports are in the `foolfad-transports`
package).

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

The work starts already inside the project directory over there, so its environment (the devShell,
`.envrc`) loads on its own — you don't need to wrap a `cd` or `nix develop` around it. For long jobs
or progress pings, wrap the command with vusperize, which runs alongside it on the machine.

**Report back:** the branch the work lands on, the machine and its address
(`http://<machine>.<network>`), and that the user can check progress later with the foolfad-target
or boondoggle-runs skills.

## Follow-up questions

For how to view a dev server on the machine, why an address won't load, or who else can see it, read
`references/faq.md` before answering.

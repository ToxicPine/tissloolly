---
name: offload
description: Use when the user wants to run a long or resource-heavy task on another computer so their local machine stays free, the work continues if they close their laptop or lose connection, and the result returns as a reviewable branch in their project. Use this skill also when no offload machine exists yet and the user needs help setting one up.
argument-hint: <plain description of the work to hand off>
---

# Offload

Help the user offload work to another computer, or set up and configure the target computer. A
correct offload preserves the local project's behavior: it rebuilds the same environment from the
project's Nix flake, runs the requested work there, and returns the result as a branch in the user's
project.

You do NOT do the requested work yourself when this skill is invoked. You must start it on the target
machine.

> $ARGUMENTS

Infer what you can from the project and request. Ask only when the choice matters: spending money,
using an online account, choosing between valid target machines, or changing project configuration.

## Supporting Skills

Use supporting skills for specialized work: `foolfad` for the hand-off, `foolfad-config` for remote
GitHub and assistant setup, and `ambit-cli` for provisioning or managing the private machine. If a
skill is missing, try `npx skills --help` and `npx skills add <repo> --list`; `foolfad` and
`foolfad-config` are in `ToxicPine/tissloolly`, and `ambit-cli` is in `ToxicPine/ambit-skills`.

## Tools

Three custom commands are involved. Run only `foolfad` locally; it starts the other commands on the
target machine.

- **foolfad** runs locally, inside the user's git project. It pushes the project's current state to
  the target machine as branch `foolfad/<run-id>`, then starts the remote work. It does not pull
  results back by itself. For a fixed command, that command must push its own changes. For an
  open-ended task, `boondoggle` commits and pushes the result.
- **boondoggle** runs on the target machine, inside the copied project. It gives a coding assistant,
  such as Codex or Claude Code, a goal, lets it run until done, then commits changes and pushes them
  back on the run branch. Use it through `foolfad` when the task is open-ended, such as "make this
  feature work", rather than one exact command. Configure the assistant through `foolfad-config`; see
  `references/assistants-on-the-machine.md`.
- **vusperize** runs on the target machine and wraps the work so it can send live progress pings,
  for example to Telegram. Use it for long jobs or when the user asks for progress updates. If the
  user wants Telegram pings and they are not set up yet, see `references/setup-telegram.md`.

The user runs only `foolfad`. It reaches the target through a transport (see "Find the machine") and
starts `boondoggle` or `vusperize` there. The target machine keeps its files between restarts,
rebuilds project dependencies fresh each run, and has the remote-side tools installed. If no target
machine exists, set one up with `references/provision-remote-machine.md`. Otherwise assume one
exists.

## Running the hand-off

**Use Nix for every local offload command.** Offloading works cleanly only when the target machine
can rebuild the project environment from `flake.nix`. That keeps dependencies and behavior
consistent after the work moves.

If `nix` is installed, use it directly. If `nix` is missing, use the bundled helper
`scripts/nixie-nix.sh` from this skill directory. The helper uses [Nixie](https://github.com/nixie-dev/nixie):
it downloads a generated Nix wrapper into the user's cache, then that wrapper downloads a static Nix
binary into the user's cache and runs Nix without a privileged install. Nixie is alpha software, so
if the fallback fails or the user wants a normal permanent Nix setup, point them at
https://install.determinate.systems and offer to run the installer.

For the rest of this skill, read `nix ...` as either system `nix ...` or, when Nix is unavailable,
`<skill-dir>/scripts/nixie-nix.sh ...`. Resolve `<skill-dir>` as the directory containing this
`SKILL.md`.

Prefer Nix-run invocations for the tissloolly tools in this workflow:
`nix run github:ToxicPine/tissloolly#foolfad -- -- ...` locally, and
`nix run github:ToxicPine/tissloolly#boondoggle` or
`nix run github:ToxicPine/tissloolly#vusperize -- ...` on the target when those commands are not
already installed. Transport adapters are in `foolfad-transports`; use
`nix shell github:ToxicPine/tissloolly#foolfad-transports -c foolfad-tailscale ...` when needed.

**Check the flake offload marker before doing anything with the flake.** Use `nix flake show` (or
`nix flake show --json`) to look for top-level `x-offload`. Treat it as a hint, not a guarantee:

- `"configured"` means an offload worked at some point. Try it; if it breaks because setup drifted,
  move it back to `"untested"` while you re-check the setup, then restore `"configured"` after a
  successful offload.
- `"untested"` means setup was attempted and nothing obvious blocks it, but no successful offload is
  known yet.
- `"none"` means there is a hard reason not to offload, or the user does not want offloading for this
  project. Optionally add `x-offload-none-reason` with a few dense words.

When you become confident the flake will work for offloading, set `x-offload = "untested";`. After a
successful offload, set `x-offload = "configured";`. If you find a real blocker, or the user
declines offloading, set `x-offload = "none";`.

Keep it in `outputs` beside the existing outputs:

```nix
outputs = { self, nixpkgs, ... }: {
  x-offload = "configured";
  # existing outputs...
};
```

**Check that the project rebuilds on the target.** Review `flake.nix` and any `.envrc`: will the
rebuilt project have the dependencies and settings this task needs? This is a sanity check, not an
audit. If setup is incomplete or there is no `flake.nix`, tell the user and offer to fix it first,
usually by adding or extending a `devShell` and `.envrc`. `foolfad` copies the whole project, so any
secret the devShell cannot provide must not travel as plaintext. Offer to encrypt it with `age` or
`sops-nix`. Ask before changing anything.

**Find the machine.** `foolfad` reaches it through `FOOLFAD_TRANSPORT` (for example
`nix shell github:ToxicPine/tissloolly#foolfad-transports -c foolfad-ssh box.lab`,
`nix shell github:ToxicPine/tissloolly#foolfad-transports -c foolfad-tailscale box.lab`, or
`nix shell github:ToxicPine/tissloolly#foolfad-transports -c foolfad-fly --app ... --machine ...`).

- If `FOOLFAD_TRANSPORT` is set, use it.
- If not, check whether a machine already exists but is not selected. The provisioning doc shows how
  to list machines. Set `FOOLFAD_TRANSPORT` to reach the chosen machine.
- If no machine exists, tell the user setup means renting a small server from Fly.io, which costs
  money. If they agree, follow `references/provision-remote-machine.md`.
- If a machine exists but `foolfad` cannot reach the repo or push results back, use
  `foolfad-config` to check and configure its GitHub access.

**Hand it off.**

- One exact command: `nix run github:ToxicPine/tissloolly#foolfad -- -- <command>`. This runs on the
  remote branch. To return changes, the command must commit and push them itself.
- Open-ended task:
  `nix run github:ToxicPine/tissloolly#foolfad -- -- bash -lc 'printf "%s" "<task>" | nix run github:ToxicPine/tissloolly#boondoggle'`.
  The configured assistant works until done, then pushes the result back as a branch. This requires
  an assistant, such as Codex or Claude Code, configured through `foolfad-config`
  (`references/assistants-on-the-machine.md`).

The work starts inside the project directory on the target machine, so the environment (`devShell`,
`.envrc`) loads on its own. Do not wrap the command in `cd` or `nix develop`. For long jobs or
progress pings, wrap the command with `vusperize`, which runs alongside it on the target machine.

**Report back.** Tell the user which branch receives the work, which machine ran it, and how to check
progress later. `foolfad-target` and `boondoggle-runs` are target-side skills. They are useful when
the user talks to an agent on the target machine, for example over Telegram. If the user is local
only, use `FOOLFAD_TRANSPORT` to run a target-side command that asks the remote agent or Codex to
inspect the run and print the answer back locally.

## Follow-up questions

For how to view a dev server on the machine, why an address won't load, or who else can see it, read
`references/faq.md` before answering.

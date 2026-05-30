---
name: foolfad
description: Use for dispatching a command from the current git repo to a remote machine in order to offload work for execution.
---

# Foolfad Dispatch Workflow

Use `foolfad` when the user wants to run a command from the current git repository on a configured remote target machine.

Run it from inside the source repository. The tool pushes the current `HEAD` to the repository remote, pushes a run branch named `foolfad/<run-id>`, connects to the target machine through a transport command, creates or refreshes a target worktree, and runs the requested command there.

Typical usage:

```bash
foolfad -- npm run dev
foolfad -- npm run test
foolfad -- bash scripts/start.sh --port 3000
foolfad --command 'npm run dev'
```

## The transport

foolfad is not tied to any one host. It reaches the machine through a **transport**: a single command whose job is to take a script on its stdin, run it under `bash -s` on the remote, and forward stdout/stderr and the exit status. Set it with `FOOLFAD_TRANSPORT` (or `--transport`). Three adapters ship with the project, and you can point it at anything else that satisfies the contract (e.g. `kubectl exec`):

```bash
export FOOLFAD_TRANSPORT='foolfad-ssh box.lab'              # plain SSH
export FOOLFAD_TRANSPORT='foolfad-tailscale box.lab'        # Tailscale SSH
export FOOLFAD_TRANSPORT='foolfad-fly --app my-app --machine 0123456789'  # Fly.io
foolfad -- npm run test
```

The adapter you name must be on `PATH`. For SSH/Tailscale the argument is the host (the same `<machine>.<network>` the offload skill uses); extra args are passed straight through (ports, identities, jump hosts). foolfad itself knows nothing about any provider — it just pipes the work into whatever the transport names, and there is no default, so a transport must always be set.

## Required Context

Before launching, confirm these are true:

- The current directory is inside the git repository the user wants to dispatch.
- A transport is configured via `FOOLFAD_TRANSPORT` (or `--transport`), and the named transport command is installed.
- The local repo has a usable remote, or `FOOLFAD_REPO_URL` is set explicitly.
- The command is safe to run on the target worktree.

If the repo has no remote, set `FOOLFAD_REPO_URL`. If the desired remote is not the current upstream or `origin`, set `FOOLFAD_REMOTE_NAME`.

## Useful Overrides

- `FOOLFAD_REPO_ROOT` sets the source repo root when `$PWD` is not enough.
- `FOOLFAD_REPO_URL` sets the remote URL pushed to and cloned from.
- `FOOLFAD_REMOTE_NAME` selects which local git remote to use.
- `FOOLFAD_REPO_PATH` overrides the target repo path segment under `repos/`.
- `FOOLFAD_RUN_ID` fixes the run id instead of generating one.
- `FOOLFAD_WORKTREE_NAME` overrides the target worktree directory name. By default it is derived from the run branch, so `foolfad/<run-id>` becomes `foolfad-<run-id>`.
- `FOOLFAD_RUN_BRANCH` overrides the pushed run branch.
- `FOOLFAD_BASE_BRANCH` records the source branch used as the base branch.
- `FOOLFAD_REMOTE_ROOT` changes the target root, defaulting on the remote to `~/.remote-work`.
- `FOOLFAD_TRANSPORT` sets the transport command; `--transport` overrides it per call.

## What To Report

After dispatching, report the command that was launched, the transport (and the host/app it points at), and the branch/worktree identifiers when they are known:

```text
foolfad/<run-id>
~/.remote-work/repos/<repo-path>/foolfad-<run-id>
```

For later status checks on the target machine, use the `foolfad-target` skill.

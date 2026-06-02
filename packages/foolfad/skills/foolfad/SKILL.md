---
name: foolfad
description: Use for dispatching a command from the current git repo to a remote machine in order to offload work for execution.
---

# Foolfad Dispatch Workflow

Use `foolfad` when the user wants a command from the current git repository to run in a matching worktree on a remote target machine.

Run it from inside the source repository. Foolfad pushes the current `HEAD` to the selected repo remote, pushes a run branch named `foolfad/<run-id>`, reaches the target through a transport command, creates or refreshes the target worktree, and runs the requested command there.

Typical usage:

```bash
foolfad -- npm run dev
foolfad -- npm run test
foolfad -- bash scripts/start.sh --port 3000
foolfad --command 'npm run dev'
FOOLFAD_COMMAND='npm run test' foolfad
```

## The transport

Foolfad is provider-agnostic. It reaches the target through a **transport**: one local command that reads a script on stdin, runs it under `bash -s` on the remote, and forwards stdout, stderr, and exit status.

Set the transport with `FOOLFAD_TRANSPORT` or `--transport`. Three adapters ship with the project, and any command with the same stdin/stdout/stderr/exit-status contract can be used:

```bash
export FOOLFAD_TRANSPORT='foolfad-ssh box.lab'              # plain SSH
export FOOLFAD_TRANSPORT='foolfad-tailscale box.lab'        # Tailscale SSH
export FOOLFAD_TRANSPORT='foolfad-fly --app my-app --machine 0123456789'  # Fly.io
foolfad -- npm run test
```

The adapter named in the transport must be on `PATH`. For SSH and Tailscale, the first argument is the host; extra args pass through to the adapter. Foolfad has no default transport, so one must be set before launch.

## Required Context

Before launching, confirm these are true:

- The current directory is inside the git repository the user wants to dispatch.
- A transport is configured via `FOOLFAD_TRANSPORT` (or `--transport`), and the named transport command is installed.
- The source repo has a usable git remote, or `FOOLFAD_REPO_URL` is set explicitly.
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
- `FOOLFAD_REMOTE_DIR`, `FOOLFAD_BARE_DIR`, and `FOOLFAD_WORKTREE_DIR` override the exact remote directories.
- `FOOLFAD_COMMAND` provides a shell command when not using `--command` or `-- COMMAND`.
- `FOOLFAD_TRANSPORT` sets the transport command; `--transport` overrides it per call.

## What To Report

After dispatching, report:

- The command that was launched.
- The run branch and worktree path when known.

```text
foolfad/<run-id>
~/.remote-work/repos/<repo-path>/foolfad-<run-id>
```

For later status checks on the target machine, use the `foolfad-target` skill.

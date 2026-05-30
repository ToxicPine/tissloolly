---
name: foolfad
description: Use for dispatching a command from the current git repo to a remote machine in order to offload work for execution.
---

# Foolfad Dispatch Workflow

Use `foolfad` when the user wants to run a command from the current git repository on a configured remote target machine.

Run it from inside the source repository. The tool pushes the current `HEAD` to the repository remote, pushes a run branch named `foolfad/<user>/<run-id>`, connects to a Fly machine, creates or refreshes a target worktree, and runs the requested command there.

Typical usage:

```bash
foolfad -- npm run dev
foolfad -- npm run test
foolfad -- bash scripts/start.sh --port 3000
foolfad --command 'npm run dev'
```

The target app and machine must be configured:

```bash
export FOOLFAD_APP="fly-app-name"
export FOOLFAD_MACHINE_ID="machine-id"
foolfad -- npm run test
```

## Required Context

Before launching, confirm these are true:

- The current directory is inside the git repository the user wants to dispatch.
- `FOOLFAD_APP` identifies the Fly app that hosts the target machine.
- `FOOLFAD_MACHINE_ID` identifies the target machine.
- The local repo has a usable remote, or `FOOLFAD_REPO_URL` is set explicitly.
- The command is safe to run on the target worktree.

If the repo has no remote, set `FOOLFAD_REPO_URL`. If the desired remote is not the current upstream or `origin`, set `FOOLFAD_REMOTE_NAME`.

## Useful Overrides

- `FOOLFAD_REPO_ROOT` sets the source repo root when `$PWD` is not enough.
- `FOOLFAD_REPO_URL` sets the remote URL pushed to and cloned from.
- `FOOLFAD_REMOTE_NAME` selects which local git remote to use.
- `FOOLFAD_REPO_PATH` overrides the target path segment under `/data/with-runners/repos`.
- `FOOLFAD_USER` changes the user segment in the run branch and worktree path.
- `FOOLFAD_RUN_ID` fixes the run id instead of generating one.
- `FOOLFAD_WORKTREE_NAME` overrides the target worktree path suffix.
- `FOOLFAD_RUN_BRANCH` overrides the pushed run branch.
- `FOOLFAD_BASE_BRANCH` records the source branch used as the base branch.
- `FOOLFAD_WITH_RUNNERS_DIR` changes the target root, defaulting to `/data/with-runners`.

## What To Report

After dispatching, report the command that was launched, the Fly app and machine, and the branch/worktree identifiers when they are known:

```text
foolfad/<user>/<run-id>
/data/with-runners/repos/<repo-path>/worktrees/<user>/<run-id>
```

For later status checks on the target machine, use the `foolfad-target` skill.

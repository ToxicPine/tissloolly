---
name: foolfad-target
description: Use this to inspect long-running tasks the user dispatched to this machine through Foolfad. This is relevant when asks about dispatched task status, dispatched task logs or output, whether a related command is still alive, or what branch/worktree a dispatched run used.
---

# Foolfad Target Task State

You are on the machine where the dispatched command runs. Inspect local files and processes directly, then answer with the concrete state you found.

Foolfad launches a command on this machine using a bare repo and worktree layout.
The source branch is pushed first, then the run branch is pushed as:

```text
foolfad/<run-id>
```

Default target paths are:

```text
~/.remote-work/repos/<repo-path>/.bare
~/.remote-work/repos/<repo-path>/foolfad-<run-id>
```

Useful environment names: `FOOLFAD_REPO_PATH`, `FOOLFAD_REMOTE_ROOT`, `FOOLFAD_WORKTREE_DIR`, and `FOOLFAD_RUN_BRANCH`.

## Inspect Local State

List recent Foolfad worktrees under the remote root:

```bash
root="${FOOLFAD_REMOTE_ROOT:-${HOME}/.remote-work}"
find "$root/repos" -path '*/.git' -not -path '*/.bare/*' -printf '%T@ %h\n' 2>/dev/null \
  | sort -nr \
  | head -20
```

Inspect the selected worktree:

```bash
worktree="${HOME}/.remote-work/repos/gh/OWNER/REPO/foolfad-run-id"
git -C "$worktree" status --short --branch
git -C "$worktree" log -1 --oneline
```

Check recent file activity in a selected worktree:

```bash
find "$worktree" -xdev -type f -printf '%T@ %p\n' 2>/dev/null \
  | sort -nr \
  | head -40
```

Look for a process tied to that worktree:

```bash
pgrep -af "$worktree" || true
ps -eo pid,ppid,etime,stat,cmd --sort=etime | rg -F "$worktree" || true
```

## Local Branch Clues

When working locally in the source repo, these commands often identify the Foolfad run branch or pushed state:

```bash
git branch --list 'foolfad/*'
git log --all --decorate --oneline --grep='Codex Goal Worktree State' -20
git remote -v
```

Foolfad itself runs commands like:

```bash
foolfad -- npm run dev
foolfad --command 'npm run test'
```

Foolfad writes the pushed repo state to a local worktree on this machine and runs the requested command there. It does not create a standard log file or pidfile. If logs are not present as files, say so and report process state, worktree status, last commit, and recent file activity instead.

If the command is a Boondoggle run and the `boondoggle-runs` skill is available, use that skill for Boondoggle-specific activity and completion signals.

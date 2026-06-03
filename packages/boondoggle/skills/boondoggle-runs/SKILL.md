---
name: boondoggle-runs
description: Use when inspecting state, output, completion, or worktree activity for Codex goal runs launched by Boondoggle.
---

# Boondoggle Runs

Use this skill when the user asks about a Boondoggle run or a Codex goal run launched by Boondoggle.

Boondoggle runs a Codex goal from a prompt on stdin. It is often launched through Foolfad, so the worktree and branch may use the Foolfad layout:

```text
~/.remote-work/repos/<repo-path>/foolfad-<run-id>
foolfad/<run-id>
```

## Activity Signals

Useful local checks:

```bash
worktree="${HOME}/.remote-work/repos/gh/OWNER/REPO/foolfad-run-id"
pgrep -af 'boondoggle|codex app-server|codex' || true
ps -eo pid,ppid,etime,stat,cmd --sort=etime | rg -F "$worktree" || true
ps -eo pid,ppid,etime,stat,cmd --sort=etime | rg 'boondoggle|codex app-server' || true
git -C "$worktree" status --short --branch
git -C "$worktree" log -5 --decorate --oneline
find "$worktree" -xdev -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -40
```

## Completion Signals

Boondoggle can commit and push worktree changes on goal success, goal failure, or unexpected exit. By default, publish is enabled for all three outcomes. The default commit subject starts with:

```text
Codex Goal Worktree State: status=<status>
```

The commit body records prompt length, run status, exit status, Codex thread id, and UTC time.

Use these git checks to identify the latest published outcome:

```bash
git -C "$worktree" log --decorate --oneline --grep='Codex Goal Worktree State' -20
git -C "$worktree" log -1 --format=fuller
```

## Reporting

Tell the user what you can verify:

- Whether a related process is still running.
- Current worktree branch, status, and last commit.
- Latest Boondoggle status commit if present.
- Recent file activity.

Boondoggle tracks runs through git commits and live processes, not pidfiles. Report what those signals show instead of looking for a status or pid file.

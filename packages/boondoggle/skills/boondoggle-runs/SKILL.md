---
name: boondoggle-runs
description: Use for inspecting persistent background Codex goal runs launched by Boondoggle from a prompt on stdin. This skill helps you check the current state, output, completion, or worktree activity of an ongoing or completed Boondoggle long-running LLM task.
---

# Boondoggle Runs

Use this skill when the user asks about a boondoggle or a Codex goal run launched by Boondoggle.

Boondoggle runs a Codex goal from a prompt on stdin. It is often launched through Foolfad, so the worktree and branch may follow the Foolfad layout:

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

Boondoggle commits and pushes worktree changes when configured to publish goal success, goal failure, or unexpected exit. Its default commit subject starts with:

```text
Codex Goal Worktree State: status=<status>
```

The commit body records prompt length, status, exit status, Codex thread id, and UTC time.

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

Boondoggle tracks runs through git commits and live processes, not pidfiles, so report what those
show rather than looking for a status or pid file.

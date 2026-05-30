---
name: boondoggle
description: Use for launching long-running LLM tasks that require persistent background work until a given goal or requirements are fulfilled. This skill initiates a new Codex goal run with `boondoggle` from a prompt on stdin.
---

# Boondoggle Workflow

Use `boondoggle` when the user wants to hand a prompt to Codex as a goal and let it run from the current working tree.

Boondoggle reads the prompt from stdin.

```bash
printf '%s\n' 'Implement the requested change and run tests' | boondoggle
```

Run it from the repository or directory that should become the Codex working root. Override that root with `ROOT` when needed:

```bash
ROOT=/path/to/repo printf '%s\n' 'Run the migration checks' | boondoggle
```

## Behavior

Boondoggle starts a Codex app-server session, creates a goal from the stdin prompt, and resumes the thread in the chosen working directory with:

```text
model: gpt-5.5
approvalPolicy: never
sandbox: danger-full-access
```

It prints useful progress events from Codex, including goal and turn status updates.

## Useful Environment

- `ROOT` selects the working directory. It defaults to `$PWD`.
- `BOONDOGGLE_MODEL` overrides the thread model. It defaults to `gpt-5.5`.
- `BOONDOGGLE_APPROVAL_POLICY` overrides the approval policy. It defaults to `never`.
- `BOONDOGGLE_SANDBOX` overrides the thread sandbox. It defaults to `danger-full-access`.
- `BOONDOGGLE_EFFORT` sets the reasoning effort when provided.
- `BOONDOGGLE_PERSONALITY` sets the Codex personality when provided.
- `BOONDOGGLE_SUMMARY` sets the summary preference when provided.
- `BOONDOGGLE_THREAD_CONFIG_JSON` merges an additional JSON object into the `thread/start` and `thread/resume` params. Values in this object override the named defaults.
- `BOONDOGGLE_PROFILE` passes top-level `--profile-v2` to Codex when provided.
- `BOONDOGGLE_LISTEN` passes `--listen` to `codex app-server` when provided.
- `GIT_PUBLISH_ON_GOAL_SUCCESS`, `GIT_PUBLISH_ON_GOAL_FAILURE`, and `GIT_PUBLISH_ON_UNEXPECTED_EXIT` control whether Boondoggle commits and pushes worktree state for those outcomes.
- `GIT_COMMIT_MESSAGE` overrides the status commit subject prefix. It defaults to `Codex Goal Worktree State`.

## Reporting

After launching Boondoggle, report the working root and what prompt or task was started. If the user later asks about progress, use the `boondoggle-runs` skill when it is available.

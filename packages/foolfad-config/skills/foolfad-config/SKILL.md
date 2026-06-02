---
name: foolfad-config
description: Use when configuring or checking remote tool/auth state through a Foolfad transport, especially seeding GitHub CLI and git identity on a remote machine with foolfad-configure.
---

# Foolfad Config Workflow

Use `foolfad-configure` when the user wants to configure known remote targets through a Foolfad-style transport. It is for interactive seeding of remote tool state, not for declarative machine configuration.

The transport is the same contract used by Foolfad transports: a command that reads a bash script from stdin, runs it on the remote under bash, and forwards stdout, stderr, and exit status. Pass it with `--transport` or set `FOOLFAD_CONFIG_TRANSPORT`.

```bash
export FOOLFAD_CONFIG_TRANSPORT='foolfad-ssh box'
foolfad-configure gh check
foolfad-configure gh configure
```

## GitHub Target

The `gh` target checks or configures GitHub CLI auth and global git identity on the remote.

Use `gh check` first when the user asks whether the remote is ready:

```bash
foolfad-configure --transport "foolfad-ssh box" gh check
```

The remote must have `gh`, `git`, and `jq` on `PATH`, and its GitHub CLI config directory and global git config must be writable or creatable.

Use `gh configure` to seed auth and optional identity:

```bash
foolfad-configure --transport "foolfad-ssh box" gh configure \
  --git-user-name "User Name" \
  --git-user-email "user@example.com"
```

If no token is passed, the local command tries `gh auth token --hostname github.com`; if that is unavailable, it starts `gh auth login --hostname github.com --web` locally and then reads the token. The token is sent over the transport to run `gh auth login --with-token` on the remote, followed by `gh auth setup-git`.

For noninteractive or scripted use, pass JSON mode and provide the token explicitly from an environment variable:

```bash
foolfad-configure --json --transport "foolfad-ssh box" gh configure --token "$GITHUB_TOKEN"
```

Do not print or paste token values into the final response. Report only whether configuration succeeded, the transport/remote used, the authenticated account when shown, and the resulting git identity/credential helper fields.

## Useful Options

- `--transport COMMAND STRING` selects the remote transport for one invocation.
- `FOOLFAD_CONFIG_TRANSPORT` provides the default transport command.
- `--json` makes local CLI input/output suitable for automation and disables interactive completion of missing mutation data.
- `gh configure --token TOKEN` supplies the GitHub token directly.
- `gh configure --git-user-name NAME` sets remote global `git config user.name`.
- `gh configure --git-user-email EMAIL` sets remote global `git config user.email`.

## What To Report

After `gh check`, report the remote readiness state and any missing requirement names/details.

After `gh configure`, report:

- The target and command, e.g. `gh configure`.
- The transport target, e.g. `foolfad-ssh box`.
- Whether `gh` is authenticated.
- The GitHub account, host, git user name/email, and credential helper if present.

If the transport fails, say which transport command was used and include the error detail from `foolfad-configure`.

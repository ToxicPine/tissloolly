# foolfad-config

`foolfad-configure` configures known remote targets through a foolfad transport. The current targets
are `gh`, `codex`, and `hermes`.

This tool is intentionally an interactive seeding mechanism, not a declarative remote configuration
system.

Some remote setup can be expressed declaratively, but auth state usually does not fit that model
cleanly. Tokens, credential helpers, account state, refresh behavior, and tool-owned auth files are
often ephemeral artifacts managed by the tool itself. For those cases, the reliable path is to let
the local side gather or create the needed auth/config material, send a narrow validated mutation
over the transport, and then ask the remote tool to apply it in the way it already understands.

```sh
foolfad-configure --transport "foolfad-ssh box" gh check
foolfad-configure --transport "foolfad-ssh box" gh configure
foolfad-configure --json --transport "foolfad-ssh box" gh configure --token "$GITHUB_TOKEN"
foolfad-configure --transport "foolfad-ssh box" codex check
foolfad-configure --transport "foolfad-ssh box" codex configure
foolfad-configure --json --transport "foolfad-ssh box" codex configure --auth-json-file ./auth.json
foolfad-configure --transport "foolfad-ssh box" hermes check
foolfad-configure --transport "foolfad-ssh box" hermes configure
foolfad-configure --transport "foolfad-ssh box" hermes auth
foolfad-configure --json --transport "foolfad-ssh box" hermes configure \
  --config-yaml-file ./config.yaml --env-file ./.env
foolfad-configure --json --transport "foolfad-ssh box" hermes auth \
  --auth-json-file ./auth.json
```

The `codex` target configures remote Codex CLI auth by applying the same `auth.json` artifact Codex
creates for a ChatGPT/device-code login. Interactive configuration runs `codex login --device-auth`
locally under an isolated scratch `CODEX_HOME`, reads only the scratch auth artifact, removes the
scratch home, and applies that artifact remotely. It does not use OpenAI enterprise access-token
handoff, and it does not read or mutate the host's ordinary `~/.codex` credentials.

The `hermes` target configures remote Hermes by applying the text artifacts Hermes keeps in
`HERMES_HOME`: `config.yaml`, `.env`, and `SOUL.md`. Interactive configuration runs `hermes setup`
locally under isolated scratch `HOME` and `HERMES_HOME` values, clears inherited `HERMES_*` process
state for that child, reads only the scratch Hermes artifacts, removes the scratch home, and applies
those artifacts remotely. It does not read or mutate the host's ordinary `~/.hermes` credentials or
config.

Hermes OAuth credentials are a separate `auth.json` artifact. `hermes auth` runs
`hermes auth add nous --type oauth --no-browser` locally under the same isolated scratch home rules,
reads only the scratch `auth.json`, removes the scratch home, and applies that artifact remotely.

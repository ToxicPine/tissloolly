# foolfad-config

`foolfad-configure` configures known remote targets through a foolfad transport. The first target is
`gh`.

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
```

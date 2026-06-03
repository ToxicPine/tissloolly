# hettron-azure

`hettron-azure` is a Deno helper for self-hosting the `hettron` container on
Azure Container Apps. It is interactive by default and uses `--json` for
non-interactive machine use.

## Commands

```sh
hettron-azure authenticate
hettron-azure configure-billing
hettron-azure deploy
hettron-azure set-secret --name telegram-bot-token --value "$TELEGRAM_BOT_TOKEN"
hettron-azure show

hettron-azure --json authenticate < input.json
hettron-azure --json set-secret < secret.json
hettron-azure --json show
```

## State

After selection via authenticate, the tool writes:

```text
~/.hettron/azure/account.json
```

Later commands read that file first.

Secret values passed to `set-secret` are sent to Azure Container Apps and are
not written to local state or command output. Prefer JSON stdin for real secrets
so values do not end up in shell history:

```json
{ "name": "telegram-bot-token", "value": "<token>" }
```

## Extra

Everything else is fixed by Hettron business logic: image, port, Container App
name, Container Apps environment name, managed identity name, storage
account/share names, `/data` and `/nix` volume mounts, and Easy Auth app
registration names are all derived internally.

`deploy` creates or updates a resource group, storage backing, managed identity,
Azure Container Apps environment, Container App, and Microsoft Entra-backed Easy
Auth configuration. The default endpoint is protected by Container Apps built-in
authentication, redirects unauthenticated browsers to sign in, and should be
restricted to the selected account through the generated Easy Auth authorization
configuration.

During deploy, the generated Container App URL is stored as the app-level secret
`hostname` and exposed to the container as the `HOSTNAME` environment variable.
Use `show` to inspect the local setup state and, after deployment, the Container
App FQDN. In JSON mode, `show` returns a discriminated `setupState` value such
as `no-account`, `account-selected`, `subscription-selected`,
`resource-group-exists`, or `container-app-deployed`.

Azure may still require first-time subscription or billing setup through the
portal. Tenant policy may also block app registration or require administrator
consent. In JSON mode, the command fails with a typed error carrying the
relevant setup URL or permission detail; rerunning the command resumes from the
saved account state.

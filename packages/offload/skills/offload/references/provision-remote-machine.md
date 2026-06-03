# Set Up an Azure Target for Offloaded Work

Use this only when no target exists: `FOOLFAD_TRANSPORT` is unset and there is no configured
Hettron Azure deployment. This is one-time setup. It deploys the fixed Hettron container to Azure
Container Apps, then saves the local transport settings `foolfad` needs to reach it.

This can create billable Azure resources and stores credentials on the target. Confirm with the user
before any step that costs money or saves a token, password, or key.

The target is managed with **hettron-azure**:

```bash
nix run github:ToxicPine/tissloolly#hettron-azure -- authenticate
nix run github:ToxicPine/tissloolly#hettron-azure -- configure-billing
nix run github:ToxicPine/tissloolly#hettron-azure -- deploy
```

If local `nix` is missing, run the same arguments through the offload skill's bundled
`scripts/nixie-nix.sh` helper from the skill directory.

## 1. Authenticate to Azure

You can try the `--json` mode when interacting with any of the hettron-azure commands.

Run:

```bash
nix run github:ToxicPine/tissloolly#hettron-azure -- authenticate
```

This uses an isolated Azure CLI config under `~/.hettron/azure/az-config`, not the user's normal
`~/.azure` session. It may launch a device-code login. After account selection it writes
`~/.hettron/azure/account.json` with the selected account email only.

## 2. Select a Subscription

Run:

```bash
nix run github:ToxicPine/tissloolly#hettron-azure -- configure-billing
```

This validates an enabled Azure subscription for the selected account and persists the subscription
ID in `~/.hettron/azure/account.json`. If Azure subscription setup is required, stop and send the
user to the setup URL reported by the command.

## 3. Deploy the Target

Run:

```bash
nix run github:ToxicPine/tissloolly#hettron-azure -- deploy
```

Add `--location <azure-location>` only when the user has a reason to avoid the default `eastus`.

The deploy is idempotent. It creates or updates the deterministic resource group, storage backing for
`/data` and `/nix`, managed identity, Container Apps environment, Container App, and Microsoft
Entra-backed Easy Auth configuration. The Container App name is `hettron-v0`; the resource group is
derived from the selected account and subscription. The public HTTPS endpoint is protected by Easy
Auth and should not expose the app unauthenticated.

Tenant policy may block app registration, service principal creation, or selected-user authorization.
If `hettron-azure` reports a permission or admin-consent error, give the user the exact error and
stop; an Azure tenant administrator may need to approve the deployment.

## 4. Save the Foolfad Transport

`foolfad` reaches Azure Container Apps through `foolfad-azure-container`, which uses
`az containerapp exec`. For the Hettron target, pass `--hettron` so the adapter reads
`~/.hettron/azure/account.json`, derives the resource group, and uses the `hettron-v0` Container App
name.

Set:

```bash
FOOLFAD_TRANSPORT='nix shell github:ToxicPine/tissloolly#foolfad-transports -c foolfad-azure-container --hettron'
```

Save `FOOLFAD_TRANSPORT` somewhere the user's shells load it, such as a shell profile, direnv, or a
secrets manager.

The normal offload setup is the default Hettron target created by this document; use `--hettron` for
that case. Only treat the target as non-default when the user is intentionally pointing at a
different Azure Container App that was not created by `hettron-azure` for this offload flow. In that
case, pass explicit target details:

```bash
FOOLFAD_TRANSPORT='nix shell github:ToxicPine/tissloolly#foolfad-transports -c foolfad-azure-container --subscription <subscription-id> --resource-group <resource-group> --name <container-app>'
```

If the project's git remote is not the one the target should pull from, also set `FOOLFAD_REPO_URL`
and/or `FOOLFAD_REMOTE_NAME`.

## 5. Configure the Target for Offload Work

`foolfad` sends work by pushing a branch to the project's git remote. The target then clones or
fetches that branch, does the work, and, on the open-ended path, pushes results back. Before the
first hand-off, ask the user which code host they use for this project and want configured on the
remote computer: GitHub, GitLab, another Git service, or a public repo that needs no credentials.
The target needs credentials that can read and write the user's repos, plus a name and email for
commits.

Private repo cloning fails unless the matching code host is configured. If the user chooses GitHub,
use the `foolfad-config` skill for this setup. It runs `foolfad-configure` over the same transport
`foolfad` will use:

```bash
nix shell github:ToxicPine/tissloolly#foolfad-config -c foolfad-configure --transport "$FOOLFAD_TRANSPORT" gh check
nix shell github:ToxicPine/tissloolly#foolfad-config -c foolfad-configure --transport "$FOOLFAD_TRANSPORT" gh configure
```

If the user chooses GitLab or another Git service, configure the equivalent remote credentials on the
target before the first hand-off. Do not assume GitHub just because the tooling has a GitHub helper.

Open-ended hand-offs also need the chosen coding assistant, such as Codex or Claude Code, configured
on the target. For open-ended work, use the `foolfad-config` skill to configure the assistant target
the user wants, such as `codex` or `claude-code`. Fixed-command hand-offs do not need an assistant
login.

Credentials and assistant auth state must land on the persistent target storage mounted at `/data`,
or setup must be repeated after every restart.

## 6. Try a Tiny Run Before Anything Real

Do one trivial hand-off end to end before sending important work, e.g. from a test repo:

```bash
nix run github:ToxicPine/tissloolly#foolfad -- -- bash -lc 'echo ok && git rev-parse HEAD'
```

Confirm the run branch shows up and the target reached the repo. Once that is clean, go back to the
offload skill and send the real task.

Secrets rule: anything the _target itself_ needs, such as GitHub tokens or assistant credentials, is
configured on the target through `foolfad-config` or the target's secret mechanism and stays out of
projects. Anything the _work_ needs, such as per-project settings, goes in the project's devShell or
in an encrypted project file (`age` or `sops`). Keep target credentials separate from project
settings.

## Optional: Live Conversational Agent

The deployed target also includes a live Hermes conversational agent for talking to the remote
computer, monitoring tasks, and receiving notifications, for example through Telegram. This is
optional and depends on Codex being configured on the target. If the user wants it, use
`foolfad-config`'s `codex` target to configure Codex first, then see `references/setup-telegram.md`.

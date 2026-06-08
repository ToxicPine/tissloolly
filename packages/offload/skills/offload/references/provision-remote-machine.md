# Set Up a Fly Machine for Offloaded Work

Use this only when no target machine exists: `FOOLFAD_TRANSPORT` is unset and you cannot find an
existing Fly app/machine or user-managed server. This is one-time setup. It rents a small Fly.io
Machine, deploys the offload image, gives it persistent storage, and saves the transport command
`foolfad` needs.

This rents real compute and stores secrets. Confirm with the user before any step that costs money
or saves a token, password, or key.

Use the official Fly.io CLI, `fly`, for provisioning and management through the offload Nixie
dependency environment:

```bash
<skill-dir>/scripts/nix develop <skill-dir>/scripts/deps -c fly ...
```

For brevity, this document writes that prefix as `<offload-nix>`.

## 1. Make sure Fly is available

Check for the CLI and login:

```bash
<offload-nix> fly auth whoami
```

If that fails because Nixie or the dependency environment itself is broken, inspect
`<skill-dir>/scripts/nix` and `<skill-dir>/scripts/deps/flake.nix`. If Fly is not logged in, run
`<offload-nix> fly auth login`. If the user does not have an account, `<offload-nix> fly auth signup`
is also available.

## 2. Pick the app name and region

Offer the user two app-name choices before creating anything:

- Generate a pseudorandom name with a 12-character lowercase alphanumeric suffix, for example
  `offload-<suffix>`.
- Use a Fly app name of their own choice.

For the generated option, use the existing OpenSSL dependency:

```bash
suffix="$(<offload-nix> openssl rand -hex 6)"
app="offload-${suffix}"
```

Beyond this required name choice, ask only when the name affects billing, ownership, or sharing.

Pick a region close to where the user normally works. If unsure, run
`<offload-nix> fly platform regions` and use a nearby region. The template
currently defaults to `lhr`; override it during launch if another region is better.

## 3. Get the deployable template

Deploy from the opinionated template branch:

```bash
git clone --depth 1 --branch opinionated https://github.com/ToxicPine/hermes-ambit.git <workdir>
cd <workdir>
```

The template contains `fly.toml`, points at the ready-made offload image, mounts persistent storage
at `/data`, and exposes the agent/proxy service on Fly. Keep this checkout outside the user's project
unless they explicitly want to vendor the machine definition.

## 4. Create the Fly app without deploying

Run launch from the template checkout:

```bash
<offload-nix> fly launch --copy-config --no-deploy --name <app> --primary-region <region> --ha=false
```

Use `--org <org>` if the user needs a non-default Fly organization. `--copy-config` tells Fly to use
the existing `fly.toml`; `--no-deploy` lets you set secrets before the first Machine starts.

The `fly.toml` includes a `/data` volume mount. Fly creates the volume when the first deploy creates
the Machine. That persistent volume is what keeps GitHub credentials, assistant auth, repo caches,
and agent state across deploys and restarts.

## 5. Set machine-level secrets

Set secrets on the Fly app, not in any project repo:

```bash
<offload-nix> fly secrets set -a <app> HOSTNAME=<app>.fly.dev
```

Always generate and set a fresh Nestail auth secret before the first deploy:

```bash
secret="$(<offload-nix> openssl rand -hex 32)"
<offload-nix> fly secrets set -a <app> NESTAIL_AUTH_SECRET="$secret"
unset secret
```

`NESTAIL_AUTH_SECRET` enables Nestail's auth gate for public route URLs and transport requests. Do
not print it, commit it, paste it into docs, or reuse an example value.

The secret belongs to the remote machine. Authenticated Nestail route links must be generated on that
machine, not locally. After the machine is deployed and `FOOLFAD_TRANSPORT` is set, run `nestail
token <port> <path>` through the transport, or ask the Telegram conversational agent on the machine
to generate the link:

```bash
printf '%s\n' 'nestail token 3000 /dashboard' | bash -c "$FOOLFAD_TRANSPORT"
```

Never copy `NESTAIL_AUTH_SECRET` back to the local shell just to generate links.

Use `<offload-nix> fly secrets set -a <app> KEY=value` for any other
machine-level credentials. Fly injects these as runtime environment variables. `fly secrets set`
restarts existing Machines, so prefer setting initial secrets before the first deploy when possible.

Do not put project-specific secrets here unless the machine itself needs them. Project secrets belong
in the project devShell or an encrypted project file such as `age` or `sops`.

## 6. Deploy the machine

From the template checkout:

```bash
<offload-nix> fly deploy -a <app>
```

After deploy, check the app and find the Machine ID:

```bash
<offload-nix> fly status -a <app>
<offload-nix> fly machine list -a <app>
```

If Fly creates more than one Machine and this is meant to be a single persistent offload target,
choose one Machine and avoid spreading state across multiple volumes. Ask the user before destroying
extra Machines or volumes, because that can delete state.

## 7. Save the foolfad transport

Set `FOOLFAD_TRANSPORT` to the full Nixie-backed Fly transport so it works even when `foolfad-fly`
is not globally installed:

```bash
export FOOLFAD_TRANSPORT='<skill-dir>/scripts/nix develop <skill-dir>/scripts/deps -c foolfad-fly --app <app> --machine <machine-id>'
```

Save it somewhere the user's shells load it, such as a shell profile, direnv, etc.

## 8. Configure GitHub and assistants before any hand-off

`foolfad` sends work by pushing a branch to the project's git remote. The machine then clones or
fetches that branch, does the work, and, on the open-ended path, pushes results back. The machine
needs GitHub credentials that can read and write the user's repos, plus a name and email for commits.
Open-ended hand-offs also need the chosen coding assistant, such as Codex or Claude Code, configured
on the machine. Private repo cloning fails without GitHub setup, so configure this before the first
real hand-off.

Use the `foolfad-config` skill for this setup. It runs `foolfad-configure` over the same transport
`foolfad` will use:

```bash
<skill-dir>/scripts/nix shell github:ToxicPine/tissloolly#foolfad-config -c foolfad-configure --transport "$FOOLFAD_TRANSPORT" gh check
<skill-dir>/scripts/nix shell github:ToxicPine/tissloolly#foolfad-config -c foolfad-configure --transport "$FOOLFAD_TRANSPORT" gh configure
```

For open-ended work, configure the assistant target the user wants, such as `codex` or `claude-code`.
Follow the `foolfad-config` skill for account prompts, device-code flows, API keys, and token
handling. Credentials and assistant auth state must land on `/data` so they survive restarts.

## 9. Try a tiny run before anything real

Do one trivial hand-off end to end before sending important work, e.g. from a test repo:

```bash
<skill-dir>/scripts/nix run github:ToxicPine/tissloolly#foolfad -- -- bash -lc 'echo ok && git rev-parse HEAD'
```

Confirm the run branch shows up and the machine reached the repo. Once that is clean, go back to the
offload skill and send the real task.

## Maintenance commands

Use official Fly commands for routine checks:

- `<offload-nix> fly status -a <app>`: app state and Machines summary.
- `<offload-nix> fly logs -a <app>`: app logs.
- `<offload-nix> fly machine list -a <app>`: Machine IDs.
- `<offload-nix> fly ssh console -a <app> --machine <machine-id>`: interactive shell.
- `<offload-nix> fly ssh console -a <app> --machine <machine-id> -C '<command>'`: run one command.
- `<offload-nix> fly secrets list -a <app>` and `<offload-nix> fly secrets set -a <app> KEY=value`: secret names and updates.
- `<offload-nix> fly volumes list -a <app>`: persistent volumes.

Secrets rule: anything the machine itself needs, such as tokens or keys, goes in Fly app secrets
with `<offload-nix> fly secrets set -a <app> ...` and stays out of projects.
Anything the work needs, such as per-project settings, goes in the project's devShell or in an
encrypted project file.

When attaching to an existing Fly app, run `fly secrets list -a <app>` and confirm
`NESTAIL_AUTH_SECRET` is present. If it is missing, generate it with
`<offload-nix> openssl rand -hex 32` and set it with
`<offload-nix> fly secrets set -a <app> NESTAIL_AUTH_SECRET="$secret"` before
handing off work. Tell the user that adding or changing Fly secrets can restart the Machine.

For existing apps too, generate authenticated Nestail links on the remote target through
`FOOLFAD_TRANSPORT` or the Telegram agent. The local machine should not need to know the auth secret.

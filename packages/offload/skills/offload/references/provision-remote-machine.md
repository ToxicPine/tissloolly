# Set Up a Computer for Offloaded Work

Use this only when no target machine exists: `FOOLFAD_TRANSPORT` is unset and you cannot find an
existing machine. This is one-time setup. It rents a small private server, configures it for
offloaded work, and saves the settings `foolfad` needs to find it later.

This rents a real server and stores secrets. Confirm with the user before any step that costs money
or saves a token, password, or key.

The server is managed with **ambit** (`npx @cardelli/ambit`). It puts the server on a private
network that only the user's devices can reach. The server starts from a ready-made image with the
hand-off tools installed and persistent disk storage.

Fly.io is the hosting service underneath. The user does not need to understand it or log into it
directly; `ambit` handles it. Mention Fly.io only when the user must make a real decision, such as
accepting cost or providing a credential.

## 1. Make sure ambit is logged in
Run `npx @cardelli/ambit auth whoami`. If it is not logged in, run `npx @cardelli/ambit auth login`.
Login needs a Fly.io token and a Tailscale key. Help the user get them if needed.

## 2. Pick names, together with the user
Choose a machine name and network name. They combine as `<machine>.<network>`, for example
`box.lab`. If the user does not care, suggest names and continue.

One rule matters: the deploy name, `HOSTNAME` value, and final address must be the exact same text.
If they differ, machine web links will not work.

## 3. Make sure the network exists
Run `npx @cardelli/ambit status networks`. If `<network>` isn't in the list, create it:
`npx @cardelli/ambit create <network>`.

## 4. Deploy the machine from its GitHub template
The machine definition lives in a separate project. Deploy it from the branch with `ambit` template
mode:
`npx @cardelli/ambit deploy <machine>.<network> --template ToxicPine/hermes-ambit@opinionated`

Use template mode exactly as shown. Do not use image-only mode: it writes a bare config without the
`/data` volume, so the machine would lose state after restart.

The `ToxicPine/hermes-ambit` image also includes a live Hermes conversational agent for
Telegram-based interaction with the computer, monitoring tasks on it, notifications, etc. That part
is optional: it relies on authenticated Codex on the machine. If the user wants it, use the
`foolfad-config` skill for Codex setup once its `codex` target is available, then see
`references/setup-telegram.md`.

## 5. Set the machine hostname
Set `HOSTNAME` after deployment so the machine's web links match the private address:
`npx @cardelli/ambit secrets set <machine>.<network> HOSTNAME=<machine>.<network>`

The deploy name, `HOSTNAME` value, and final address must all be the exact same text.

## 6. Configure the machine for offload work (do this before any hand-off)
`foolfad` sends work by pushing a branch to the project's git remote. The machine then clones or
fetches that branch, does the work, and, on the open-ended path, pushes results back. The machine
needs GitHub credentials that can read and write the user's repos, plus a name and email for commits.
Open-ended hand-offs also need the chosen coding assistant, such as Codex or Claude Code, configured
on the machine. **Private repo cloning fails without GitHub setup**, so configure this before the
first hand-off.

Use the `foolfad-config` skill for this setup. It runs `foolfad-configure` over the same transport
`foolfad` will use. This is the command you will save as `FOOLFAD_TRANSPORT` in step 7. You can use
the adapter directly now, e.g. `foolfad-tailscale <machine>.<network>` or
`foolfad-fly --app <app> --machine <machine-id>`.

- **GitHub.** Use `foolfad-configure gh check` first, then `foolfad-configure gh configure` with the
  git user name and email the machine should use for commits. The `foolfad-config` skill covers
  token handling and what to report.

- **Coding assistants.** For open-ended work, use the `foolfad-config` skill to configure the
  assistant target the user wants, such as `codex` or `claude-code`. Fixed-command hand-offs do not
  need an assistant login.

Credentials and assistant auth state must land on the part of the disk that survives restarts (the
provisioned image keeps HOME/config on `/data`; a hand-rolled box must arrange the same), or setup
must be repeated after every restart.

## 7. Save the settings foolfad needs
`foolfad` reaches the machine through a **transport**: a command that runs work on the target. Choose
how to connect:

- **Tailscale SSH (recommended here):** the machine is already on the user's private Tailscale network
  as `<machine>.<network>`, so set
  `FOOLFAD_TRANSPORT='foolfad-tailscale <machine>.<network>'` (for example
  `foolfad-tailscale box.lab`). Plain SSH works the same way with `foolfad-ssh <machine>.<network>`
  if the user prefers, or for a machine reachable over regular SSH.
- **Fly:** `npx @cardelli/ambit status app <machine>.<network> --json` — note the Fly app name and
  the machine id, then set `FOOLFAD_TRANSPORT='foolfad-fly --app <app> --machine <machine-id>'`.

Whichever transport you choose, the adapter (`foolfad-ssh`, `foolfad-tailscale`, or `foolfad-fly`)
must be on the user's `PATH`. Save `FOOLFAD_TRANSPORT` somewhere their shells load it, such as a
shell profile, direnv, or a secrets manager.

- If the project's git remote isn't the one the machine should pull from, also set
  `FOOLFAD_REPO_URL` (the URL to push to and clone from) and/or `FOOLFAD_REMOTE_NAME`.

## 8. Try a tiny run before anything real
Do one trivial hand-off end to end before sending important work, e.g. from a test repo:
`foolfad -- bash -lc 'echo ok && git rev-parse HEAD'`. Confirm the run branch shows up and the
machine reached the repo. Once that's clean, go back to the offload skill and send the real task.

If the user plans to use the open-ended path (`boondoggle`), configure the coding assistant on the
machine through the `foolfad-config` skill. See `references/assistants-on-the-machine.md` for how the
offload docs refer to assistant setup.

Secrets rule: anything the *machine itself* needs, such as tokens or keys, goes in
`ambit secrets set` and stays out of projects. Anything the *work* needs, such as per-project
settings, goes in the project's devShell or in an encrypted project file (`age` or `sops`). Keep
machine credentials separate from project settings.

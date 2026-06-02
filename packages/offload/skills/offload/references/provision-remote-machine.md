# Setting up a computer to hand work off to

Only do this when there's no computer set up yet — that is, when `FOOLFAD_TRANSPORT` is unset and
you couldn't find an existing machine. It's a one-time setup.
It does three things: it rents a small private server, configures that server for offloaded work,
and saves the few settings that let foolfad find it later.

This rents a real server and stores some passwords/keys, so check with the user before each step
that either costs money or saves a secret.

The server is set up with a tool called **ambit** (`npx @cardelli/ambit`). It puts the server on a
private network that only the user's own devices can reach. The server starts from a ready-made
image that already has the hand-off tools on it and a disk that survives restarts.

A note on Fly.io: it's the hosting service the server actually runs on. The user doesn't need to
understand it or log into it directly — ambit handles it. Mention it only where the user has to
make a real decision (like "this costs money") or hand over a credential.

## 1. Make sure ambit is logged in
Run `npx @cardelli/ambit auth whoami`. If it's not logged in, run `ambit auth login` — that needs
a Fly.io token and a Tailscale key. Help the user get those if they don't have them.

## 2. Pick names, together with the user
Choose a name for the machine and a name for the network. They get joined as
`<machine>.<network>` (for example `box.lab`). If the user doesn't care, suggest something and
move on. One rule that matters: the name used to deploy, the name set as the machine's hostname,
and the address you give back at the end must all be the exact same text — otherwise the
machine's web links won't work.

## 3. Make sure the network exists
Run `npx @cardelli/ambit status networks`. If `<network>` isn't in the list, create it:
`npx @cardelli/ambit create <network>`.

## 4. Deploy the machine from its GitHub template
The machine's definition lives in a separate project. Deploy it directly from the branch with
ambit's template mode:
`npx @cardelli/ambit deploy <machine>.<network> --template ToxicPine/hermes-ambit@opinionated`

Use template mode as shown. Don't use the image-only mode — it writes a bare config that leaves out
the `/data` volume, and the machine would lose everything every time it restarts.

## 5. Set the machine hostname
Set `HOSTNAME` after deployment so the machine's web links match the private address:
`npx @cardelli/ambit secrets set <machine>.<network> HOSTNAME=<machine>.<network>`

The name used to deploy, the `HOSTNAME` value, and the address you give back at the end must all be
the exact same text.

## 6. Configure the machine for offload work (do this before any hand-off)
foolfad sends work by pushing it to the project's git remote; the machine then clones/fetches that
branch, does the work, and (on the open-ended path) pushes the results back. So the machine needs
GitHub credentials that can read and write the user's repos, plus a name and email for its commits.
Open-ended hand-offs also need the chosen coding assistant, such as Codex or Claude Code, configured
on the machine. **Cloning a private repo fails without GitHub setup**, so configure the machine
before the first hand-off.

Use the `foolfad-config` skill for this setup. It runs `foolfad-configure` over the same transport
foolfad will use. That's the command you'll save as `FOOLFAD_TRANSPORT` in step 7; you can use the
adapter directly now, e.g. `foolfad-tailscale <machine>.<network>` or
`foolfad-fly --app <app> --machine <machine-id>`.

- **GitHub.** Use `foolfad-configure gh check` first, then `foolfad-configure gh configure` with the
  git user name and email the machine should use for commits. The `foolfad-config` skill covers
  token handling and what to report.

- **Coding assistants.** For open-ended work, use the `foolfad-config` skill to configure the
  assistant target the user wants, such as `codex` or `claude-code`.
  Fixed-command hand-offs do not need an assistant login.

Credentials and assistant auth state must land on the part of the disk that survives restarts (the
provisioned image keeps HOME/config on `/data`; a hand-rolled box must arrange the same), or you'll
redo this after every restart.

## 7. Save the settings foolfad needs
foolfad reaches the machine through a **transport** — a command that runs work on the remote. You
choose how to connect:

- **Tailscale SSH (recommended here):** the machine is already on the user's private Tailscale
  network as `<machine>.<network>`, so set
  `FOOLFAD_TRANSPORT='foolfad-tailscale <machine>.<network>'` (for example
  `foolfad-tailscale box.lab`). Plain SSH works the same way with `foolfad-ssh <machine>.<network>`
  if the user prefers, or for a machine reachable over regular SSH.
- **Fly:** `npx @cardelli/ambit status app <machine>.<network> --json` — note the Fly app name and
  the machine id, then set `FOOLFAD_TRANSPORT='foolfad-fly --app <app> --machine <machine-id>'`.

Whichever you pick, the named adapter (`foolfad-ssh`, `foolfad-tailscale`, `foolfad-fly`) must be on
the user's `PATH`, and the setting must be saved somewhere their shells pick it up (shell profile,
direnv, or a secrets manager) so none of this has to be done again.

- If the project's git remote isn't the one the machine should pull from, also set
  `FOOLFAD_REPO_URL` (the URL to push to and clone from) and/or `FOOLFAD_REMOTE_NAME`.

## 8. Try a tiny run before anything real
Do one trivial hand-off end to end before sending anything important, e.g. from a test repo:
`foolfad -- bash -lc 'echo ok && git rev-parse HEAD'`. Confirm the run branch shows up and the
machine reached the repo. Once that's clean, go back to the offload skill and send the real task.

If the user plans to use the open-ended path (`boondoggle`), configure the coding assistant on the
machine through the `foolfad-config` skill. See `references/assistants-on-the-machine.md` for how the
offload docs refer to assistant setup.

A note on where secrets go: anything the *machine itself* needs (tokens, keys) goes in
`ambit secrets set`, kept out of any project. Anything the *work* needs (per-project settings)
goes in the project's devShell, or encrypted into a file in the project (age/sops) as the offload
skill describes. Keeping those two separate keeps the machine's credentials apart from project
settings.

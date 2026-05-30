# Setting up a computer to hand work off to

Only do this when there's no computer set up yet — that is, when `FOOLFAD_APP` and
`FOOLFAD_MACHINE_ID` are both unset and you couldn't find an existing one. It's a one-time setup.
It does three things: it rents a small private server, gives that server access to GitHub so it
can fetch the user's work and send results back, and saves the few settings that let foolfad find
it later.

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

## 4. Build the machine's config
The machine's definition lives in a separate project. Read it straight off its branch instead of
keeping your own copy:
`git clone -q --branch opinionated --depth 1 https://github.com/ToxicPine/hermes-ambit /tmp/hambit`

Take `/tmp/hambit/fly.toml` and write a copy to `/tmp/offload-fly.toml` with two changes:

- Add a build section that pins the ready-made image:

      [build]
        image = "cardelli/container-agent:latest-opinionated"

- Set its `HOSTNAME` to the `<machine>.<network>` name from step 2.

Leave everything else as it is — especially the `/data` volume mount. That mount is what lets the
machine keep its files (projects, caches, credentials) when it restarts.

## 5. Deploy
`npx @cardelli/ambit deploy <machine>.<network> --config /tmp/offload-fly.toml`

Deploy from the config file as shown. Don't use the image-only mode — it writes a bare config
that leaves out the `/data` volume, and the machine would lose everything every time it restarts.

## 6. Give the machine access to GitHub (do this before any hand-off)
foolfad sends work by pushing it to the project's git remote; the machine then fetches that
branch, does the work, and (on the open-ended path) pushes the results back. So the machine needs
git set up with credentials that can read and write the user's repos, plus a name and email to
attach to its commits:

- Give it a GitHub token for the repos that'll be handed off (a fine-grained token with contents
  read/write, or a per-repo deploy key). Store it as a machine secret, never in a project:
  `npx @cardelli/ambit secrets set <machine>.<network> GITHUB_TOKEN=<token>`.
- On the machine itself, set git up to use that token and give it an identity. Get into the
  machine's shell over Tailscale SSH to `<machine>.<network>`, or Fly SSH using the Fly app name
  from step 7. Set a credential helper that hands the token to github.com, and set
  `git config --global user.name` and `user.email` so its commits are attributed. (A deploy key
  is the alternative: add the public key to the repo and put the private key in the machine's SSH
  config.)
- Check it works: from the machine, fetch the target repo, push to a throwaway branch, confirm it
  worked, then delete that branch.

## 7. Save the settings foolfad needs
foolfad finds the machine through environment variables:

- `npx @cardelli/ambit status app <machine>.<network> --json` — note the Fly app name and the
  machine id.
- Set `FOOLFAD_APP` to the app name and `FOOLFAD_MACHINE_ID` to the machine id, and save them
  somewhere the user's shells will pick them up (shell profile, direnv, or a secrets manager) so
  none of this has to be done again.
- If the project's git remote isn't the one the machine should pull from, also set
  `FOOLFAD_REPO_URL` (the URL to push to and clone from) and/or `FOOLFAD_REMOTE_NAME`.
  `FOOLFAD_USER` changes the user part of the run branch name if a different one is wanted.

## 8. Try a tiny run before anything real
Do one trivial hand-off end to end before sending anything important, e.g. from a test repo:
`foolfad -- bash -lc 'echo ok && git rev-parse HEAD'`. Confirm the run branch shows up and the
machine reached the repo. Once that's clean, go back to the offload skill and send the real task.

A note on where secrets go: anything the *machine itself* needs (tokens, keys) goes in
`ambit secrets set`, kept out of any project. Anything the *work* needs (per-project settings)
goes in the project's devShell, or encrypted into a file in the project (age/sops) as the offload
skill describes. Keeping those two separate keeps the machine's credentials apart from project
settings.

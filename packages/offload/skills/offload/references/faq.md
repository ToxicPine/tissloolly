# Offload FAQ

Short answers to common follow-up questions. Keep replies plain: explain the idea, avoid jargon.

## "How do I see the dev server (or web page) of something I offloaded?"

The work is running in the Hettron Azure container, so its dev server is running there, not on the
user's local machine. `localhost:3000` points at the user's own machine, where nothing is running.

The Hettron target has a small web proxy that lets the user reach services running in the container.
Put the port number at the start of the path, after the Hettron URL. A dev server on port `3000`
becomes:

```text
https://<hettron-url>/3000/
```

Anything after the port, such as paths, query strings, or `#` anchors, goes after it:

```text
dev server at localhost:3000/         ->  https://<hettron-url>/3000/
dev server at localhost:5173/app      ->  https://<hettron-url>/5173/app
dev server at localhost:8000/a?x=1    ->  https://<hettron-url>/8000/a?x=1
```

`<hettron-url>` is the public Azure Container Apps URL for the Hettron target. It is guarded by
Microsoft Easy Auth for the selected account, not by Tailscale or a private network. Refresh, links,
back/forward, and live connections (websockets) work through it, so it behaves like the real dev
server after the user signs in with that Microsoft account.

If the exact URL is unclear, query the Container App FQDN from Azure, then append the port path.
`foolfad-target` can tell which port the run is listening on.

## "I opened the address and nothing loads."

Check these common causes first:

- **The work has to actually be running a server.** The proxy only shows something if a dev server
  is up and listening on that port in the target container. If the task finished, or never started a
  server, there is nothing to show. Check whether it is still running; `foolfad-target` can look.
- **You have to be signed in.** The Azure URL is protected by Microsoft Easy Auth and restricted to
  the selected account. A browser that is not signed in may redirect to Microsoft login or receive an
  authorization error.
- **Right port, in the path.** Double-check the port number, and that it is in the path (`/3000/`),
  not attached to the address like `:3000`.
- **The server has to listen inside the container.** Most dev servers do by default. If one was
  told to bind to a specific outside address, it may not be reachable through the proxy. Have it
  listen on localhost or `0.0.0.0` in the container.

## "Where do I find the Hettron URL?"

For the default Azure target, query the Container App FQDN from the saved Hettron deployment:

```bash
az containerapp show --resource-group <resource-group> --name hettron-v0 --query properties.configuration.ingress.fqdn --output tsv
```

If the resource group is lost, `foolfad-azure-container --hettron` derives it from
`~/.hettron/azure/account.json`; `hettron-azure deploy` also reports it after deployment.

## "Can anyone else see my dev server?"

The Azure URL is public, but the Hettron deployment enables Microsoft Easy Auth and restricts access
to the selected account. Do not treat it like an unprotected localhost URL; do treat it as the
intended way to view offloaded web work from any browser where the user can sign in.

## "Can I point this at my own server instead of Azure?"

Yes. `foolfad` reaches the target through a transport command set in `FOOLFAD_TRANSPORT`, usually
with the transport adapters from Nix:
`nix shell github:ToxicPine/tissloolly#foolfad-transports -c foolfad-azure-container --subscription <id> --resource-group <group> --name <app>`,
`nix shell github:ToxicPine/tissloolly#foolfad-transports -c foolfad-tailscale <host>`,
`nix shell github:ToxicPine/tissloolly#foolfad-transports -c foolfad-ssh <host>`, or
`nix shell github:ToxicPine/tissloolly#foolfad-transports -c foolfad-fly --app ... --machine ...`.
If local `nix` is missing, run those same arguments through the offload skill's
`scripts/nixie-nix.sh` helper.
Any box reachable over SSH or Tailscale SSH can still be a custom target. Set the transport to point
at it. That is a different model from the default Hettron Azure target, whose user-facing URL is
public and protected by Microsoft sign-in.

A hand-rolled box needs the pieces the provisioned image normally supplies:

- A writable home directory that survives restarts.
- Repo storage. By default `foolfad` keeps repos under `~/.remote-work`, with `.bare` beside
  branch-named worktree directories.
- Git credentials that can read and write the user's repos, configured through `foolfad-config`.
- For open-ended `boondoggle` work or progress pings, `boondoggle` and `vusperize` installed, plus
  the chosen assistant configured through `foolfad-config`.
- For web URLs like `https://<hettron-url>/<port>/`, a proxy equivalent to the provisioned
  setup.

Fixed-command hand-offs (`nix run github:ToxicPine/tissloolly#foolfad -- -- <command>`) only need
persistent home storage and GitHub access.

## "How do I check on the work itself — progress, logs, whether it's done?"

That is separate from viewing a web page. Other skills handle it: `foolfad-target` for the state of
a handed-off run in the target, and `boondoggle-runs` for an open-ended coding-assistant run's
progress and completion.

Those are target-side skills. If the user is already talking to an agent in the target, for example
through Telegram, that agent should use them directly. If you only have the local machine,
use the saved `FOOLFAD_TRANSPORT` to ask the target-side agent or Codex to answer from the target and
print the result locally. Finished code still comes back as the branch this skill reported.

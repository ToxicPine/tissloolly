# Offload FAQ

Short answers to common follow-up questions. Keep replies plain: explain the idea, avoid jargon.

## "How do I see the dev server (or web page) of something I offloaded?"

The work is running on another computer, so its dev server is running there, not on the user's local
machine. `localhost:3000` points at the user's own machine, where nothing is running.

The target machine has a small web proxy that lets the user reach services running on it. Put the
port number at the start of the path, after the machine address. A dev server on port `3000` becomes:

```text
http://<machine>.<network>/3000/
```

Anything after the port, such as paths, query strings, or `#` anchors, goes after it:

```text
dev server at localhost:3000/         ->  http://<machine>.<network>/3000/
dev server at localhost:5173/app      ->  http://<machine>.<network>/5173/app
dev server at localhost:8000/a?x=1    ->  http://<machine>.<network>/8000/a?x=1
```

`<machine>.<network>` is the address of the target machine, the same one this skill reported back
(for example `box.lab`). Refresh, links, back/forward, and live connections (websockets) work through
it, so it behaves like the real dev server.

If the exact URL is unclear, the agent on the target machine can work it out. Its
`nestail-service-urls` skill turns a port into the right link, and `foolfad-target` can tell which
port the run is listening on.

## "I opened the address and nothing loads."

Check these common causes first:

- **The work has to actually be running a server.** The proxy only shows something if a dev server
  is up and listening on that port on the target machine. If the task finished, or never started a
  server, there is nothing to show. Check whether it is still running; `foolfad-target` can look.
- **You have to be on the private network.** The machine's address only works from the user's own
  devices, the ones joined to the private network (Tailscale) the machine lives on. From a device
  that is not joined, the address will not resolve. This keeps the machine private.
- **Right port, in the path.** Double-check the port number, and that it is in the path (`/3000/`),
  not attached to the address like `:3000`.
- **The server has to listen on the machine itself.** Most dev servers do by default. If one was
  told to bind to a specific outside address, it may not be reachable through the proxy. Have it
  listen on localhost or `0.0.0.0` on the machine.

## "Where do I find the machine's address?"

It is the `<machine>.<network>` name, such as `box.lab`. This skill reported it when it sent the
work off. If it is lost, the agent on the machine can read it back from the machine hostname.

## "Can anyone else see my dev server?"

No. The machine sits on a private network that only the user's devices can reach. The
`http://<machine>.<network>/...` links are not public URLs.

## "Can I point this at my own server instead of Fly?"

Yes. `foolfad` reaches the machine through a transport command set in `FOOLFAD_TRANSPORT`, usually
with the transport adapters from Nix:
`nix shell github:ToxicPine/tissloolly#foolfad-transports -c foolfad-tailscale <host>`,
`nix shell github:ToxicPine/tissloolly#foolfad-transports -c foolfad-ssh <host>`, or
`nix shell github:ToxicPine/tissloolly#foolfad-transports -c foolfad-fly --app ... --machine ...`.
If local `nix` is missing, run those same arguments through the offload skill's
`scripts/nixie-nix.sh` helper.
Any box reachable over SSH or Tailscale SSH can be the target. Set the transport to point at it.

A hand-rolled box needs the pieces the provisioned image normally supplies:

- A writable home directory that survives restarts.
- Repo storage. By default `foolfad` keeps repos under `~/.remote-work`, with `.bare` beside
  branch-named worktree directories.
- Git credentials that can read and write the user's repos, configured through `foolfad-config`.
- For open-ended `boondoggle` work or progress pings, `boondoggle` and `vusperize` installed, plus
  the chosen assistant configured through `foolfad-config`.
- For web URLs like `http://<machine>.<network>/<port>/`, a proxy equivalent to the provisioned
  setup.

Fixed-command hand-offs (`nix run github:ToxicPine/tissloolly#foolfad -- -- <command>`) only need
persistent home storage and GitHub access.

## "How do I check on the work itself — progress, logs, whether it's done?"

That is separate from viewing a web page. Other skills handle it: `foolfad-target` for the state of
a handed-off run on the machine, and `boondoggle-runs` for an open-ended coding-assistant run's
progress and completion.

Those are target-side skills. If the user is already talking to an agent on the machine, for
example through Telegram, that agent should use them directly. If you only have the local machine,
use the saved `FOOLFAD_TRANSPORT` to ask the target-side agent or Codex to answer from the target and
print the result locally. Finished code still comes back as the branch this skill reported.

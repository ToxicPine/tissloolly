# Offload FAQ

Short answers to things people ask after they've handed work off. Keep your replies in plain
language — explain the idea, don't list jargon.

## "How do I see the dev server (or web page) of something I offloaded?"

The work is running on another computer, so its dev server is running over there, not on the
user's own machine. They can't just open `localhost:3000` — that would point at their own machine,
where nothing is running.

The other computer has a small built-in web proxy that lets the user reach anything running on it
through a browser. The trick is: **take the port number and put it at the front of the path,
after the machine's address.** So a dev server on port `3000` over there becomes:

```text
http://<machine>.<network>/3000/
```

Anything after the port — paths, query strings, `#` anchors — goes right after it:

```text
dev server at localhost:3000/         ->  http://<machine>.<network>/3000/
dev server at localhost:5173/app      ->  http://<machine>.<network>/5173/app
dev server at localhost:8000/a?x=1    ->  http://<machine>.<network>/8000/a?x=1
```

`<machine>.<network>` is the address of the computer the work was sent to (the same one this skill
reported back, e.g. `box.lab`). Refresh, links, back/forward, and live connections (websockets)
all work through it, so it behaves like the real dev server.

If you're not sure of the exact URL, the agent on the other computer can build it for you — that's
what its `nestail-service-urls` and `foolfad-target` skills are for. It knows the machine's address
and which port the server is on.

## "I opened the address and nothing loads."

A few usual reasons, easiest to check first:

- **The work has to actually be running a server.** The proxy only shows something if a dev server
  is up and listening on that port over there. If the task finished, or never started a server,
  there's nothing to show. Check whether it's still running (the `foolfad-target` skill can look).
- **You have to be on the private network.** The machine's address only works from the user's own
  devices — the ones joined to the private network (Tailscale) the machine lives on. From a device
  that isn't joined, the address simply won't resolve. This is on purpose: it keeps the machine
  private.
- **Right port, in the path.** Double-check the port number, and that it's in the path
  (`/3000/`), not stuck onto the address like `:3000`.
- **The server has to listen on the machine itself.** Most dev servers do by default. If one was
  told to bind to a specific outside address, it may not be reachable through the proxy — having
  it listen on localhost/`0.0.0.0` on the machine fixes that.

## "Where do I find the machine's address?"

It's the `<machine>.<network>` name — the address this skill reported when it sent the work off
(for example `box.lab`). If you've lost it, the agent on the machine can read it back: it's the
machine's own hostname.

## "Can anyone else see my dev server?"

No. The machine sits on a private network that only the user's own devices can reach, so the
`http://<machine>.<network>/...` links work for them and no one else. They're not public URLs.

## "Can I point this at my own server instead of Fly?"

Yes. foolfad reaches the machine through a transport command, and you set which one with
`FOOLFAD_TRANSPORT` — `foolfad-tailscale <host>`, `foolfad-ssh <host>`, or
`foolfad-fly --app … --machine …`. So any box you can reach over SSH (or Tailscale SSH) can be the
target; just set the transport to point at it.

One caveat for a hand-rolled box (one you set up yourself rather than through the provisioning
doc): the convenient parts the provisioned image gives you for free aren't automatic. The box needs
a writable `/data` directory that survives restarts (that's where repos and worktrees live), git
set up with credentials that can read and write the user's repos, and — if you want the open-ended
`boondoggle` path or progress pings — `boondoggle`/`vusperize` installed and Codex signed in on the
machine. Fixed-command hand-offs (`foolfad -- <command>`) only need `/data` and git; the rest is
just for the open-ended path. The web proxy and the `http://<machine>.<network>/<port>/` links
above come from the provisioned setup too, so a bare SSH box won't have them unless you add one.

## "How do I check on the work itself — progress, logs, whether it's done?"

That's a different question from viewing a web page, and it's handled by other skills:
`foolfad-target` for the state of a handed-off run on the machine, and `boondoggle-runs` for an
open-ended (coding-assistant) run's progress and when it finishes. The finished result comes back
as the branch this skill reported.

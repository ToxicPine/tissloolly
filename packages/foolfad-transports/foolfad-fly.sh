#!/usr/bin/env bash
set -euo pipefail

# foolfad transport adapter: Fly.io machines.
#
# Reads a script on stdin and runs it under "bash -s" on a Fly machine via
# "fly ssh console", forwarding stdout/stderr and propagating the remote exit
# status. Everything passed in is handed to "fly ssh console" as-is (typically
# --app and --machine); this adapter only appends the --command that runs the
# shell, hiding Fly's flag form so the transport contract matches ssh/tailscale:
#
#   foolfad-fly --app my-app --machine 0123456789
#
# Used via foolfad's transport mechanism, e.g.
#   FOOLFAD_TRANSPORT='foolfad-fly --app my-app --machine 0123456789' foolfad -- npm run dev

if [[ $# -lt 1 ]]; then
  echo "foolfad-fly: usage: foolfad-fly --app APP --machine MACHINE_ID [fly-ssh-console-option...]" >&2
  exit 2
fi

exec fly ssh console "$@" --command "bash -s"

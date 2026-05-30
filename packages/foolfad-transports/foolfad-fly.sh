#!/usr/bin/env bash
set -euo pipefail

# foolfad transport: run the script on stdin under `bash -s` on a Fly machine.
# Args go to `fly ssh console`; this only appends --command to match the
# ssh/tailscale contract, e.g. 'foolfad-fly --app my-app --machine 0123456789'.

if [[ $# -lt 1 ]]; then
  echo "foolfad-fly: usage: foolfad-fly --app APP --machine MACHINE_ID [fly-ssh-console-option...]" >&2
  exit 2
fi

exec fly ssh console "$@" --command "bash -s"

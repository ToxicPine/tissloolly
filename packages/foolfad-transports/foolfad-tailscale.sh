#!/usr/bin/env bash
set -euo pipefail

# foolfad transport: run the script on stdin under `bash -s` over Tailscale SSH.
# Args go to `tailscale ssh` as-is, e.g. 'foolfad-tailscale box.lab' (MagicDNS name).

if [[ $# -lt 1 ]]; then
  echo "foolfad-tailscale: usage: foolfad-tailscale DESTINATION [ssh-option...]" >&2
  exit 2
fi

exec tailscale ssh "$@" bash -s

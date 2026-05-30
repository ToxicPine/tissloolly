#!/usr/bin/env bash
set -euo pipefail

# foolfad transport adapter: Tailscale SSH.
#
# Reads a script on stdin and runs it under "bash -s" on the remote host over
# Tailscale, forwarding stdout/stderr and propagating the remote exit status.
# The destination is the machine's MagicDNS name (the same <machine>.<network>
# the offload skill uses), plus any extra "tailscale ssh" options:
#
#   foolfad-tailscale box.lab
#
# Used via foolfad's transport mechanism, e.g.
#   FOOLFAD_TRANSPORT='foolfad-tailscale box.lab' foolfad -- npm run dev

if [[ $# -lt 1 ]]; then
  echo "foolfad-tailscale: usage: foolfad-tailscale DESTINATION [ssh-option...]" >&2
  exit 2
fi

exec tailscale ssh "$@" bash -s

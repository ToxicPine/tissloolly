#!/usr/bin/env bash
set -euo pipefail

# foolfad transport adapter: plain SSH.
#
# Reads a script on stdin and runs it under "bash -s" on the remote host,
# forwarding stdout/stderr and propagating the remote exit status. Everything
# passed in is handed to ssh as-is (destination plus any ssh options), so you
# can add ports, identities or a jump host:
#
#   foolfad-ssh box.lab
#   foolfad-ssh -p 2222 -i ~/.ssh/box user@box.lab
#
# Used via foolfad's transport mechanism, e.g.
#   FOOLFAD_TRANSPORT='foolfad-ssh box.lab' foolfad -- npm run dev

if [[ $# -lt 1 ]]; then
  echo "foolfad-ssh: usage: foolfad-ssh DESTINATION [ssh-option...]" >&2
  exit 2
fi

exec ssh "$@" bash -s

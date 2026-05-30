#!/usr/bin/env bash
set -euo pipefail

# foolfad transport: run the script on stdin under `bash -s` on an SSH host.
# Args go to ssh as-is, e.g. FOOLFAD_TRANSPORT='foolfad-ssh box.lab'.

if [[ $# -lt 1 ]]; then
  echo "foolfad-ssh: usage: foolfad-ssh DESTINATION [ssh-option...]" >&2
  exit 2
fi

exec ssh "$@" bash -s

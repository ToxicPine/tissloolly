#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: nixie-nix.sh <nix-arguments...>

Run Nix for the offload workflow. If system Nix is installed, this delegates to
it. Otherwise it downloads the Nixie generated Nix wrapper into a user cache and
runs through that wrapper.

Environment:
  OFFLOAD_NIXIE_FORCE=1        Use Nixie even when system Nix exists.
  OFFLOAD_NIXIE_REF=master     Git ref for nixie-dev/nixie.
  OFFLOAD_NIXIE_URL=<url>      Override the generated wrapper URL.
  OFFLOAD_NIXIE_CACHE=<dir>    Override the helper cache directory.
  OFFLOAD_NIX_FEATURES=<text>  Experimental features to enable.
EOF
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

if [ "$#" -eq 0 ]; then
  usage >&2
  exit 64
fi

features="${OFFLOAD_NIX_FEATURES:-nix-command flakes}"

if [ "${OFFLOAD_NIXIE_FORCE:-0}" != "1" ] && command -v nix >/dev/null 2>&1; then
  exec nix --extra-experimental-features "$features" "$@"
fi

cache_root="${OFFLOAD_NIXIE_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/offload-nixie}"
wrapper="${cache_root}/nix"
ref="${OFFLOAD_NIXIE_REF:-master}"
url="${OFFLOAD_NIXIE_URL:-https://raw.githubusercontent.com/nixie-dev/nixie/${ref}/nix}"

download() {
  mkdir -p "$cache_root"
  tmp="$(mktemp "${cache_root}/nix.XXXXXX")"
  trap 'rm -f "$tmp"' EXIT

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$tmp"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$tmp" "$url"
  else
    echo "nix is not installed, and neither curl nor wget is available to fetch Nixie." >&2
    exit 69
  fi

  if ! head -n 1 "$tmp" | grep -q "bash" || ! grep -q "ARCHIVE SECTION" "$tmp"; then
    echo "Downloaded Nixie wrapper from $url did not look like a Nix script." >&2
    exit 70
  fi

  chmod +x "$tmp"
  mv "$tmp" "$wrapper"
  trap - EXIT
}

if [ ! -x "$wrapper" ]; then
  download
fi

export EXTRA_FEATURES="${EXTRA_FEATURES:-$features}"

if command -v realpath >/dev/null 2>&1; then
  wrapper_argv0="$(realpath --relative-to="$PWD" "$wrapper" 2>/dev/null || printf '%s' "$wrapper")"
else
  wrapper_argv0="$wrapper"
fi

BASH_ARGV0="$wrapper_argv0"
export BASH_ARGV0
# Source instead of exec so BASH_ARGV0 controls the wrapper's $0. Current Nixie
# wrappers fail self-extraction when invoked by absolute path.
set +e +u +o pipefail
source "$wrapper" "$@"
status="$?"
exit "$status"

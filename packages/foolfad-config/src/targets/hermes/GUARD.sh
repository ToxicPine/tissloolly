#!/usr/bin/env bash
set -euo pipefail

missing=()

require_command() {
  local name="$1"
  if ! command -v "${name}" >/dev/null 2>&1; then
    missing+=("${name}")
  fi
}

require_command hermes
require_command jq

hermes_home="${HERMES_HOME:-${HOME}/.hermes}"
config_yaml="${hermes_home}/config.yaml"
env_file="${hermes_home}/.env"
soul_md="${hermes_home}/SOUL.md"
auth_json="${hermes_home}/auth.json"

if [[ -e "${hermes_home}" && ! -d "${hermes_home}" ]]; then
  missing+=("hermes-home-creatable")
elif [[ -e "${hermes_home}" && ! -w "${hermes_home}" ]]; then
  missing+=("hermes-home-writable")
elif [[ ! -e "${hermes_home}" ]]; then
  hermes_home_parent="$(dirname "${hermes_home}")"
  while [[ ! -e "${hermes_home_parent}" && "${hermes_home_parent}" != "/" ]]; do
    hermes_home_parent="$(dirname "${hermes_home_parent}")"
  done
  if [[ ! -d "${hermes_home_parent}" || ! -w "${hermes_home_parent}" ]]; then
    missing+=("hermes-home-creatable")
  fi
fi

if [[ -e "${config_yaml}" && ! -w "${config_yaml}" ]]; then
  missing+=("hermes-config-writable")
fi

if [[ -e "${env_file}" && ! -w "${env_file}" ]]; then
  missing+=("hermes-env-writable")
fi

if [[ -e "${soul_md}" && ! -w "${soul_md}" ]]; then
  missing+=("hermes-soul-writable")
fi

if [[ -e "${auth_json}" && ! -w "${auth_json}" ]]; then
  missing+=("hermes-auth-writable")
fi

if [[ "${#missing[@]}" -eq 0 ]]; then
  printf '{"ok":true}\n'
  exit 0
fi

printf '{"ok":false,"error":{"type":"missing-requirements","detail":['
sep=""
for name in "${missing[@]}"; do
  case "${name}" in
    hermes|jq)
      detail="not found on PATH"
      ;;
    hermes-home-writable)
      detail="Hermes home is not writable"
      ;;
    hermes-home-creatable)
      detail="Hermes home cannot be created"
      ;;
    hermes-config-writable)
      detail="Hermes config.yaml is not writable"
      ;;
    hermes-env-writable)
      detail="Hermes .env is not writable"
      ;;
    hermes-soul-writable)
      detail="Hermes SOUL.md is not writable"
      ;;
    hermes-auth-writable)
      detail="Hermes auth.json is not writable"
      ;;
    *)
      detail="unavailable"
      ;;
  esac
  printf '%s{"name":"%s","detail":"%s"}' "${sep}" "${name}" "${detail}"
  sep=","
done
printf ']}}\n'

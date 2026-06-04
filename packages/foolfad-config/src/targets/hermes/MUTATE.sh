#!/usr/bin/env bash
set -euo pipefail

payload="$(cat)"
mutation_type="$(printf '%s' "${payload}" | jq -r '.type')"

case "${mutation_type}" in
  configure) ;;
  *)
    printf 'unknown mutation type: %s\n' "${mutation_type}" >&2
    exit 2
    ;;
esac

hermes_home="${HERMES_HOME:-${HOME}/.hermes}"
tmp_dir="$(mktemp -d)"

cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

file_count="$(printf '%s' "${payload}" | jq '.files | length')"

for index in $(seq 0 $((file_count - 1))); do
  path="$(printf '%s' "${payload}" | jq -r ".files[${index}].path")"
  case "${path}" in
    config.yaml|.env|SOUL.md|auth.json) ;;
    *)
      printf 'unsupported Hermes artifact path: %s\n' "${path}" >&2
      exit 2
      ;;
  esac

  printf '%s' "${payload}" | jq -j ".files[${index}].content" > "${tmp_dir}/${path}"
  if [[ "${path}" == "auth.json" ]]; then
    jq -e . "${tmp_dir}/${path}" >/dev/null
  fi
done

mkdir -p "${hermes_home}"
chmod 700 "${hermes_home}"

for path in config.yaml .env SOUL.md auth.json; do
  if [[ -f "${tmp_dir}/${path}" ]]; then
    cp "${tmp_dir}/${path}" "${hermes_home}/${path}"
    chmod 600 "${hermes_home}/${path}"
  fi
done

config_yaml="${hermes_home}/config.yaml"
env_file="${hermes_home}/.env"
soul_md="${hermes_home}/SOUL.md"
auth_json="${hermes_home}/auth.json"

configured=false
config_yaml_present=false
env_file_present=false
soul_md_present=false
auth_json_present=false

if [[ -f "${config_yaml}" ]]; then
  config_yaml_present=true
  configured=true
fi

if [[ -f "${env_file}" ]]; then
  env_file_present=true
  configured=true
fi

if [[ -f "${soul_md}" ]]; then
  soul_md_present=true
fi

if [[ -s "${auth_json}" ]]; then
  auth_json_present=true
fi

jq -n \
  --argjson configured "${configured}" \
  --arg hermesHome "${hermes_home}" \
  --argjson configYamlPresent "${config_yaml_present}" \
  --argjson envFilePresent "${env_file_present}" \
  --argjson soulMdPresent "${soul_md_present}" \
  --argjson authJsonPresent "${auth_json_present}" \
  '{
    configured: $configured,
    hermesHome: $hermesHome,
    configYamlPresent: $configYamlPresent,
    envFilePresent: $envFilePresent,
    soulMdPresent: $soulMdPresent,
    authJsonPresent: $authJsonPresent
  }'

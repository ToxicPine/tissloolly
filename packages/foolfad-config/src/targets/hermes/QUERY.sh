#!/usr/bin/env bash
set -euo pipefail

hermes_home="${HERMES_HOME:-${HOME}/.hermes}"
config_yaml="${hermes_home}/config.yaml"
env_file="${hermes_home}/.env"
soul_md="${hermes_home}/SOUL.md"

configured=false
config_yaml_present=false
env_file_present=false
soul_md_present=false

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

jq -n \
  --argjson configured "${configured}" \
  --arg hermesHome "${hermes_home}" \
  --argjson configYamlPresent "${config_yaml_present}" \
  --argjson envFilePresent "${env_file_present}" \
  --argjson soulMdPresent "${soul_md_present}" \
  '{
    configured: $configured,
    hermesHome: $hermesHome,
    configYamlPresent: $configYamlPresent,
    envFilePresent: $envFilePresent,
    soulMdPresent: $soulMdPresent
  }'

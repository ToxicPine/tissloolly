#!/usr/bin/env bash
set -euo pipefail

# foolfad transport: run the script on stdin in an Azure Container App container.
# Generic by default; --hettron opts into defaults from ~/.hettron/azure/account.json.

usage() {
  cat <<'USAGE'
Usage: foolfad-azure-container [options]

Run a foolfad transport script inside an Azure Container App with
`az containerapp exec`.

Options:
  --hettron                  Use hettron-azure state and defaults.
  --subscription ID          Azure subscription ID.
  --resource-group NAME      Azure resource group.
  --name NAME                Container App name.
  --revision NAME            Optional Container Apps revision.
  --replica NAME             Optional Container Apps replica.
  --container NAME           Optional container name.
  -h, --help                 Show this help.

Environment overrides:
  FOOLFAD_AZURE_SUBSCRIPTION
  FOOLFAD_AZURE_RESOURCE_GROUP
  FOOLFAD_AZURE_CONTAINER_APP
  FOOLFAD_AZURE_REVISION
  FOOLFAD_AZURE_REPLICA
  FOOLFAD_AZURE_CONTAINER
  HETTRON_AZURE_ACCOUNT_STATE

Example:
  export FOOLFAD_TRANSPORT='foolfad-azure-container --subscription ... --resource-group ... --name ...'
  export FOOLFAD_TRANSPORT='foolfad-azure-container --hettron'
USAGE
}

die() {
  echo "foolfad-azure-container: $*" >&2
  exit 1
}

shell_quote_word() {
  local word="$1"

  printf "'"
  while [[ "${word}" == *"'"* ]]; do
    printf "%s'\\''" "${word%%\'*}"
    word="${word#*\'}"
  done
  printf "%s'" "${word}"
}

shell_quote_command() {
  local word sep=""

  for word in "$@"; do
    printf "%s" "${sep}"
    shell_quote_word "${word}"
    sep=" "
  done
  printf "\n"
}

state_path() {
  printf '%s\n' "${HETTRON_AZURE_ACCOUNT_STATE:-${HOME}/.hettron/azure/account.json}"
}

read_state_field() {
  local field="$1" path value
  path="$(state_path)"

  if [[ ! -f "${path}" ]]; then
    die "Hettron Azure account state not found: ${path}"
  fi
  if ! value="$(jq -er "${field}" "${path}")"; then
    die "could not read ${field} from Hettron Azure account state: ${path}"
  fi
  printf '%s\n' "${value}"
}

derive_resource_group() {
  local account_email subscription_id hash

  account_email="$(read_state_field '.accountEmail')"
  subscription_id="$(read_state_field '.subscriptionId')"
  account_email="${account_email,,}"
  subscription_id="${subscription_id,,}"
  hash="$(printf '%s%s' "${account_email}" "${subscription_id}" | sha256sum | awk '{print $1}')"
  printf 'hettron-v0-%s\n' "${hash:0:12}"
}

subscription="${FOOLFAD_AZURE_SUBSCRIPTION:-}"
resource_group="${FOOLFAD_AZURE_RESOURCE_GROUP:-}"
container_app="${FOOLFAD_AZURE_CONTAINER_APP:-}"
revision="${FOOLFAD_AZURE_REVISION:-}"
replica="${FOOLFAD_AZURE_REPLICA:-}"
container="${FOOLFAD_AZURE_CONTAINER:-}"
hettron=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hettron)
      hettron=1
      shift
      ;;
    --subscription)
      [[ $# -ge 2 ]] || die "--subscription requires a value"
      subscription="$2"
      shift 2
      ;;
    --subscription=*)
      subscription="${1#*=}"
      shift
      ;;
    --resource-group|-g)
      [[ $# -ge 2 ]] || die "--resource-group requires a value"
      resource_group="$2"
      shift 2
      ;;
    --resource-group=*)
      resource_group="${1#*=}"
      shift
      ;;
    --name|-n)
      [[ $# -ge 2 ]] || die "--name requires a value"
      container_app="$2"
      shift 2
      ;;
    --name=*)
      container_app="${1#*=}"
      shift
      ;;
    --revision)
      [[ $# -ge 2 ]] || die "--revision requires a value"
      revision="$2"
      shift 2
      ;;
    --revision=*)
      revision="${1#*=}"
      shift
      ;;
    --replica)
      [[ $# -ge 2 ]] || die "--replica requires a value"
      replica="$2"
      shift 2
      ;;
    --replica=*)
      replica="${1#*=}"
      shift
      ;;
    --container)
      [[ $# -ge 2 ]] || die "--container requires a value"
      container="$2"
      shift 2
      ;;
    --container=*)
      container="${1#*=}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

if [[ "${hettron}" == "1" && -z "${container_app}" ]]; then
  container_app="hettron-v0"
fi
if [[ "${hettron}" == "1" && -z "${subscription}" ]]; then
  subscription="$(read_state_field '.subscriptionId')"
fi
if [[ "${hettron}" == "1" && -z "${resource_group}" ]]; then
  resource_group="$(derive_resource_group)"
fi

[[ -n "${subscription}" ]] \
  || die "no subscription configured; pass --subscription, set FOOLFAD_AZURE_SUBSCRIPTION, or use --hettron"
[[ -n "${resource_group}" ]] \
  || die "no resource group configured; pass --resource-group, set FOOLFAD_AZURE_RESOURCE_GROUP, or use --hettron"
[[ -n "${container_app}" ]] \
  || die "no Container App name configured; pass --name, set FOOLFAD_AZURE_CONTAINER_APP, or use --hettron"

az_args=(
  "containerapp"
  "exec"
  "--subscription"
  "${subscription}"
  "--resource-group"
  "${resource_group}"
  "--name"
  "${container_app}"
)

if [[ -n "${revision}" ]]; then
  az_args+=("--revision" "${revision}")
fi
if [[ -n "${replica}" ]]; then
  az_args+=("--replica" "${replica}")
fi
if [[ -n "${container}" ]]; then
  az_args+=("--container" "${container}")
fi

sentinel="__FOOLFAD_AZURE_CONTAINER_EXIT_${RANDOM}_${RANDOM}__"
exit_file="$(mktemp)"
trap 'rm -f "${exit_file}"' EXIT

remote_command=$(cat <<REMOTE
set -euo pipefail
stty -echo 2>/dev/null || true
script="\$(mktemp)"
cat > "\${script}"
set +e
bash "\${script}"
code=\$?
rm -f "\${script}"
echo
echo "${sentinel}\${code}"
exit 0
REMOTE
)
remote_command_q="$(shell_quote_word "${remote_command}")"
az_command="$(shell_quote_command az "${az_args[@]}" --command "bash -c ${remote_command_q}")"

set +e
script -q -e -c "${az_command}" /dev/null 2>&1 \
  | while IFS= read -r line; do
      line="${line%$'\r'}"
      case "${line}" in
        "${sentinel}"*)
          printf '%s\n' "${line#"${sentinel}"}" > "${exit_file}"
          ;;
        *)
          printf '%s\n' "${line}"
          ;;
      esac
    done
script_status=${PIPESTATUS[0]}
set -e

if [[ ! -s "${exit_file}" ]]; then
  if [[ ${script_status} -ne 0 ]]; then
    exit "${script_status}"
  fi
  die "remote command did not report an exit status"
fi

remote_status="$(<"${exit_file}")"
if [[ ! "${remote_status}" =~ ^[0-9]+$ ]]; then
  die "invalid remote exit status: ${remote_status}"
fi

exit "${remote_status}"

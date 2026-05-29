#!/usr/bin/env bash
set -euo pipefail

readonly FOOLFAD_DEFAULT_USER="user"

new_run_id() {
  local timestamp

  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr "[:upper:]" "[:lower:]"
  else
    timestamp="$(date -u +%Y%m%d-%H%M%S)"
    printf '%s-%s%s\n' "${timestamp}" "${RANDOM}" "${RANDOM}"
  fi
}

die() {
  echo "foolfad: $*" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage: foolfad [options] -- COMMAND [ARG...]

Launch a command in a worktree for the git repo containing $PWD.

Options:
  --command COMMAND               Shell command to run from the worktree.

Provide a command with --command, FOOLFAD_COMMAND, or -- COMMAND [ARG...].

Examples:
  foolfad -- npm run dev
  foolfad -- bash scripts/start.sh --port 3000
  foolfad --command 'npm run dev'

Other useful env overrides:
  FOOLFAD_REPO_ROOT, FOOLFAD_REPO_URL, FOOLFAD_REMOTE_NAME, FOOLFAD_REPO_PATH,
  FOOLFAD_APP, FOOLFAD_MACHINE_ID, FOOLFAD_USER, FOOLFAD_RUN_ID, FOOLFAD_WORKTREE_NAME, 
  FOOLFAD_RUN_BRANCH, FOOLFAD_BASE_BRANCH, FOOLFAD_WITH_RUNNERS_DIR, 
  FOOLFAD_REMOTE_DIR, FOOLFAD_BARE_DIR, FOOLFAD_WORKTREE_DIR, FOOLFAD_COMMAND, 
  FOOLFAD_CONFIG
USAGE
}

COMMAND_MODE=
RUN_COMMAND=()

if [[ -n "${FOOLFAD_COMMAND:-}" ]]; then
  COMMAND_MODE=shell
  RUN_COMMAND=("${FOOLFAD_COMMAND}")
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --command)
      [[ $# -ge 2 ]] || die "--command requires a value"
      COMMAND_MODE=shell
      RUN_COMMAND=("$2")
      shift 2
      ;;
    --command=*)
      COMMAND_MODE=shell
      RUN_COMMAND=("${1#*=}")
      shift
      ;;
    --)
      shift
      [[ $# -gt 0 ]] || die "-- must be followed by a command"
      COMMAND_MODE=argv
      RUN_COMMAND=("$@")
      break
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

[[ ${#RUN_COMMAND[@]} -gt 0 && -n "${RUN_COMMAND[0]}" ]] || die "command must not be empty"

if ! command -v fly >/dev/null 2>&1; then
  echo "fly CLI required" >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git required" >&2
  exit 1
fi

detect_remote_name() {
  local upstream remote remotes

  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  if [[ -n "${upstream}" && "${upstream}" == */* ]]; then
    remote="${upstream%%/*}"
    if git remote get-url "${remote}" >/dev/null 2>&1; then
      printf '%s\n' "${remote}"
      return 0
    fi
  fi

  if git remote get-url origin >/dev/null 2>&1; then
    printf '%s\n' origin
    return 0
  fi

  remotes="$(git remote)"
  while IFS= read -r remote; do
    [[ -n "${remote}" ]] || continue
    printf '%s\n' "${remote}"
    return 0
  done <<< "${remotes}"
}

sanitize_path_segment() {
  local segment="$1"

  segment="${segment//[^A-Za-z0-9._-]/-}"
  while [[ "${segment}" == -* ]]; do
    segment="${segment#-}"
  done
  while [[ "${segment}" == *- ]]; do
    segment="${segment%-}"
  done
  if [[ -z "${segment}" || "${segment}" == "." || "${segment}" == ".." ]]; then
    segment="unknown"
  fi
  printf '%s\n' "${segment}"
}

repo_path_from_url() {
  local url path owner repo name owner_segment repo_segment name_segment

  url="${1%/}"
  url="${url%%\?*}"
  url="${url%%#*}"

  case "${url}" in
    git@github.com:*)
      path="${url#git@github.com:}"
      ;;
    ssh://git@github.com/*)
      path="${url#ssh://git@github.com/}"
      ;;
    https://github.com/*)
      path="${url#https://github.com/}"
      ;;
    http://github.com/*)
      path="${url#http://github.com/}"
      ;;
    git://github.com/*)
      path="${url#git://github.com/}"
      ;;
    github.com/*)
      path="${url#github.com/}"
      ;;
    github.com:*)
      path="${url#github.com:}"
      ;;
    *)
      path=""
      ;;
  esac

  if [[ -n "${path}" && "${path}" == */* ]]; then
    owner="${path%%/*}"
    repo="${path#*/}"
    repo="${repo%%/*}"
    repo="${repo%.git}"

    owner_segment="$(sanitize_path_segment "${owner}")"
    repo_segment="$(sanitize_path_segment "${repo}")"
    printf 'gh/%s/%s\n' "${owner_segment}" "${repo_segment}"
    return 0
  fi

  name="${url##*/}"
  name="${name%.git}"
  name_segment="$(sanitize_path_segment "${name}")"
  printf 'git/%s\n' "${name_segment}"
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

REPO_ROOT="${FOOLFAD_REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
[[ -n "${REPO_ROOT}" ]] || die "run this from inside a git repository"
cd "${REPO_ROOT}"

REPO_URL="${FOOLFAD_REPO_URL:-}"
if [[ -z "${REPO_URL}" ]]; then
  REMOTE_NAME="${FOOLFAD_REMOTE_NAME:-$(detect_remote_name)}"
  [[ -n "${REMOTE_NAME:-}" ]] || die "no git remote configured; set FOOLFAD_REPO_URL"
  REPO_URL="$(git remote get-url "${REMOTE_NAME}")"
fi

FOOLFAD_REPO_PATH="${FOOLFAD_REPO_PATH:-$(repo_path_from_url "${REPO_URL}")}"
FOOLFAD_APP="${FOOLFAD_APP:-}"
[[ -n "${FOOLFAD_APP}" ]] || die "set FOOLFAD_APP"

FOOLFAD_MACHINE_ID="${FOOLFAD_MACHINE_ID:-}"
[[ -n "${FOOLFAD_MACHINE_ID}" ]] || die "set FOOLFAD_MACHINE_ID"

FOOLFAD_USER="${FOOLFAD_USER:-${USER:-${FOOLFAD_DEFAULT_USER}}}"
FOOLFAD_USER="$(sanitize_path_segment "${FOOLFAD_USER}")"
FOOLFAD_RUN_ID="${FOOLFAD_RUN_ID:-$(new_run_id)}"
FOOLFAD_RUN_ID="$(sanitize_path_segment "${FOOLFAD_RUN_ID}")"
FOOLFAD_WORKTREE_NAME="${FOOLFAD_WORKTREE_NAME:-${FOOLFAD_USER}/${FOOLFAD_RUN_ID}}"
FOOLFAD_RUN_BRANCH="${FOOLFAD_RUN_BRANCH:-foolfad/${FOOLFAD_USER}/${FOOLFAD_RUN_ID}}"
FOOLFAD_BASE_BRANCH="${FOOLFAD_BASE_BRANCH:-$(git symbolic-ref --quiet --short HEAD 2>/dev/null || printf 'main')}"
FOOLFAD_WITH_RUNNERS_DIR="${FOOLFAD_WITH_RUNNERS_DIR:-/data/with-runners}"
FOOLFAD_REMOTE_DIR="${FOOLFAD_REMOTE_DIR:-${FOOLFAD_WITH_RUNNERS_DIR}/repos/${FOOLFAD_REPO_PATH}}"
FOOLFAD_BARE_DIR="${FOOLFAD_BARE_DIR:-${FOOLFAD_REMOTE_DIR}/repo.git}"
FOOLFAD_WORKTREE_DIR="${FOOLFAD_WORKTREE_DIR:-${FOOLFAD_REMOTE_DIR}/worktrees/${FOOLFAD_WORKTREE_NAME}}"
FOOLFAD_CONFIG="${FOOLFAD_CONFIG:-${FOOLFAD_REMOTE_DIR}/foolfad.env}"

if [[ "${COMMAND_MODE}" == "shell" ]]; then
  COMMAND_STRING="${RUN_COMMAND[0]}"
else
  COMMAND_STRING="$(shell_quote_command "${RUN_COMMAND[@]}")"
fi

LOCAL_BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
if [[ -n "${LOCAL_BRANCH}" ]]; then
  git push "${REPO_URL}" "HEAD:${LOCAL_BRANCH}"
fi

git push "${REPO_URL}" "HEAD:${FOOLFAD_RUN_BRANCH}"

FOOLFAD_BARE_DIR_Q="$(shell_quote_word "${FOOLFAD_BARE_DIR}")"
FOOLFAD_BASE_BRANCH_Q="$(shell_quote_word "${FOOLFAD_BASE_BRANCH}")"
FOOLFAD_CONFIG_Q="$(shell_quote_word "${FOOLFAD_CONFIG}")"
FOOLFAD_REMOTE_DIR_Q="$(shell_quote_word "${FOOLFAD_REMOTE_DIR}")"
FOOLFAD_REPO_PATH_Q="$(shell_quote_word "${FOOLFAD_REPO_PATH}")"
FOOLFAD_RUN_BRANCH_Q="$(shell_quote_word "${FOOLFAD_RUN_BRANCH}")"
FOOLFAD_WORKTREE_DIR_Q="$(shell_quote_word "${FOOLFAD_WORKTREE_DIR}")"
FOOLFAD_WORKTREE_PARENT_Q="$(shell_quote_word "$(dirname "${FOOLFAD_WORKTREE_DIR}")")"
COMMAND_STRING_Q="$(shell_quote_word "${COMMAND_STRING}")"
REPO_URL_Q="$(shell_quote_word "${REPO_URL}")"

REMOTE_SCRIPT=$(cat <<SCRIPT
set -euo pipefail
mkdir -p ${FOOLFAD_REMOTE_DIR_Q}
if [ ! -d ${FOOLFAD_BARE_DIR_Q} ]; then
  git clone --bare ${REPO_URL_Q} ${FOOLFAD_BARE_DIR_Q}
fi
git -C ${FOOLFAD_BARE_DIR_Q} fetch ${REPO_URL_Q} '+refs/heads/*:refs/heads/*'
mkdir -p ${FOOLFAD_WORKTREE_PARENT_Q}
if [ -d ${FOOLFAD_WORKTREE_DIR_Q}/.git ] || [ -f ${FOOLFAD_WORKTREE_DIR_Q}/.git ]; then
  git -C ${FOOLFAD_WORKTREE_DIR_Q} fetch origin
  git -C ${FOOLFAD_WORKTREE_DIR_Q} checkout ${FOOLFAD_RUN_BRANCH_Q}
  git -C ${FOOLFAD_WORKTREE_DIR_Q} reset --hard ${FOOLFAD_RUN_BRANCH_Q}
else
  rm -rf ${FOOLFAD_WORKTREE_DIR_Q}
  git -C ${FOOLFAD_BARE_DIR_Q} worktree add ${FOOLFAD_WORKTREE_DIR_Q} ${FOOLFAD_RUN_BRANCH_Q}
fi
cat > ${FOOLFAD_CONFIG_Q} <<'EOF'
export FOOLFAD_REPO_URL=${REPO_URL_Q}
export FOOLFAD_REPO_PATH=${FOOLFAD_REPO_PATH_Q}
export FOOLFAD_REMOTE_DIR=${FOOLFAD_REMOTE_DIR_Q}
export FOOLFAD_BARE_DIR=${FOOLFAD_BARE_DIR_Q}
export FOOLFAD_WORKTREE_DIR=${FOOLFAD_WORKTREE_DIR_Q}
export FOOLFAD_RUN_BRANCH=${FOOLFAD_RUN_BRANCH_Q}
export FOOLFAD_BASE_BRANCH=${FOOLFAD_BASE_BRANCH_Q}
EOF
cd ${FOOLFAD_WORKTREE_DIR_Q}
exec bash -lc ${COMMAND_STRING_Q}
SCRIPT
)

printf '%s\n' "${REMOTE_SCRIPT}" | fly ssh console \
  --app "${FOOLFAD_APP}" \
  --machine "${FOOLFAD_MACHINE_ID}" \
  --command "bash -s"

#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: prasskitte [-m SECONDS] -- COMMAND [ARG...]

Run COMMAND while publishing a Sprite task heartbeat. The task is removed when
COMMAND exits. If -m is set, Prasskitte stops refreshing the heartbeat after
that many seconds, but it continues waiting for COMMAND.
EOF
}

normalize_task_name() {
  local name
  name="$*"
  name="${name:0:80}"
  printf '%s\n' "${name}" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/^$/command/'
}

validate_seconds() {
  local name="$1"
  local value="$2"

  if [[ ! "${value}" =~ ^[0-9]+$ ]]; then
    printf 'prasskitte: %s must be a non-negative integer number of seconds\n' "${name}" >&2
    exit 2
  fi
}

MAX_SECONDS="${PRASSKITTE_MAX_SECONDS:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m)
      if [[ $# -lt 2 ]]; then
        usage
        exit 2
      fi
      MAX_SECONDS="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

if [[ $# -eq 0 ]]; then
  usage
  exit 2
fi

if [[ -n "${MAX_SECONDS}" ]]; then
  validate_seconds "-m" "${MAX_SECONDS}"
fi

validate_seconds "PRASSKITTE_HEARTBEAT_INTERVAL" "${PRASSKITTE_HEARTBEAT_INTERVAL:-60}"

TASK_NAME="${PRASSKITTE_TASK_NAME:-$(normalize_task_name "$@")}"
TASK_EXPIRE="${PRASSKITTE_TASK_EXPIRE:-5m}"
HEARTBEAT_INTERVAL="${PRASSKITTE_HEARTBEAT_INTERVAL:-60}"
SPRITE_SOCKET="${PRASSKITTE_SPRITE_SOCKET:-/.sprite/api.sock}"
SPRITE_AVAILABLE=0
HEARTBEAT_PID=""
COMMAND_PID=""

heartbeat_once() {
  local payload

  if [[ "${SPRITE_AVAILABLE}" -ne 1 ]]; then
    return 0
  fi

  payload="$(jq -cn --arg expire "${TASK_EXPIRE}" '{expire: $expire}')"
  curl -fsS --unix-socket "${SPRITE_SOCKET}" \
    -H "Content-Type: application/json" \
    -X PUT "http://sprite/v1/tasks/${TASK_NAME}" \
    -d "${payload}" >/dev/null || true
}

heartbeat_loop() {
  local elapsed now remaining sleep_for start_time

  start_time="$(date +%s)"
  while true; do
    sleep_for="${HEARTBEAT_INTERVAL}"

    if [[ -n "${MAX_SECONDS}" ]]; then
      now="$(date +%s)"
      elapsed=$((now - start_time))
      if (( elapsed >= MAX_SECONDS )); then
        return 0
      fi
      remaining=$((MAX_SECONDS - elapsed))
      if (( remaining < sleep_for )); then
        sleep_for="${remaining}"
      fi
    fi

    if (( sleep_for <= 0 )); then
      return 0
    fi

    sleep "${sleep_for}"

    if [[ -n "${MAX_SECONDS}" ]]; then
      now="$(date +%s)"
      elapsed=$((now - start_time))
      if (( elapsed >= MAX_SECONDS )); then
        return 0
      fi
    fi

    heartbeat_once
  done
}

start_heartbeat() {
  if [[ ! -S "${SPRITE_SOCKET}" ]] || ! command -v curl >/dev/null 2>&1; then
    return 0
  fi

  SPRITE_AVAILABLE=1
  heartbeat_once

  heartbeat_loop &
  HEARTBEAT_PID="$!"
}

delete_task() {
  if [[ "${SPRITE_AVAILABLE}" -ne 1 ]]; then
    return 0
  fi

  curl -fsS --unix-socket "${SPRITE_SOCKET}" \
    -H "Content-Type: application/json" \
    -X DELETE "http://sprite/v1/tasks/${TASK_NAME}" >/dev/null || true
}

cleanup() {
  if [[ -n "${HEARTBEAT_PID}" ]]; then
    kill "${HEARTBEAT_PID}" 2>/dev/null || true
    wait "${HEARTBEAT_PID}" 2>/dev/null || true
  fi

  delete_task
}

trap '[[ -n "${COMMAND_PID}" ]] && kill -INT "${COMMAND_PID}" 2>/dev/null || true' INT
trap '[[ -n "${COMMAND_PID}" ]] && kill -TERM "${COMMAND_PID}" 2>/dev/null || true' TERM
trap '[[ -n "${COMMAND_PID}" ]] && kill -HUP "${COMMAND_PID}" 2>/dev/null || true' HUP

start_heartbeat

set +e
"$@" &
COMMAND_PID="$!"
wait "${COMMAND_PID}"
status=$?
set -e

cleanup
exit "${status}"

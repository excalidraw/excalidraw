#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${ROOT}/docker-compose.yml"

TF_BIN="${TF_BIN:-terraform}"
if command -v tflocal >/dev/null 2>&1; then
  TF_BIN="tflocal"
fi

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

STACKS=(
  "00-consumer"
  "10-a-api-1"
  "11-a-api-2"
  "12-a-api-3"
  "20-b-api-4"
  "21-b-api-5"
  "22-b-api-6"
)

echo "Starting LocalStack containers..."
docker compose -f "${COMPOSE_FILE}" up -d

wait_for_localstack() {
  local port="$1"
  local name="$2"
  echo "Waiting for ${name} on port ${port}..."
  for _ in $(seq 1 60); do
    if curl -sf "http://localhost:${port}/_localstack/health" >/dev/null; then
      echo "${name} is ready."
      return 0
    fi
    sleep 2
  done
  echo "Timed out waiting for ${name} on port ${port}" >&2
  exit 1
}

wait_for_localstack 4566 "localstack-acct-a"
wait_for_localstack 4567 "localstack-acct-b"

for stack in "${STACKS[@]}"; do
  echo "==> Applying stack ${stack}"
  (
    cd "${ROOT}/stacks/${stack}"
    "${TF_BIN}" init -input=false -no-color
    "${TF_BIN}" apply -auto-approve -input=false -no-color
  )
done

echo "All stacks applied."

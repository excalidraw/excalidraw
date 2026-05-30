#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

TF_BIN="${TF_BIN:-terraform}"
if command -v tflocal >/dev/null 2>&1; then
  TF_BIN="tflocal"
fi

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

# Optional: start LocalStack when not already running (plan/apply need reachable endpoints).
if ! curl -sf "http://localhost:4566/_localstack/health" >/dev/null || ! curl -sf "http://localhost:4567/_localstack/health" >/dev/null; then
  echo "LocalStack not detected on 4566/4567 — starting containers..."
  docker compose -f "${ROOT}/docker-compose.yml" up -d
  for _ in $(seq 1 60); do
    if curl -sf "http://localhost:4566/_localstack/health" >/dev/null && curl -sf "http://localhost:4567/_localstack/health" >/dev/null; then
      break
    fi
    sleep 2
  done
fi

STACKS=(
  "00-a-network-east"
  "01-a-network-west"
  "02-b-network-eu-west"
  "03-b-network-eu-central"
  "10-a-api-1"
  "11-a-api-2"
  "12-a-api-3"
  "20-b-api-4"
  "21-b-api-5"
  "22-b-api-6"
  "30-a-messaging"
)

FIXTURE_DIR="${ROOT}/../../../../excalidraw/test-fixtures/production-geo-fanout/bundles"
mkdir -p "${FIXTURE_DIR}"

for stack in "${STACKS[@]}"; do
  echo "==> Exporting stack ${stack}"
  stack_dir="${ROOT}/stacks/${stack}"
  (
    cd "${stack_dir}"
    "${TF_BIN}" init -input=false -no-color
    "${TF_BIN}" plan -out=tfplan -input=false -no-color
    "${TF_BIN}" show -json tfplan > plan.json
    "${TF_BIN}" graph -type=plan > graph.dot
  )
  cp "${stack_dir}/plan.json" "${FIXTURE_DIR}/${stack}.plan.json"
  cp "${stack_dir}/graph.dot" "${FIXTURE_DIR}/${stack}.graph.dot"
  node "${ROOT}/scripts/enrich-exported-plan.mjs" "${stack}" \
    "${stack_dir}/plan.json" "${stack_dir}"
  cp "${stack_dir}/plan.json" "${FIXTURE_DIR}/${stack}.plan.json"
done

# Keep copies in stack dirs for import preset loader (planPath relative to rootPath).
for stack in "${STACKS[@]}"; do
  cp "${FIXTURE_DIR}/${stack}.plan.json" "${ROOT}/stacks/${stack}/plan.json"
  cp "${FIXTURE_DIR}/${stack}.graph.dot" "${ROOT}/stacks/${stack}/graph.dot"
done

cp "${ROOT}/pipeline.tfd" "${FIXTURE_DIR}/pipeline.tfd"
cp "${ROOT}/../pipeline.tfd" "${FIXTURE_DIR}/pipeline.production.tfd"

echo "Exported plan/dot to ${FIXTURE_DIR}"
echo "Next: yarn seed:terraform-presets && yarn export:terraform-presets-test-db"

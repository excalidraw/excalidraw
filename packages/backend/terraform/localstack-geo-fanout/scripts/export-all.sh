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

STACKS=(
  "00-consumer"
  "10-a-api-1"
  "11-a-api-2"
  "12-a-api-3"
  "20-b-api-4"
  "21-b-api-5"
  "22-b-api-6"
)

FIXTURE_DIR="${ROOT}/../../../excalidraw/test-fixtures/localstack-geo-fanout/bundles"
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

cp "${ROOT}/pipeline.tfd" "${FIXTURE_DIR}/pipeline.tfd"

echo "Exported plan/dot to ${FIXTURE_DIR}"
echo "Next: yarn seed:terraform-presets && yarn export:terraform-presets-test-db"

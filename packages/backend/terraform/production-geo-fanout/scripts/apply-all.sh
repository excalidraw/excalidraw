#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACKS_DIR="${ROOT}/stacks"
BACKEND_CONFIG="${BACKEND_CONFIG:-${ROOT}/backend.hcl}"
ACCOUNT_B_VARS=()
if [[ -f "${ROOT}/terraform.tfvars.account-b" ]]; then
  ACCOUNT_B_VARS=(-var-file="${ROOT}/terraform.tfvars.account-b")
fi

if [[ ! -f "${BACKEND_CONFIG}" ]]; then
  echo "Missing backend config: ${BACKEND_CONFIG}" >&2
  echo "Copy backend.hcl.example to backend.hcl and set your state bucket." >&2
  exit 1
fi

apply_stack() {
  local stack_id="$1"
  local stack_key="$2"
  shift 2
  local stack_dir="${STACKS_DIR}/${stack_id}"

  echo "==> ${stack_id}"
  cd "${stack_dir}"
  terraform init \
    -backend-config="${BACKEND_CONFIG}" \
    -backend-config="key=${stack_key}" \
    -reconfigure
  terraform apply -auto-approve "$@"
  cd "${ROOT}"
}

# Phase 1 — regional networks
apply_stack "00-a-network-east" "production-geo-fanout/00-a-network-east/terraform.tfstate"
apply_stack "01-a-network-west" "production-geo-fanout/01-a-network-west/terraform.tfstate"
apply_stack "02-b-network-eu-west" "production-geo-fanout/02-b-network-eu-west/terraform.tfstate" "${ACCOUNT_B_VARS[@]}"
apply_stack "03-b-network-eu-central" "production-geo-fanout/03-b-network-eu-central/terraform.tfstate" "${ACCOUNT_B_VARS[@]}"

# Phase 2 — private API stacks (account A)
apply_stack "10-a-api-1" "production-geo-fanout/10-a-api-1/terraform.tfstate"
apply_stack "11-a-api-2" "production-geo-fanout/11-a-api-2/terraform.tfstate"
apply_stack "12-a-api-3" "production-geo-fanout/12-a-api-3/terraform.tfstate"

# Phase 3 — private API stacks (account B)
apply_stack "20-b-api-4" "production-geo-fanout/20-b-api-4/terraform.tfstate" "${ACCOUNT_B_VARS[@]}"
apply_stack "21-b-api-5" "production-geo-fanout/21-b-api-5/terraform.tfstate" "${ACCOUNT_B_VARS[@]}"
apply_stack "22-b-api-6" "production-geo-fanout/22-b-api-6/terraform.tfstate" "${ACCOUNT_B_VARS[@]}"

# Phase 4 — messaging / consumer fanout
apply_stack "30-a-messaging" "production-geo-fanout/30-a-messaging/terraform.tfstate"

echo "All production-geo-fanout stacks applied."

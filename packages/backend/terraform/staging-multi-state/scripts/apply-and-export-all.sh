#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export TF_VAR_aws_account_id="${TF_VAR_aws_account_id:-992382747916}"
export TF_VAR_environment="${TF_VAR_environment:-staging}"
export AWS_PROFILE="${AWS_PROFILE:-admin}"

LOG_DIR="${TMPDIR:-/tmp}/staging-multi-state-apply-$$"
mkdir -p "$LOG_DIR"

apply_stack() {
  local stack="$1"
  local log="$LOG_DIR/${stack}.log"
  {
    echo "=== ${stack} ==="
    cd "$ROOT/$stack"
    terraform init -input=false
    terraform apply -auto-approve -input=false
    terraform plan -out=plan.bin -input=false
    terraform show -json plan.bin > plan.json
    terraform graph -plan=plan.bin > graph.dot
    rm -f plan.bin
    echo "=== ${stack} OK ==="
  } >"$log" 2>&1
}

run_wave() {
  local label="$1"
  shift
  local stacks=("$@")
  local pids=()
  local stack

  echo ""
  echo ">>> Wave: ${label} (${#stacks[@]} stacks in parallel)"
  for stack in "${stacks[@]}"; do
    apply_stack "$stack" &
    pids+=($!)
  done

  local failed=0
  for i in "${!stacks[@]}"; do
    if ! wait "${pids[$i]}"; then
      echo "FAILED: ${stacks[$i]} (see $LOG_DIR/${stacks[$i]}.log)"
      failed=1
    else
      echo "Done: ${stacks[$i]}"
    fi
  done

  if (( failed )); then
    echo "Logs: $LOG_DIR"
    exit 1
  fi
}

# Wave 1a: hub VPC + TGW (apply first to reduce peering races)
run_wave "1a-hub" "00-east-network"

# Wave 1b: peer regional VPCs + TGW mesh
run_wave "1b-peers" \
  "01-west-network" \
  "04-west-1-network" \
  "05-east-2-network"

# Wave 2: regional datastores
run_wave "2-datastores" \
  "02-east-datastores" \
  "03-west-datastores" \
  "04-west-1-datastores" \
  "05-east-2-datastores"

# Wave 3: tail APIs + east APIs without cross-deps
run_wave "3-tails-east" \
  "40-east-api-1" \
  "41-east-api-2" \
  "42-east-api-3" \
  "52-west-api-10" \
  "53-west-api-11" \
  "55-west-1-api-14" \
  "57-east-2-api-16"

# Wave 4: regional entry APIs
run_wave "4-entry-apis" \
  "50-west-api-8" \
  "51-west-api-9" \
  "54-west-1-api-12" \
  "56-east-2-api-15"

# Wave 5: east mid-tier (needs entry APIs 8, 12, 15 and 9)
run_wave "5-east-mid" \
  "45-east-api-6" \
  "46-east-api-7"

# Wave 6: east entry cascade (needs apis 6, 7)
run_wave "6-east-entry" \
  "43-east-api-4" \
  "44-east-api-5"

# Wave 7: messaging (apis 1-5 + queues)
run_wave "7-messaging" "20-east-messaging"

# Wave 8: ECS edge (egress queue + VPC)
run_wave "8-ecs-edge" "10-east-ecs-edge"

echo ""
echo "All 25 stacks applied and exported (plan.json, graph.dot, terraform.tfstate)."
echo "Logs: $LOG_DIR"

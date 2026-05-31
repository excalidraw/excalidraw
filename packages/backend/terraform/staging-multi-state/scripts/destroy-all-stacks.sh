#!/usr/bin/env bash
# Tear down all staging-multi-state AWS resources (reverse dependency waves, parallel within each wave).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export TF_VAR_aws_account_id="${TF_VAR_aws_account_id:-992382747916}"
export AWS_PROFILE="${AWS_PROFILE:-admin}"

LOG_DIR="${TMPDIR:-/tmp}/staging-multi-state-destroy-$$"
mkdir -p "$LOG_DIR"

destroy_stack() {
  local stack="$1"
  local log="$LOG_DIR/${stack}.log"
  {
    echo "=== ${stack} ==="
    cd "$ROOT/$stack"
    terraform init -input=false
    terraform destroy -auto-approve -input=false
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
    destroy_stack "$stack" &
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

# Wave 1: messaging, edge, all API stacks (25-stack expanded layout)
WAVE1=(
  20-east-messaging
  10-east-ecs-edge
  40-east-api-1
  41-east-api-2
  42-east-api-3
  43-east-api-4
  44-east-api-5
  45-east-api-6
  46-east-api-7
  50-west-api-8
  51-west-api-9
  52-west-api-10
  53-west-api-11
  54-west-1-api-12
  55-west-1-api-14
  56-east-2-api-15
  57-east-2-api-16
)

# Wave 2: datastores
WAVE2=(
  02-east-datastores
  03-west-datastores
  04-west-1-datastores
  05-east-2-datastores
)

# Wave 3: regional networks (not hub)
WAVE3=(
  01-west-network
  04-west-1-network
  05-east-2-network
)

run_wave "apps" "${WAVE1[@]}"
run_wave "datastores" "${WAVE2[@]}"
run_wave "regional-networks" "${WAVE3[@]}"
run_wave "hub-network" "00-east-network"

echo ""
echo "All stacks destroyed. Logs: $LOG_DIR"
echo ""
echo "If EC2 API stacks (42, 46, 51, 56) time out on ECS drain, scale ASGs to 0,"
echo "terminate instances, force-delete ECS services, then re-run this script."
echo "Exported artifacts (plan.json, graph.dot, terraform.tfstate) remain on disk."

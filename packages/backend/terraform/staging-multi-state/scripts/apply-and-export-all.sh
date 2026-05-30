#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export TF_VAR_aws_account_id="${TF_VAR_aws_account_id:-992382747916}"
export AWS_PROFILE="${AWS_PROFILE:-admin}"

STACKS=(
  00-east-network
  01-west-network
  02-east-datastores
  03-west-datastores
  40-east-api-1
  41-east-api-2
  42-east-api-3
  52-west-api-10
  53-west-api-11
  50-west-api-8
  51-west-api-9
  45-east-api-6
  46-east-api-7
  43-east-api-4
  44-east-api-5
  10-east-ecs-edge
  20-east-messaging
)

apply_stack() {
  local stack="$1"
  echo "=== ${stack} ==="
  cd "$ROOT/$stack"
  terraform init -input=false
  terraform apply -auto-approve -input=false
  terraform plan -out=plan.bin -input=false
  terraform show -json plan.bin > plan.json
  terraform graph -plan=plan.bin > graph.dot
  rm -f plan.bin
  cd "$ROOT"
}

for stack in "${STACKS[@]}"; do
  apply_stack "$stack"
done

echo "All stacks applied and exported (plan.json, graph.dot, terraform.tfstate)."

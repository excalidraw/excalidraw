#!/usr/bin/env bash
# Tear down all staging-multi-state AWS resources (reverse dependency waves).
# Env: SEQUENTIAL=1 (one stack at a time), RETRY_FAILED=1 (only stacks that failed last run),
#      LOG_DIR=/path (reuse logs for retry), SKIP_PREFLIGHT=1, DRAIN_TIMEOUT_SEC=900
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export TF_VAR_aws_account_id="${TF_VAR_aws_account_id:-992382747916}"
export AWS_PROFILE="${AWS_PROFILE:-admin}"
export TF_VAR_environment="${TF_VAR_environment:-staging}"

LOG_DIR="${LOG_DIR:-${TMPDIR:-/tmp}/staging-multi-state-destroy-$$}"
mkdir -p "$LOG_DIR"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

destroy_stack() {
  local stack="$1"
  local log="$LOG_DIR/${stack}.log"
  local rc=0
  {
    echo "=== ${stack} ==="
    cd "$ROOT/$stack"
    terraform init -input=false
    terraform destroy -auto-approve -input=false
    echo "=== ${stack} OK ==="
  } >"$log" 2>&1 || rc=$?
  return "$rc"
}

stack_failed_in_log() {
  local stack="$1"
  local log="$LOG_DIR/${stack}.log"
  [[ -f "$log" ]] || return 0
  ! grep -q "=== ${stack} OK ===" "$log" 2>/dev/null
}

run_stacks() {
  local label="$1"
  shift
  local stacks=("$@")
  local filtered=()

  if [[ "${RETRY_FAILED:-}" == "1" ]]; then
    for stack in "${stacks[@]}"; do
      if stack_failed_in_log "$stack"; then
        filtered+=("$stack")
      fi
    done
    stacks=("${filtered[@]}")
  fi

  if ((${#stacks[@]} == 0)); then
    echo ""
    echo ">>> Wave: ${label} (skipped — no stacks)"
    return 0
  fi

  echo ""
  local failed=0
  if [[ "${SEQUENTIAL:-}" == "1" ]]; then
    echo ">>> Wave: ${label} (${#stacks[@]} stacks sequential)"
    local stack
    for stack in "${stacks[@]}"; do
      if destroy_stack "$stack"; then
        echo "Done: ${stack}"
      else
        echo "FAILED: ${stack} (see $LOG_DIR/${stack}.log)"
        failed=1
      fi
    done
  else
    echo ">>> Wave: ${label} (${#stacks[@]} stacks in parallel)"
    local pids=()
    local stack
    for stack in "${stacks[@]}"; do
      destroy_stack "$stack" &
      pids+=($!)
    done
    for i in "${!stacks[@]}"; do
      if ! wait "${pids[$i]}"; then
        echo "FAILED: ${stacks[$i]} (see $LOG_DIR/${stacks[$i]}.log)"
        failed=1
      else
        echo "Done: ${stacks[$i]}"
      fi
    done
  fi

  if (( failed )); then
    echo "Logs: $LOG_DIR"
    exit 1
  fi
}

run_batches() {
  local label="$1"
  local batch_size="$2"
  shift 2
  local stacks=("$@")
  local batch=()
  local batch_num=0

  for stack in "${stacks[@]}"; do
    batch+=("$stack")
    if ((${#batch[@]} >= batch_size)); then
      batch_num=$((batch_num + 1))
      run_stacks "${label}-${batch_num}" "${batch[@]}"
      batch=()
    fi
  done

  if ((${#batch[@]} > 0)); then
    batch_num=$((batch_num + 1))
    run_stacks "${label}-${batch_num}" "${batch[@]}"
  fi
}

delete_tgw_peering_attachments() {
  echo ""
  echo ">>> TGW peering guard: removing cross-region peering attachments"
  local region attachment_id tgw_id
  for region in us-east-1 us-west-1 us-east-2; do
    mapfile -t attachments < <(
      aws ec2 describe-transit-gateway-peering-attachments \
        --region "$region" \
        --filters "Name=state,Values=available,pendingAcceptance" \
        --query "TransitGatewayPeeringAttachments[?contains(Tags[?Key=='environment'].Value | [0], '${TF_VAR_environment}') || contains(TransitGatewayId, '${TF_VAR_environment}')].TransitGatewayAttachmentId" \
        --output text 2>/dev/null | tr '\t' '\n' | sed '/^$/d'
    )
    for attachment_id in "${attachments[@]}"; do
      [[ -z "$attachment_id" ]] && continue
      echo "  delete peering attachment ${attachment_id} (${region})"
      aws ec2 delete-transit-gateway-peering-attachment \
        --region "$region" \
        --transit-gateway-attachment-id "$attachment_id" \
        --no-cli-pager \
        >/dev/null 2>&1 || true
    done
  done

  # Hub TGW peering by name tag (staging-east-tgw peers)
  for region in us-east-1 us-west-1 us-east-2 us-west-2; do
    mapfile -t tgws < <(
      aws ec2 describe-transit-gateways \
        --region "$region" \
        --filters "Name=tag:Name,Values=${TF_VAR_environment}-*" \
        --query "TransitGateways[].TransitGatewayId" \
        --output text 2>/dev/null | tr '\t' '\n' | sed '/^$/d'
    )
    for tgw_id in "${tgws[@]}"; do
      [[ -z "$tgw_id" ]] && continue
      mapfile -t peer_attachments < <(
        aws ec2 describe-transit-gateway-peering-attachments \
          --region "$region" \
          --filters "Name=transit-gateway-id,Values=${tgw_id}" \
          --query "TransitGatewayPeeringAttachments[?State=='available'].TransitGatewayAttachmentId" \
          --output text 2>/dev/null | tr '\t' '\n' | sed '/^$/d'
      )
      for attachment_id in "${peer_attachments[@]}"; do
        [[ -z "$attachment_id" ]] && continue
        echo "  delete peering ${attachment_id} on ${tgw_id} (${region})"
        aws ec2 delete-transit-gateway-peering-attachment \
          --region "$region" \
          --transit-gateway-attachment-id "$attachment_id" \
          --no-cli-pager \
          >/dev/null 2>&1 || true
      done
    done
  done
}

WAVE_EDGE=(
  20-east-messaging
  10-east-ecs-edge
)

WAVE_APIS=(
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

WAVE_DATASTORES=(
  02-east-datastores
  03-west-datastores
  04-west-1-datastores
  05-east-2-datastores
)

WAVE_REGIONAL_NETWORKS=(
  01-west-network
  04-west-1-network
  05-east-2-network
)

if [[ "${SKIP_PREFLIGHT:-}" != "1" ]]; then
  bash "$SCRIPT_DIR/preflight-destroy-drain.sh"
fi

if [[ "${SEQUENTIAL:-}" == "1" ]]; then
  run_stacks "edge" "${WAVE_EDGE[@]}"
  run_stacks "apis" "${WAVE_APIS[@]}"
  run_stacks "datastores" "${WAVE_DATASTORES[@]}"
  run_stacks "regional-networks" "${WAVE_REGIONAL_NETWORKS[@]}"
  delete_tgw_peering_attachments
  run_stacks "hub-network" "00-east-network"
else
  run_stacks "edge" "${WAVE_EDGE[@]}"
  run_batches "apis" 8 "${WAVE_APIS[@]}"
  run_stacks "datastores" "${WAVE_DATASTORES[@]}"
  run_stacks "regional-networks" "${WAVE_REGIONAL_NETWORKS[@]}"
  delete_tgw_peering_attachments
  run_stacks "hub-network" "00-east-network"
fi

echo ""
echo "All stacks destroyed. Logs: $LOG_DIR"
echo ""
echo "Run ./scripts/verify-staging-empty.sh to confirm zero AWS footprint."
echo "On failure: SEQUENTIAL=1 RETRY_FAILED=1 LOG_DIR=$LOG_DIR $0"
echo "Exported artifacts (plan.json, graph.dot, terraform.tfstate) remain on disk."

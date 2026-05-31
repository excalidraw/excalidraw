#!/usr/bin/env bash
# Scale ECS services and ASGs to zero before staging-multi-state destroy.
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-admin}"
export TF_VAR_environment="${TF_VAR_environment:-staging}"

REGIONS=(us-east-1 us-east-2 us-west-1 us-west-2)
DRAIN_TIMEOUT_SEC="${DRAIN_TIMEOUT_SEC:-900}"

echo ">>> Preflight drain (profile=${AWS_PROFILE}, timeout=${DRAIN_TIMEOUT_SEC}s)"

scale_ecs_service() {
  local region="$1"
  local cluster="$2"
  local service="$3"
  aws ecs update-service \
    --region "$region" \
    --cluster "$cluster" \
    --service "$service" \
    --desired-count 0 \
    --no-cli-pager \
    >/dev/null 2>&1 || true
}

wait_ecs_service() {
  local region="$1"
  local cluster="$2"
  local service="$3"
  local deadline=$((SECONDS + DRAIN_TIMEOUT_SEC))
  while (( SECONDS < deadline )); do
    local running
    running="$(aws ecs describe-services \
      --region "$region" \
      --cluster "$cluster" \
      --services "$service" \
      --query 'services[0].runningCount' \
      --output text 2>/dev/null || echo "0")"
    if [[ "$running" == "0" || "$running" == "None" ]]; then
      return 0
    fi
    sleep 15
  done
  echo "WARN: ECS service still running after drain timeout: ${cluster}/${service} (${region})"
  aws ecs update-service \
    --region "$region" \
    --cluster "$cluster" \
    --service "$service" \
    --force-new-deployment \
    --desired-count 0 \
    --no-cli-pager \
    >/dev/null 2>&1 || true
}

scale_asg_to_zero() {
  local region="$1"
  local asg_name="$2"
  aws autoscaling update-auto-scaling-group \
    --region "$region" \
    --auto-scaling-group-name "$asg_name" \
    --min-size 0 \
    --max-size 0 \
    --desired-capacity 0 \
    --no-cli-pager \
    >/dev/null 2>&1 || true
}

for region in "${REGIONS[@]}"; do
  echo "  Region ${region}: ECS clusters"
  mapfile -t clusters < <(
    aws ecs list-clusters \
      --region "$region" \
      --query "clusterArns[?contains(@, '${TF_VAR_environment}')]" \
      --output text 2>/dev/null | tr '\t' '\n' | sed '/^$/d'
  )
  for cluster_arn in "${clusters[@]}"; do
    [[ -z "$cluster_arn" ]] && continue
    cluster="${cluster_arn##*/}"
    mapfile -t services < <(
      aws ecs list-services \
        --region "$region" \
        --cluster "$cluster" \
        --query "serviceArns[?contains(@, '${TF_VAR_environment}')]" \
        --output text 2>/dev/null | tr '\t' '\n' | sed '/^$/d'
    )
    for service_arn in "${services[@]}"; do
      [[ -z "$service_arn" ]] && continue
      service="${service_arn##*/}"
      echo "    scale ${cluster}/${service} -> 0"
      scale_ecs_service "$region" "$cluster" "$service"
      wait_ecs_service "$region" "$cluster" "$service"
    done
  done

  echo "  Region ${region}: ASGs"
  mapfile -t asgs < <(
    aws autoscaling describe-auto-scaling-groups \
      --region "$region" \
      --query "AutoScalingGroups[?contains(AutoScalingGroupName, '${TF_VAR_environment}')].AutoScalingGroupName" \
      --output text 2>/dev/null | tr '\t' '\n' | sed '/^$/d'
  )
  for asg in "${asgs[@]}"; do
    [[ -z "$asg" ]] && continue
    echo "    scale ASG ${asg} -> 0"
    scale_asg_to_zero "$region" "$asg"
  done

  mapfile -t instances < <(
    aws ec2 describe-instances \
      --region "$region" \
      --filters "Name=tag:environment,Values=${TF_VAR_environment}" "Name=instance-state-name,Values=running" \
      --query "Reservations[].Instances[].InstanceId" \
      --output text 2>/dev/null | tr '\t' '\n' | sed '/^$/d'
  )
  if ((${#instances[@]} > 0)); then
    echo "  Region ${region}: terminating ${#instances[@]} staging EC2 instance(s)"
    aws ec2 terminate-instances \
      --region "$region" \
      --instance-ids "${instances[@]}" \
      --no-cli-pager \
      >/dev/null 2>&1 || true
  fi
done

echo ">>> Preflight drain complete"

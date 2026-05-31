#!/usr/bin/env bash
# Verify staging-multi-state AWS resources are gone across four regions.
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-admin}"
export TF_VAR_environment="${TF_VAR_environment:-staging}"

REGIONS=(us-east-1 us-east-2 us-west-1 us-west-2)
FAILED=0

echo ">>> Verifying empty staging footprint (profile=${AWS_PROFILE})"

for region in "${REGIONS[@]}"; do
  mapfile -t vpcs < <(
    aws ec2 describe-vpcs \
      --region "$region" \
      --filters "Name=tag:environment,Values=${TF_VAR_environment}" \
      --query "Vpcs[].VpcId" \
      --output text 2>/dev/null | tr '\t' '\n' | sed '/^$/d'
  )
  if ((${#vpcs[@]} > 0)); then
    echo "FAIL ${region}: ${#vpcs[@]} VPC(s): ${vpcs[*]}"
    FAILED=1
  else
    echo "OK   ${region}: 0 VPCs"
  fi
done

mapfile -t buckets < <(
  aws s3api list-buckets \
    --query "Buckets[?starts_with(Name, '${TF_VAR_environment}-')].Name" \
    --output text 2>/dev/null | tr '\t' '\n' | sed '/^$/d'
)
if ((${#buckets[@]} > 0)); then
  echo "FAIL S3: ${#buckets[@]} bucket(s): ${buckets[*]}"
  FAILED=1
else
  echo "OK   S3: 0 ${TF_VAR_environment}-* buckets"
fi

if (( FAILED )); then
  echo ""
  echo "Staging resources remain. Re-run destroy or clean up manually."
  exit 1
fi

echo ""
echo "Staging footprint is empty."

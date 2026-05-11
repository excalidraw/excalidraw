#!/usr/bin/env bash
# One-time: create IAM role TerraformDeploy trusted by the current caller, attach AdministratorAccess,
# and attach an inline policy on the caller (when caller is an IAM user) so sts:AssumeRole is allowed.
set -euo pipefail

PROFILE="${AWS_PROFILE:-admin}"
ROLE_NAME="${TERRAFORM_DEPLOY_ROLE_NAME:-TerraformDeploy}"

CALLER_ARN="$(aws sts get-caller-identity --profile "$PROFILE" --query Arn --output text)"
ACCOUNT="$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)"
ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${ROLE_NAME}"

TRUST="$(mktemp)"
cleanup() { rm -f "$TRUST"; }
trap cleanup EXIT

cat >"$TRUST" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "${CALLER_ARN}" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

if aws iam get-role --profile "$PROFILE" --role-name "$ROLE_NAME" &>/dev/null; then
  echo "Role ${ROLE_NAME} already exists; skipping create."
else
  aws iam create-role --profile "$PROFILE" --role-name "$ROLE_NAME" \
    --assume-role-policy-document "file://${TRUST}" \
    --description "Terraform/OpenTofu deploy role (excalidraw-tf bootstrap)"
fi

aws iam attach-role-policy --profile "$PROFILE" --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess 2>/dev/null || true

# IAM users need an identity policy allowing sts:AssumeRole; roles do not for same-account trust in the same way
# (federated/role chains differ). For the common case (IAM user + deploy role same account):
if [[ "$CALLER_ARN" == arn:aws:iam::*:user/* ]]; then
  USER_NAME="${CALLER_ARN##*/}"
  POLICY_NAME="AssumeRole-${ROLE_NAME}"
  aws iam put-user-policy --profile "$PROFILE" --user-name "$USER_NAME" --policy-name "$POLICY_NAME" \
    --policy-document "$(printf '%s' "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"sts:AssumeRole\",\"Resource\":\"${ROLE_ARN}\"}]}")"
  echo "Attached inline user policy ${POLICY_NAME} on ${USER_NAME}."
fi

echo "Bootstrap complete. Role ARN: ${ROLE_ARN}"
echo "Set in terraform.tfvars: aws_account_id = \"${ACCOUNT}\" (or terraform_deploy_role_arn) and aws_profile = \"${PROFILE}\"."

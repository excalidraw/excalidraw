output "aws_caller_identity_arn" {
  description = "ARN of the identity used for AWS API calls (TerraformDeploy when assume_role is enabled)."
  value       = data.aws_caller_identity.current.arn
}

output "aws_caller_identity_account_id" {
  value = data.aws_caller_identity.current.account_id
}

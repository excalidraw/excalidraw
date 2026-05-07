output "flow_log_id" {
  description = "VPC Flow Log resource ID."
  value       = aws_flow_log.this.id
}

output "log_group_name" {
  description = "CloudWatch Logs group receiving VPC Flow Logs."
  value       = aws_cloudwatch_log_group.flow.name
}

output "log_group_arn" {
  description = "CloudWatch Logs group ARN."
  value       = aws_cloudwatch_log_group.flow.arn
}

output "publish_role_arn" {
  description = "IAM role ARN used by VPC Flow Logs to publish to CloudWatch Logs."
  value       = aws_iam_role.publish.arn
}

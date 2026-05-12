output "aws_caller_identity_arn" {
  description = "ARN of the identity used for AWS API calls (TerraformDeploy when assume_role is enabled)."
  value       = data.aws_caller_identity.current.arn
}

output "aws_caller_identity_account_id" {
  value = data.aws_caller_identity.current.account_id
}
/*
output "workload_writer_alb_dns_name" {
  description = "Public DNS name for the writer Application Load Balancer (POST JSON to invoke the writer Lambda)."
  value       = module.workload_writer_alb.lb_dns_name
}

output "workload_writer_alb_zone_id" {
  description = "Route 53 zone ID for alias records pointing at the writer ALB."
  value       = module.workload_writer_alb.lb_zone_id
}*/

output "lambda_function_name" {
  value = module.lambda.lambda_function_name
}

output "lambda_function_arn" {
  value = module.lambda.lambda_function_arn
}

output "security_group_id" {
  value       = try(module.security_group[0].security_group_id, null)
  description = "Present only when Lambda runs in a VPC."
}

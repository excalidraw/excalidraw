output "api_id" {
  value = module.api.api_id
}

output "api_execution_arn" {
  value = module.api.api_execution_arn
}

output "api_invoke_url" {
  value = module.api.api_invoke_url
}

output "lambda_function_name" {
  value = module.api.lambda_function_name
}

output "lambda_function_arn" {
  value = module.api.lambda_function_arn
}

output "ssm_prefix" {
  value = module.api.ssm_prefix
}

output "aws_region" {
  value = var.aws_region
}

output "aws_account_id" {
  value = data.terraform_remote_state.network.outputs.aws_account_id
}

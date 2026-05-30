output "api_id" {
  value = module.api.api_id
}

output "api_execution_arn" {
  value = module.api.api_execution_arn
}

output "api_invoke_url" {
  value = module.api.api_invoke_url
}

output "ecs_service_name" {
  value = module.api.ecs_service_name
}

output "ssm_prefix" {
  value = module.api.ssm_prefix
}

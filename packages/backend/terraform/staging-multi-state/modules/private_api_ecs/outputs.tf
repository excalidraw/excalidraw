output "api_id" {
  value = aws_api_gateway_rest_api.private.id
}

output "api_execution_arn" {
  value = aws_api_gateway_rest_api.private.execution_arn
}

output "api_invoke_url" {
  value = "https://${aws_api_gateway_rest_api.private.id}-${var.execute_api_vpce_id}.execute-api.${var.aws_region}.amazonaws.com/${aws_api_gateway_stage.stage.stage_name}/invoke"
}

output "ecs_service_name" {
  value = aws_ecs_service.api.name
}

output "ecs_service_id" {
  value = aws_ecs_service.api.id
}

output "ssm_prefix" {
  value = local.ssm_prefix
}

output "lambda_function_name" {
  value = aws_lambda_function.this.function_name
}

output "lambda_function_arn" {
  value = aws_lambda_function.this.arn
}

output "api_gateway_id" {
  value = aws_api_gateway_rest_api.main.id
}

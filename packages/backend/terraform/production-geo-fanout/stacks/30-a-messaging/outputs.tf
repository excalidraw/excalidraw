output "queue_url" {
  value = module.queue.queue_url
}

output "queue_arn" {
  value = module.queue.queue_arn
}

output "consumer_lambda_function_name" {
  value = module.consumer_lambda.lambda_function_name
}

output "consumer_lambda_function_arn" {
  value = module.consumer_lambda.lambda_function_arn
}

output "consumer_lambda_role_arn" {
  value = "arn:aws:iam::${data.terraform_remote_state.east_network.outputs.aws_account_id}:role/${var.environment}-geo-fanout-consumer"
}

output "consumer_lambda_role_name" {
  value = "${var.environment}-geo-fanout-consumer"
}

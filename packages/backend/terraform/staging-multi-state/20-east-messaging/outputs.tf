output "queue_url" {
  value = module.queue.queue_url
}

output "queue_arn" {
  value = module.queue.queue_arn
}

output "dlq_arn" {
  value = module.queue.dead_letter_queue_arn
}

output "consumer_lambda_arn" {
  value = module.consumer_lambda.lambda_function_arn
}

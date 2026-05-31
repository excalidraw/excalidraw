output "queue_url" {
  value = module.ingress_queue.queue_url
}

output "queue_arn" {
  value = module.ingress_queue.queue_arn
}

output "ingress_queue_url" {
  value = module.ingress_queue.queue_url
}

output "ingress_queue_arn" {
  value = module.ingress_queue.queue_arn
}

output "egress_queue_url" {
  value = module.egress_queue.queue_url
}

output "egress_queue_arn" {
  value = module.egress_queue.queue_arn
}

output "ingress_dlq_arn" {
  value = module.ingress_queue.dead_letter_queue_arn
}

output "egress_dlq_arn" {
  value = module.egress_queue.dead_letter_queue_arn
}

output "dlq_arn" {
  value = module.ingress_queue.dead_letter_queue_arn
}

output "consumer_lambda_arn" {
  value = module.consumer_lambda.lambda_function_arn
}

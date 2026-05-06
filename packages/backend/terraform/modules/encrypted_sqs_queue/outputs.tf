output "queue_url" {
  value = module.queue.queue_url
}

output "queue_arn" {
  value = module.queue.queue_arn
}

output "queue_name" {
  value = module.queue.queue_name
}

output "dead_letter_queue_name" {
  value = module.queue.dead_letter_queue_name
}

output "kms_key_id" {
  value = module.kms.key_id
}

output "kms_key_arn" {
  value = module.kms.key_arn
}

output "dead_letter_queue_arn" {
  value = module.queue.dead_letter_queue_arn
}

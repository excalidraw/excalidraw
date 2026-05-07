output "s3_bucket_id" {
  value = module.bucket.s3_bucket_id
}

output "s3_bucket_arn" {
  value = module.bucket.s3_bucket_arn
}

output "kms_key_arn" {
  value = module.kms.key_arn
}

output "kms_key_id" {
  value = module.kms.key_id
}

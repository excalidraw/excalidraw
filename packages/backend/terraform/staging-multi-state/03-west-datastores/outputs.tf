output "api8_west_bucket_name" {
  value = module.api8_west_bucket.bucket_id
}

output "api8_west_bucket_arn" {
  value = module.api8_west_bucket.bucket_arn
}

output "api9_west_rds_identifier" {
  value = "staging-api-9-west"
}

output "api9_west_rds_arn" {
  value = module.api9_west_rds.db_instance_arn
}

output "api9_west_secret_arn" {
  value = module.api9_west_rds.secret_arn
}

output "api10_table_name" {
  value = module.api10_table.name
}

output "api10_table_arn" {
  value = module.api10_table.arn
}

output "api11_aurora_identifier" {
  value = "staging-api-11"
}

output "api11_aurora_arn" {
  value = module.api11_aurora.db_instance_arn
}

output "api11_secret_arn" {
  value = module.api11_aurora.secret_arn
}

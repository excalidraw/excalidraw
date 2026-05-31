output "api1_table_name" {
  value = module.api1_table.name
}

output "api1_table_arn" {
  value = module.api1_table.arn
}

output "api2_rds_identifier" {
  value = "staging-api-2"
}

output "api2_rds_arn" {
  value = module.api2_rds.db_instance_arn
}

output "api2_secret_arn" {
  value = module.api2_rds.secret_arn
}

output "api3_aurora_identifier" {
  value = "staging-api-3"
}

output "api3_aurora_arn" {
  value = module.api3_aurora.db_instance_arn
}

output "api3_secret_arn" {
  value = module.api3_aurora.secret_arn
}

output "api4_bucket_name" {
  value = module.api4_bucket.bucket_id
}

output "api4_bucket_arn" {
  value = module.api4_bucket.bucket_arn
}

output "api5_table_name" {
  value = module.api5_table.name
}

output "api5_table_arn" {
  value = module.api5_table.arn
}

output "api6_rds_identifier" {
  value = "staging-api-6"
}

output "api6_rds_arn" {
  value = module.api6_rds.db_instance_arn
}

output "api6_secret_arn" {
  value = module.api6_rds.secret_arn
}

output "api7_aurora_identifier" {
  value = "staging-api-7"
}

output "api7_aurora_arn" {
  value = module.api7_aurora.db_instance_arn
}

output "api7_secret_arn" {
  value = module.api7_aurora.secret_arn
}

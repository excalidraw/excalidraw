output "api15_aurora_identifier" {
  value = module.contract.aurora_identifiers["api-15"]
}

output "api15_aurora_arn" {
  value = module.api15_aurora.db_instance_arn
}

output "api15_secret_arn" {
  value = module.api15_aurora.secret_arn
}

output "api16_rds_identifier" {
  value = module.contract.rds_identifiers["api-16"]
}

output "api16_rds_arn" {
  value = module.api16_rds.db_instance_arn
}

output "api16_secret_arn" {
  value = module.api16_rds.secret_arn
}

output "vpc_id" {
  value = data.aws_vpc.east_2.id
}

output "vpc_cidr" {
  value = data.aws_vpc.east_2.cidr_block
}

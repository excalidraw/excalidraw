output "api12_bucket_name" {
  value = module.api12_bucket.bucket_id
}

output "api12_bucket_arn" {
  value = module.api12_bucket.bucket_arn
}

output "api14_table_name" {
  value = module.api14_table.name
}

output "api14_table_arn" {
  value = module.api14_table.arn
}

output "vpc_id" {
  value = data.aws_vpc.west_1.id
}

output "vpc_cidr" {
  value = data.aws_vpc.west_1.cidr_block
}

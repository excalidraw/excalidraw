output "vpc_id" {
  value = module.network.vpc_id
}

output "vpc_cidr" {
  value = module.network.vpc_cidr_block
}

output "public_subnet_ids" {
  value = module.network.public_subnets
}

output "private_subnet_ids" {
  value = module.network.private_subnets
}

output "intra_subnet_ids" {
  value = module.network.intra_subnets
}

output "private_route_table_ids" {
  value = module.network.private_route_table_ids
}

output "intra_route_table_ids" {
  value = module.network.intra_route_table_ids
}

output "execute_api_vpce_id" {
  value = aws_vpc_endpoint.execute_api.id
}

output "execute_api_vpce_sg_id" {
  value = module.network.interface_endpoint_security_group_id
}

output "transit_gateway_id" {
  value = try(aws_ec2_transit_gateway.this[0].id, null)
}

output "transit_gateway_default_route_table_id" {
  value = try(aws_ec2_transit_gateway.this[0].association_default_route_table_id, null)
}

output "transit_gateway_vpc_attachment_id" {
  value = try(aws_ec2_transit_gateway_vpc_attachment.this[0].id, null)
}

output "lambda_artifacts_bucket_id" {
  value = module.lambda_artifacts.s3_bucket_id
}

output "lambda_artifacts_bucket_arn" {
  value = module.lambda_artifacts.s3_bucket_arn
}

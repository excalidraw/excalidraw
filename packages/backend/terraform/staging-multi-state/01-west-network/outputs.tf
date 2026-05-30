output "vpc_id" {
  value = module.west_network.vpc_id
}

output "vpc_cidr" {
  value = module.west_network.vpc_cidr_block
}

output "public_subnet_ids" {
  value = module.west_network.public_subnets
}

output "private_subnet_ids" {
  value = module.west_network.private_subnets
}

output "intra_subnet_ids" {
  value = module.west_network.intra_subnets
}

output "database_subnet_ids" {
  value = module.west_network.database_subnets
}

output "database_route_table_ids" {
  value = module.west_network.database_route_table_ids
}

output "west_tgw_id" {
  value = aws_ec2_transit_gateway.west.id
}

output "west_tgw_vpc_attachment_id" {
  value = aws_ec2_transit_gateway_vpc_attachment.west_vpc.id
}

output "tgw_peering_attachment_id" {
  value = aws_ec2_transit_gateway_peering_attachment.west_to_east.id
}

output "execute_api_vpce_id" {
  value = aws_vpc_endpoint.execute_api.id
}

output "execute_api_vpce_sg_id" {
  value = module.west_network.interface_endpoint_security_group_id
}

output "aws_account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "lambda_artifacts_bucket_id" {
  value = module.lambda_artifacts.s3_bucket_id
}

output "lambda_artifacts_bucket_arn" {
  value = module.lambda_artifacts.s3_bucket_arn
}

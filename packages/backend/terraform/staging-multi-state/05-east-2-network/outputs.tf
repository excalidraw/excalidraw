output "vpc_id" {
  value = module.east_2_network.vpc_id
}

output "vpc_cidr" {
  value = module.east_2_network.vpc_cidr_block
}

output "public_subnet_ids" {
  value = module.east_2_network.public_subnets
}

output "private_subnet_ids" {
  value = module.east_2_network.private_subnets
}

output "intra_subnet_ids" {
  value = module.east_2_network.intra_subnets
}

output "database_subnet_ids" {
  value = module.east_2_network.database_subnets
}

output "database_route_table_ids" {
  value = module.east_2_network.database_route_table_ids
}

output "private_route_table_ids" {
  value = module.east_2_network.private_route_table_ids
}

output "intra_route_table_ids" {
  value = module.east_2_network.intra_route_table_ids
}

output "east_2_tgw_id" {
  value = aws_ec2_transit_gateway.east_2.id
}

output "east_2_tgw_default_route_table_id" {
  value = aws_ec2_transit_gateway.east_2.association_default_route_table_id
}

output "east_2_tgw_vpc_attachment_id" {
  value = aws_ec2_transit_gateway_vpc_attachment.east_2_vpc.id
}

output "execute_api_vpce_id" {
  value = aws_vpc_endpoint.execute_api.id
}

output "execute_api_vpce_sg_id" {
  value = module.east_2_network.interface_endpoint_security_group_id
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

output "tgw_peering_east_attachment_id" {
  value = aws_ec2_transit_gateway_peering_attachment.east_2_to_east.id
}

output "tgw_peering_west_attachment_id" {
  value = aws_ec2_transit_gateway_peering_attachment.east_2_to_west.id
}

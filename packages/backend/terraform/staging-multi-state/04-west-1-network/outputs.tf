output "vpc_id" {
  value = module.west_1_network.vpc_id
}

output "vpc_cidr" {
  value = module.west_1_network.vpc_cidr_block
}

output "public_subnet_ids" {
  value = module.west_1_network.public_subnets
}

output "private_subnet_ids" {
  value = module.west_1_network.private_subnets
}

output "intra_subnet_ids" {
  value = module.west_1_network.intra_subnets
}

output "database_subnet_ids" {
  value = module.west_1_network.database_subnets
}

output "database_route_table_ids" {
  value = module.west_1_network.database_route_table_ids
}

output "private_route_table_ids" {
  value = module.west_1_network.private_route_table_ids
}

output "intra_route_table_ids" {
  value = module.west_1_network.intra_route_table_ids
}

output "west_1_tgw_id" {
  value = aws_ec2_transit_gateway.west_1.id
}

output "west_1_tgw_default_route_table_id" {
  value = aws_ec2_transit_gateway.west_1.association_default_route_table_id
}

output "west_1_tgw_vpc_attachment_id" {
  value = aws_ec2_transit_gateway_vpc_attachment.west_1_vpc.id
}

output "execute_api_vpce_id" {
  value = aws_vpc_endpoint.execute_api.id
}

output "execute_api_vpce_sg_id" {
  value = module.west_1_network.interface_endpoint_security_group_id
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
  value = aws_ec2_transit_gateway_peering_attachment.west_1_to_east.id
}

output "tgw_peering_west_attachment_id" {
  value = aws_ec2_transit_gateway_peering_attachment.west_1_to_west.id
}

output "tgw_peering_east_2_attachment_id" {
  value = aws_ec2_transit_gateway_peering_attachment.west_1_to_east_2.id
}

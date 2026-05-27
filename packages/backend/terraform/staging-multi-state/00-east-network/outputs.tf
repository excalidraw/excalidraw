output "vpc_id" {
  value = module.east_network.vpc_id
}

output "vpc_cidr" {
  value = module.east_network.vpc_cidr_block
}

output "public_subnet_ids" {
  value = module.east_network.public_subnets
}

output "private_subnet_ids" {
  value = module.east_network.private_subnets
}

output "intra_subnet_ids" {
  value = module.east_network.intra_subnets
}

output "private_route_table_ids" {
  value = module.east_network.private_route_table_ids
}

output "intra_route_table_ids" {
  value = module.east_network.intra_route_table_ids
}

output "execute_api_vpce_id" {
  value = aws_vpc_endpoint.execute_api.id
}

output "execute_api_vpce_sg_id" {
  value = module.east_network.interface_endpoint_security_group_id
}

output "east_tgw_id" {
  value = aws_ec2_transit_gateway.east.id
}

output "east_tgw_default_route_table_id" {
  value = aws_ec2_transit_gateway.east.association_default_route_table_id
}

output "east_tgw_vpc_attachment_id" {
  value = aws_ec2_transit_gateway_vpc_attachment.east_vpc.id
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

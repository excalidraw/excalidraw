output "vpc_id" {
  value = module.network.vpc_id
}

output "vpc_cidr" {
  value = module.network.vpc_cidr
}

output "public_subnet_ids" {
  value = module.network.public_subnet_ids
}

output "private_subnet_ids" {
  value = module.network.private_subnet_ids
}

output "intra_subnet_ids" {
  value = module.network.intra_subnet_ids
}

output "private_route_table_ids" {
  value = module.network.private_route_table_ids
}

output "intra_route_table_ids" {
  value = module.network.intra_route_table_ids
}

output "execute_api_vpce_id" {
  value = module.network.execute_api_vpce_id
}

output "execute_api_vpce_sg_id" {
  value = module.network.execute_api_vpce_sg_id
}

output "transit_gateway_id" {
  value = module.network.transit_gateway_id
}

output "transit_gateway_default_route_table_id" {
  value = module.network.transit_gateway_default_route_table_id
}

output "aws_account_id" {
  value = data.terraform_remote_state.east_network.outputs.aws_account_id
}

output "lambda_artifacts_bucket_id" {
  value = module.network.lambda_artifacts_bucket_id
}

output "lambda_artifacts_bucket_arn" {
  value = module.network.lambda_artifacts_bucket_arn
}

output "aws_region" {
  value = var.aws_region
}

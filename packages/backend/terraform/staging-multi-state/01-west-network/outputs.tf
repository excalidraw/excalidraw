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

output "west_tgw_id" {
  value = aws_ec2_transit_gateway.west.id
}

output "west_tgw_vpc_attachment_id" {
  value = aws_ec2_transit_gateway_vpc_attachment.west_vpc.id
}

output "tgw_peering_attachment_id" {
  value = aws_ec2_transit_gateway_peering_attachment.west_to_east.id
}

output "vpc_id" {
  description = "VPC ID for workload subnets."
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "Allocated VPC IPv4 CIDR."
  value       = module.vpc.vpc_cidr_block
}

output "intra_subnets" {
  description = "Isolated subnet IDs for Lambda ENIs and interface endpoints."
  value       = module.vpc.intra_subnets
}

output "intra_route_table_ids" {
  description = "Route tables associated with intra subnets (S3 gateway endpoint)."
  value       = module.vpc.intra_route_table_ids
}

output "interface_endpoint_security_group_id" {
  description = "Security group attached to interface VPC endpoints."
  value       = module.interface_endpoint_security_group.security_group_id
}

output "managed_service_endpoints" {
  description = "Created gateway + interface endpoints (module aws provider objects)."
  value       = module.managed_service_endpoints.endpoints
}

output "flow_log_id" {
  description = "VPC Flow Log resource ID."
  value       = module.vpc_flow_logs.flow_log_id
}

output "flow_log_group_name" {
  description = "CloudWatch Logs group receiving VPC Flow Logs."
  value       = module.vpc_flow_logs.log_group_name
}

output "flow_log_group_arn" {
  description = "CloudWatch Logs group ARN for VPC Flow Logs."
  value       = module.vpc_flow_logs.log_group_arn
}

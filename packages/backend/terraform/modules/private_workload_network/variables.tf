variable "vpc_name" {
  type        = string
  description = "Name prefix for the VPC module."
}

variable "vpc_cidr" {
  type        = string
  description = "VPC IPv4 CIDR (used for interface endpoint SG ingress/egress)."
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "One public subnet CIDR per AZ (internet gateway + NAT gateway placement)."
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "One private subnet CIDR per AZ (default route via NAT for outbound internet)."
}

variable "intra_subnet_cidrs" {
  type        = list(string)
  description = "One isolated subnet CIDR per AZ (module picks the first N AZs)."

  validation {
    condition = (
      length(var.intra_subnet_cidrs) > 0 &&
      length(var.intra_subnet_cidrs) == length(var.public_subnet_cidrs) &&
      length(var.intra_subnet_cidrs) == length(var.private_subnet_cidrs) &&
      length(var.intra_subnet_cidrs) == length(var.database_subnet_cidrs)
    )
    error_message = "public_subnet_cidrs, private_subnet_cidrs, intra_subnet_cidrs, and database_subnet_cidrs must be the same non-zero length (one CIDR per AZ)."
  }
}

variable "database_subnet_cidrs" {
  type        = list(string)
  description = "One database subnet CIDR per AZ for RDS/Aurora subnet groups."
}

variable "single_nat_gateway" {
  type        = bool
  default     = false
  description = "If true, a single NAT gateway serves all private subnets (lower cost). If false, one NAT gateway per AZ (recommended for production availability)."
}

variable "interface_endpoint_security_group_name" {
  type        = string
  default     = "ts-test-vpce-sg"
  description = "Security group for AWS API interface endpoints (SQS, Logs, X-Ray)."
}

variable "interface_endpoint_security_group_description" {
  type        = string
  default     = "Allows HTTPS from VPC workloads to interface VPC endpoints"
  description = "Description for interface_endpoint_security_group."
}

variable "flow_logs_log_group_name" {
  type        = string
  default     = "/aws/vpc/ts-test-lambda-flow"
  description = "CloudWatch Logs group receiving VPC Flow Logs."
}

variable "flow_logs_log_retention_in_days" {
  type        = number
  default     = 30
  description = "Retention period for the VPC Flow Logs CloudWatch log group."
}

variable "flow_logs_traffic_type" {
  type        = string
  default     = "ALL"
  description = "Traffic type captured by VPC Flow Logs: ACCEPT, REJECT, or ALL."

  validation {
    condition     = contains(["ACCEPT", "REJECT", "ALL"], var.flow_logs_traffic_type)
    error_message = "flow_logs_traffic_type must be one of ACCEPT, REJECT, or ALL."
  }
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags applied to VPC, security group, and endpoint resources."
}

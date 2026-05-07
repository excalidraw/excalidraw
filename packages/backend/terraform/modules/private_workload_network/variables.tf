variable "vpc_name" {
  type        = string
  description = "Name prefix for the VPC module."
}

variable "vpc_cidr" {
  type        = string
  description = "VPC IPv4 CIDR (used for interface endpoint SG ingress/egress)."
}

variable "intra_subnet_cidrs" {
  type        = list(string)
  description = "One isolated subnet CIDR per AZ (module picks the first N AZs)."
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

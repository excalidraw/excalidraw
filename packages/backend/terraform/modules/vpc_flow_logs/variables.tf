variable "name_prefix" {
  type        = string
  description = "Prefix used for the VPC Flow Logs publishing IAM role name."
}

variable "log_group_name" {
  type        = string
  description = "CloudWatch Logs group receiving VPC Flow Logs."
}

variable "log_retention_in_days" {
  type        = number
  default     = 30
  description = "Retention period for the VPC Flow Logs CloudWatch log group."
}

variable "traffic_type" {
  type        = string
  default     = "ALL"
  description = "Traffic type captured by VPC Flow Logs: ACCEPT, REJECT, or ALL."

  validation {
    condition     = contains(["ACCEPT", "REJECT", "ALL"], var.traffic_type)
    error_message = "traffic_type must be one of ACCEPT, REJECT, or ALL."
  }
}

variable "vpc_id" {
  type        = string
  description = "VPC ID to enable flow logs for."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags applied to the VPC Flow Logs resources."
}

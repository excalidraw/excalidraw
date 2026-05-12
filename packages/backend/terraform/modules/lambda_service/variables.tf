variable "function_name" {
  type = string
}

variable "lambda_role" {
  type        = string
  description = "Friendly IAM role name passed to terraform-aws-modules/lambda"
}

variable "handler" {
  type = string
}

variable "runtime" {
  type    = string
  default = "python3.12"
}

variable "s3_existing_package" {
  type = object({
    bucket = string
    key    = string
  })
}

variable "enable_vpc" {
  type        = bool
  default     = false
  description = "Set true when this Lambda runs in a VPC. Must be a literal (not computed) so plan-time counts stay known."
}

variable "vpc_subnet_ids" {
  type        = list(string)
  default     = []
  description = "Subnet IDs when enable_vpc is true."
}

variable "vpc_id" {
  type        = string
  default     = null
  description = "VPC ID for Lambda security group when enable_vpc is true."
}

variable "security_group_name" {
  type        = string
  default     = null
  description = "Required when vpc_id is set."
}

variable "security_group_description" {
  type    = string
  default = "Security group for Lambda in VPC"
}

variable "vpc_ingress_cidr_blocks" {
  type        = list(string)
  default     = []
  description = "Optional ingress CIDRs; Lambdas rarely need inbound rules."
}

variable "vpc_cidr_for_restricted_egress" {
  type        = string
  default     = null
  nullable    = true
  description = "Known VPC CIDR (same as workload VPC) for restricted SG egress: HTTPS+DNS in-VPC plus S3 via regional prefix list."
}

variable "allow_internet_https_egress" {
  type        = bool
  default     = false
  description = "When true and restricted VPC egress is enabled, allow HTTPS (443) to 0.0.0.0/0 (use with NAT gateway in private subnets)."
}

variable "environment_variables" {
  type    = map(string)
  default = {}
}

variable "tracing_mode" {
  type    = string
  default = "Active"
}

variable "attach_policy_statements" {
  type    = bool
  default = false
}

variable "policy_statements" {
  type    = any
  default = {}
}

variable "create_errors_alarm" {
  type    = bool
  default = true
}

variable "errors_alarm_name" {
  type        = string
  default     = null
  description = "Defaults to \"<function_name>-errors\"."
}

variable "errors_alarm_period_seconds" {
  type    = number
  default = 60
}

variable "errors_alarm_threshold" {
  type    = number
  default = 0
}

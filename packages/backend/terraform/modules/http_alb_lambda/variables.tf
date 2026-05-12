variable "name_prefix" {
  type        = string
  description = "Short prefix for resource Name tags and TG name_prefix (keep short; target group name_prefix is limited)."
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnets for the internet-facing ALB (minimum two AZs)."
}

variable "lambda_function_arn" {
  type        = string
  description = "Qualified or unqualified Lambda function ARN registered as the sole target."
}

variable "lambda_function_name" {
  type        = string
  description = "Lambda function name for aws_lambda_permission.function_name."
}

variable "listener_port" {
  type        = number
  default     = 80
  description = "Listener port when acm_certificate_arn is null (HTTP only). Ignored when acm_certificate_arn is set (443 HTTPS + 80 redirect)."
}

variable "acm_certificate_arn" {
  type        = string
  default     = null
  nullable    = true
  description = "If set, terminate TLS on port 443 and redirect HTTP 80 to HTTPS."
}

variable "deletion_protection" {
  type        = bool
  default     = true
  description = "Enable ALB deletion protection (recommended for production)."
}

variable "idle_timeout" {
  type        = number
  default     = 60
  description = "ALB idle timeout in seconds."
}

variable "internet_ingress_cidr_blocks" {
  type        = list(string)
  default     = ["0.0.0.0/0"]
  description = "CIDRs allowed to reach the ALB listener ports (default public internet)."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags applied to ALB, security group, listeners, and target group."
}

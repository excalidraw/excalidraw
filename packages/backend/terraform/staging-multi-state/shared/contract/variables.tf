variable "environment" {
  type        = string
  description = "Deployment environment prefix for resource names."
  default     = "staging"
}

variable "aws_account_id" {
  type        = string
  description = "12-digit AWS account ID used in globally-unique name patterns (S3 buckets)."
  default     = ""
}

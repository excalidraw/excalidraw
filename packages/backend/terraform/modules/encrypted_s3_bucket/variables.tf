variable "bucket_name" {
  type = string
}

variable "kms_description" {
  type    = string
  default = "KMS key for S3 bucket encryption"
}

variable "kms_deletion_window_in_days" {
  type    = number
  default = 7
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "create_bucket_size_alarm" {
  type    = bool
  default = true
}

variable "bucket_size_alarm_name" {
  type    = string
  default = null
}

variable "bucket_size_bytes_threshold" {
  type        = number
  default     = 1099511627776
  description = "Default 1 TiB — tune per environment."
}

variable "bucket_size_alarm_period_seconds" {
  type    = number
  default = 86400
}

variable "create_object_count_alarm" {
  type    = bool
  default = true
}

variable "object_count_alarm_name" {
  type    = string
  default = null
}

variable "object_count_threshold" {
  type        = number
  default     = 1000000
  description = "Alarm when StandardStorage object count exceeds this value."
}

variable "object_count_alarm_period_seconds" {
  type    = number
  default = 86400
}

variable "attach_deny_insecure_transport_policy" {
  type        = bool
  default     = true
  description = "Deny all S3 actions when aws:SecureTransport is false."
}

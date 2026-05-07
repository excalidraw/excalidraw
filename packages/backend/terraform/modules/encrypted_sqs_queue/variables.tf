variable "queue_name" {
  type = string
}

variable "dlq_name" {
  type = string
}

variable "kms_description" {
  type    = string
  default = "KMS key for SQS encryption"
}

variable "kms_deletion_window_in_days" {
  type    = number
  default = 7
}

variable "create_dlq" {
  type    = bool
  default = true
}

variable "redrive_policy" {
  type = object({
    maxReceiveCount = number
  })
  default = {
    maxReceiveCount = 3
  }
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "visible_messages_alarm_name" {
  type    = string
  default = null
}

variable "visible_messages_threshold" {
  type    = number
  default = 100
}

variable "visible_messages_period_seconds" {
  type    = number
  default = 300
}

variable "dlq_messages_alarm_name" {
  type    = string
  default = null
}

variable "dlq_messages_period_seconds" {
  type    = number
  default = 300
}

variable "attach_deny_insecure_transport_policy" {
  type        = bool
  default     = true
  description = "Deny SQS API calls over plaintext HTTP."
}

variable "bucket_name" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

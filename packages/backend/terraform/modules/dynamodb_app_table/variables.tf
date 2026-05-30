variable "name" {
  type = string
}

variable "hash_key" {
  type    = string
  default = "id"
}

variable "tags" {
  type    = map(string)
  default = {}
}

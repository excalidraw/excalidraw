variable "identifier" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "database_subnet_ids" {
  type = list(string)
}

variable "allowed_security_group_ids" {
  type = list(string)
}

variable "peer_vpc_cidr_blocks" {
  type    = list(string)
  default = []
}

variable "db_name" {
  type = string
}

variable "username" {
  type    = string
  default = "apiuser"
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "environment" {
  type = string
}

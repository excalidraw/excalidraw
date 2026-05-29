resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.environment}-${var.name}-vpc"
  }
}

resource "aws_subnet" "private" {
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.subnet_cidr
  map_public_ip_on_launch = false

  tags = {
    Name = "${var.environment}-${var.name}-private"
  }
}

resource "aws_security_group" "lambda" {
  name        = "${var.environment}-${var.name}-lambda-sg"
  description = "Lambda security group for ${var.name}"
  vpc_id      = aws_vpc.this.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.environment}-${var.name}-lambda-sg"
  }
}

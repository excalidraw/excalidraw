locals {
  tags = merge(var.tags, { Environment = var.environment })
}

resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

module "security_group" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "5.3.0"

  name        = "${var.identifier}-postgres"
  description = "PostgreSQL access for ${var.identifier}"
  vpc_id      = var.vpc_id

  ingress_with_source_security_group_id = [
    for sg_id in var.allowed_security_group_ids : {
      rule                     = "postgresql-tcp"
      description              = "PostgreSQL from allowed security group"
      source_security_group_id = sg_id
    }
  ]

  ingress_with_cidr_blocks = [
    for cidr in var.peer_vpc_cidr_blocks : {
      rule        = "postgresql-tcp"
      description = "PostgreSQL from peer VPC CIDR"
      cidr_blocks = cidr
    }
  ]

  egress_rules = ["all-all"]

  tags = local.tags
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.identifier}-subnet-group"
  subnet_ids = var.database_subnet_ids

  tags = merge(local.tags, {
    Name = "${var.identifier}-subnet-group"
  })
}

resource "aws_db_instance" "this" {
  identifier = var.identifier

  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.username
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [module.security_group.security_group_id]

  multi_az            = true
  publicly_accessible = false

  skip_final_snapshot = true
  deletion_protection = false

  tags = local.tags
}

resource "aws_secretsmanager_secret" "db" {
  name = "${var.identifier}-db-credentials"
  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    host     = aws_db_instance.this.address
    port     = aws_db_instance.this.port
    dbname   = var.db_name
    username = var.username
    password = random_password.db.result
  })
}

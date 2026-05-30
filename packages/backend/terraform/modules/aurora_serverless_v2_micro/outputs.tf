output "endpoint" {
  value = aws_rds_cluster.this.endpoint
}

output "port" {
  value = aws_rds_cluster.this.port
}

output "secret_arn" {
  value = aws_secretsmanager_secret.db.arn
}

output "security_group_id" {
  value = module.security_group.security_group_id
}

output "db_instance_arn" {
  value = aws_rds_cluster.this.arn
}

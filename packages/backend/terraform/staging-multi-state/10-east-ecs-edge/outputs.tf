output "ecs_task_role_arn" {
  value = aws_iam_role.ecs_task.arn
}

output "ecs_task_role_name" {
  value = aws_iam_role.ecs_task.name
}

output "ecs_service_name" {
  value = aws_ecs_service.producer.name
}

output "ecs_cluster_arn" {
  value = aws_ecs_cluster.this.arn
}

output "alb_dns_name" {
  value = aws_lb.ecs.dns_name
}

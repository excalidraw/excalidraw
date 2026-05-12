output "lb_id" {
  value       = aws_lb.this.id
  description = "Application Load Balancer ID."
}

output "lb_arn" {
  value       = aws_lb.this.arn
  description = "Application Load Balancer ARN."
}

output "lb_dns_name" {
  value       = aws_lb.this.dns_name
  description = "DNS name of the load balancer (use this as the public hostname)."
}

output "lb_zone_id" {
  value       = aws_lb.this.zone_id
  description = "Route53 zone ID for alias records."
}

output "target_group_arn" {
  value       = aws_lb_target_group.lambda.arn
  description = "Target group ARN (Lambda target type)."
}

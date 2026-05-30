output "vpc_id" {
  value = aws_vpc.this.id
}

output "vpc_cidr" {
  value = aws_vpc.this.cidr_block
}

output "private_subnet_ids" {
  value = [aws_subnet.private.id]
}

output "lambda_security_group_id" {
  value = aws_security_group.lambda.id
}

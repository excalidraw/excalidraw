resource "aws_s3_bucket" "data" {
  bucket = "ts-test-lambda-data"
}

resource "aws_sqs_queue" "data" {
  name = "ts-test-lambda-queue"
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  lambda_private_subnet_cidrs = ["10.42.1.0/24", "10.42.2.0/24"]
  lambda_private_subnet_map = {
    for idx, cidr in local.lambda_private_subnet_cidrs :
    tostring(idx) => cidr
    if idx < length(data.aws_availability_zones.available.names)
  }
}

resource "aws_vpc" "lambda" {
  cidr_block           = "10.42.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}

resource "aws_subnet" "lambda_private" {
  for_each = local.lambda_private_subnet_map

  vpc_id                  = aws_vpc.lambda.id
  cidr_block              = each.value
  availability_zone       = data.aws_availability_zones.available.names[tonumber(each.key)]
  map_public_ip_on_launch = false
}

resource "aws_route_table" "lambda_private" {
  vpc_id = aws_vpc.lambda.id
}

resource "aws_route_table_association" "lambda_private" {
  for_each = aws_subnet.lambda_private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.lambda_private.id
}

resource "aws_security_group" "lambda" {
  name        = "ts-test-lambda-sg"
  description = "Security group for Lambda functions in VPC"
  vpc_id      = aws_vpc.lambda.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- Lambda: writer ---

module "lambda-writer" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "8.7.0"

  function_name = "test-writer"
  lambda_role   = "test-writer"
  handler       = "main.writer_handler"
  runtime       = "python3.12"

  create_package = false
  s3_existing_package = {
    bucket = aws_s3_bucket.lambda_artifacts.id
    key    = aws_s3_object.lambda_zip.key
  }
  vpc_subnet_ids         = [for subnet in aws_subnet.lambda_private : subnet.id]
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    DATA_BUCKET    = aws_s3_bucket.data.id
    DATA_QUEUE_URL = aws_sqs_queue.data.url
  }

  attach_policy_statements = true
  policy_statements = {
    s3_write = {
      effect    = "Allow"
      actions   = ["s3:PutObject"]
      resources = ["${aws_s3_bucket.data.arn}/*"]
    }
    sqs_send = {
      effect    = "Allow"
      actions   = ["sqs:SendMessage"]
      resources = [aws_sqs_queue.data.arn]
    }
    vpc_network = {
      effect = "Allow"
      actions = [
        "ec2:CreateNetworkInterface",
        "ec2:DeleteNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:AssignPrivateIpAddresses",
        "ec2:UnassignPrivateIpAddresses",
      ]
      resources = ["*"]
    }
  }
}

# --- Lambda: reader ---
/*
module "lambda-reader" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "8.7.0"

  function_name = "test-reader"
  lambda_role   = "test-reader"
  handler       = "main.reader_handler"
  runtime       = "python3.12"

  create_package = false
  s3_existing_package = {
    bucket = aws_s3_bucket.lambda_artifacts.id
    key    = aws_s3_object.lambda_zip.key
  }
  vpc_subnet_ids         = [for subnet in aws_subnet.lambda_private : subnet.id]
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    DATA_BUCKET    = aws_s3_bucket.data.id
    DATA_QUEUE_URL = aws_sqs_queue.data.url
  }

  attach_policy_statements = true
  policy_statements = {
    s3_read = {
      effect    = "Allow"
      actions   = ["s3:GetObject", "s3:ListBucket"]
      resources = [aws_s3_bucket.data.arn, "${aws_s3_bucket.data.arn}/*"]
    }
    sqs_receive = {
      effect    = "Allow"
      actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
      resources = [aws_sqs_queue.data.arn]
    }
    vpc_network = {
      effect = "Allow"
      actions = [
        "ec2:CreateNetworkInterface",
        "ec2:DeleteNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:AssignPrivateIpAddresses",
        "ec2:UnassignPrivateIpAddresses",
      ]
      resources = ["*"]
    }
  }
}*/
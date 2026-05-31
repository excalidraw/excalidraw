terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.5"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

module "contract" {
  source = "../shared/contract"

  environment    = var.environment
  aws_account_id = var.aws_account_id
}

locals {
  terraform_deploy_role_arn = trimspace(var.terraform_deploy_role_arn) != "" ? trimspace(var.terraform_deploy_role_arn) : "arn:aws:iam::${var.aws_account_id}:role/${var.terraform_deploy_role_name}"

  tags = {
    environment = var.environment
    stack       = "staging-multi-state"
    state       = "10-east-ecs-edge"
    managed_by  = "terraform"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-east-ecs"
  }

  default_tags {
    tags = local.tags
  }
}

check "assume_role_configured" {
  assert {
    condition     = trimspace(var.terraform_deploy_role_arn) != "" || can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "Set terraform_deploy_role_arn or a 12-digit aws_account_id."
  }
}

data "aws_vpc" "east" {
  filter {
    name   = "tag:Name"
    values = [module.contract.vpc_names.east]
  }
}

data "aws_subnets" "east_public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.east.id]
  }
  filter {
    name   = "tag:Name"
    values = ["${module.contract.vpc_names.east}-public-*"]
  }
}

data "aws_subnets" "east_private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.east.id]
  }
  filter {
    name   = "tag:Name"
    values = ["${module.contract.vpc_names.east}-private-*"]
  }
}

data "aws_sqs_queue" "egress" {
  name = module.contract.egress_queue_name
}

data "aws_s3_bucket" "lambda_artifacts" {
  bucket = module.contract.lambda_artifacts_bucket_names.east
}

resource "aws_s3_object" "egress_worker_script" {
  bucket = data.aws_s3_bucket.lambda_artifacts.id
  key    = "egress/egress_worker.py"
  source = "${path.module}/src/egress_worker.py"
  etag   = filemd5("${path.module}/src/egress_worker.py")

  server_side_encryption = "AES256"
}

resource "aws_security_group" "ecs_service" {
  name        = "${var.environment}-ecs-service-sg"
  description = "Security group for ECS tasks"
  vpc_id      = data.aws_vpc.east.id

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "alb" {
  name        = "${var.environment}-ecs-alb-sg"
  description = "Security group for public ALB"
  vpc_id      = data.aws_vpc.east.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_service.id]
  }
}

resource "aws_security_group_rule" "ecs_ingress_from_alb" {
  type                     = "ingress"
  from_port                = 8080
  to_port                  = 8080
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs_service.id
  source_security_group_id = aws_security_group.alb.id
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/aws/ecs/${var.environment}/producer"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "egress" {
  name              = "/aws/ecs/${var.environment}/egress"
  retention_in_days = 30
}

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${var.environment}-ecs-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

data "aws_iam_policy_document" "ecs_task_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name               = "${var.environment}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

data "aws_iam_policy_document" "egress_task" {
  statement {
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:ChangeMessageVisibility",
    ]
    resources = [data.aws_sqs_queue.egress.arn]
  }

  statement {
    effect    = "Allow"
    actions   = ["kms:Decrypt", "kms:DescribeKey", "kms:GenerateDataKey"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["sqs.${var.aws_region}.amazonaws.com"]
    }
  }

  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
    ]
    resources = ["${data.aws_s3_bucket.lambda_artifacts.arn}/egress/egress_worker.py"]
  }
}

resource "aws_iam_role_policy" "egress_task" {
  name   = "${var.environment}-ecs-egress-sqs"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.egress_task.json
}

resource "aws_ecs_cluster" "this" {
  name = "${var.environment}-ecs-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_dynamodb_table" "config" {
  name         = "${var.environment}-ecs-config"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "config_key"

  attribute {
    name = "config_key"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
}

resource "aws_lb" "ecs" {
  name               = "${var.environment}-ecs-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = data.aws_subnets.east_public.ids
}

resource "aws_lb_target_group" "ecs" {
  name        = "${var.environment}-ecs-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.east.id
  target_type = "ip"

  health_check {
    path                = "/health"
    matcher             = "200-399"
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.ecs.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs.arn
  }
}

resource "aws_ecs_task_definition" "producer" {
  family                   = "${var.environment}-producer"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "producer"
      image     = "public.ecr.aws/docker/library/busybox:1.36"
      essential = true
      command   = ["sh", "-c", "while true; do sleep 300; done"]
      portMappings = [{
        containerPort = 8080
        hostPort      = 8080
        protocol      = "tcp"
      }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
}

resource "aws_ecs_task_definition" "egress" {
  family                   = "${var.environment}-egress"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "egress"
      image     = "public.ecr.aws/docker/library/python:3.12-slim"
      essential = true
      command = [
        "sh",
        "-c",
        "pip install -q boto3 && python -c \"import boto3; s3=boto3.client('s3'); s3.download_file('${data.aws_s3_bucket.lambda_artifacts.id}', '${aws_s3_object.egress_worker_script.key}', '/tmp/egress_worker.py')\" && EGRESS_QUEUE_URL=${data.aws_sqs_queue.egress.url} python /tmp/egress_worker.py",
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.egress.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "egress"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "producer" {
  name            = module.contract.producer_ecs_name
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.producer.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    assign_public_ip = false
    security_groups  = [aws_security_group.ecs_service.id]
    subnets          = data.aws_subnets.east_private.ids
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ecs.arn
    container_name   = "producer"
    container_port   = 8080
  }

  depends_on = [aws_lb_listener.http]
}

resource "aws_ecs_service" "egress" {
  name            = module.contract.egress_ecs_name
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.egress.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    assign_public_ip = false
    security_groups  = [aws_security_group.ecs_service.id]
    subnets          = data.aws_subnets.east_private.ids
  }
}

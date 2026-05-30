terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

locals {
  name_prefix  = "${var.environment}-${var.name}"
  ssm_prefix   = "/${var.environment}/${var.name}"
  cluster_name = local.name_prefix
  use_ec2      = var.launch_type == "EC2"
  common_tags = merge(
    var.tags,
    {
      service = var.name
    },
  )

  downstream_env = {
    for key, url in var.downstream_api_urls :
    "DOWNSTREAM_${upper(replace(key, "-", "_"))}_URL" => url
  }

  secret_env = merge(
    trimspace(var.db_secret_arn) != "" ? { DB_SECRET_ARN = var.db_secret_arn } : {},
    {
      for idx, arn in var.additional_db_secret_arns :
      "DB_SECRET_ARN_${idx + 2}" => arn
    },
  )

  container_environment = merge(
    {
      APP_CONFIG_PATH = local.ssm_prefix
      SERVICE_NAME    = var.name
      CONTAINER_PORT  = tostring(var.container_port)
    },
    local.secret_env,
    local.downstream_env,
  )

  openapi_body = templatefile("${path.module}/openapi.tftpl", {
    api_name         = local.name_prefix
    operation_suffix = replace(var.name, "-", "")
    nlb_dns_name     = aws_lb.internal.dns_name
    container_port   = var.container_port
    vpc_link_id      = aws_api_gateway_vpc_link.this.id
  })

  task_policy_statements = merge(
    {
      ssm_read = {
        effect  = "Allow"
        actions = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
        resources = [
          "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter${local.ssm_prefix}*",
          "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.environment}/shared/*",
        ]
      }
    },
    trimspace(var.dynamodb_table_arn) != "" ? {
      dynamodb = {
        effect = "Allow"
        actions = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
        ]
        resources = [var.dynamodb_table_arn, "${var.dynamodb_table_arn}/index/*"]
      }
    } : {},
    length(var.s3_bucket_arns) > 0 ? {
      s3 = {
        effect = "Allow"
        actions = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ]
        resources = flatten([
          for arn in var.s3_bucket_arns : [arn, "${arn}/*"]
        ])
      }
    } : {},
    trimspace(var.db_secret_arn) != "" || length(var.additional_db_secret_arns) > 0 ? {
      secrets = {
        effect = "Allow"
        actions = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ]
        resources = compact(concat(
          trimspace(var.db_secret_arn) != "" ? [var.db_secret_arn] : [],
          var.additional_db_secret_arns,
        ))
      }
    } : {},
    length(var.downstream_api_urls) > 0 ? {
      downstream_invoke = {
        effect    = "Allow"
        actions   = ["execute-api:Invoke"]
        resources = ["arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:*/*"]
      }
    } : {},
  )
}

resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${substr(replace(local.name_prefix, "_", "-"), 0, 20)}-ecs-"
  description = "ECS tasks for ${local.name_prefix}"
  vpc_id      = var.vpc_id

  ingress {
    description = "From VPC via internal NLB"
    from_port   = var.container_port
    to_port     = var.container_port
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "HTTPS egress"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-ecs-sg" })
}

resource "aws_lb" "internal" {
  name               = substr(replace("${local.name_prefix}-nlb", "_", "-"), 0, 32)
  internal           = true
  load_balancer_type = "network"
  subnets            = var.private_subnet_ids

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-nlb" })
}

resource "aws_lb_target_group" "api" {
  name_prefix = substr(replace("${var.name}-tg", "_", "-"), 0, 6)
  port        = var.container_port
  protocol    = "TCP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-tg" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lb_listener" "tcp" {
  load_balancer_arn = aws_lb.internal.arn
  port              = var.container_port
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/aws/ecs/${local.name_prefix}"
  retention_in_days = 30
  tags              = local.common_tags
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

data "aws_iam_policy_document" "ecs_instance_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${local.name_prefix}-task-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name               = "${local.name_prefix}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "ecs_task" {
  dynamic "statement" {
    for_each = local.task_policy_statements

    content {
      effect    = statement.value.effect
      actions   = statement.value.actions
      resources = statement.value.resources
    }
  }
}

resource "aws_iam_role_policy" "ecs_task" {
  name   = "${local.name_prefix}-task"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.ecs_task.json
}

resource "aws_ecs_cluster" "api" {
  name = local.cluster_name

  tags = local.common_tags
}

resource "aws_ecs_cluster_capacity_providers" "api" {
  count = local.use_ec2 ? 1 : 0

  cluster_name = aws_ecs_cluster.api.name
  capacity_providers = [
    aws_ecs_capacity_provider.ec2[0].name,
  ]

  default_capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.ec2[0].name
    weight            = 1
  }
}

data "aws_ssm_parameter" "ecs_optimized_ami" {
  count = local.use_ec2 ? 1 : 0

  name = "/aws/service/ecs/optimized-ami/amazon-linux-2023/arm64/recommended"
}

locals {
  ecs_ami_id = local.use_ec2 ? jsondecode(data.aws_ssm_parameter.ecs_optimized_ami[0].value).image_id : null
}

resource "aws_iam_role" "ecs_instance" {
  count = local.use_ec2 ? 1 : 0

  name               = "${local.name_prefix}-ec2"
  assume_role_policy = data.aws_iam_policy_document.ecs_instance_assume.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_instance" {
  count = local.use_ec2 ? 1 : 0

  role       = aws_iam_role.ecs_instance[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_instance_profile" "ecs_instance" {
  count = local.use_ec2 ? 1 : 0

  name = "${local.name_prefix}-ec2"
  role = aws_iam_role.ecs_instance[0].name
}

resource "aws_launch_template" "ecs" {
  count = local.use_ec2 ? 1 : 0

  name_prefix   = "${local.name_prefix}-"
  image_id      = local.ecs_ami_id
  instance_type = "t4g.micro"

  iam_instance_profile {
    name = aws_iam_instance_profile.ecs_instance[0].name
  }

  vpc_security_group_ids = [aws_security_group.ecs_tasks.id]

  user_data = base64encode(<<-EOF
    #!/bin/bash
    echo "ECS_CLUSTER=${local.cluster_name}" >> /etc/ecs/ecs.config
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags          = merge(local.common_tags, { Name = "${local.name_prefix}-ecs" })
  }
}

resource "aws_autoscaling_group" "ecs" {
  count = local.use_ec2 ? 1 : 0

  name_prefix         = "${local.name_prefix}-"
  vpc_zone_identifier = var.private_subnet_ids
  min_size            = 2
  max_size            = 2
  desired_capacity    = 2

  launch_template {
    id      = aws_launch_template.ecs[0].id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${local.name_prefix}-ecs"
    propagate_at_launch = true
  }

  dynamic "tag" {
    for_each = local.common_tags

    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}

resource "aws_ecs_capacity_provider" "ec2" {
  count = local.use_ec2 ? 1 : 0

  name = "${local.name_prefix}-ec2"

  auto_scaling_group_provider {
    auto_scaling_group_arn         = aws_autoscaling_group.ecs[0].arn
    managed_termination_protection = "DISABLED"
  }

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "api" {
  family                   = local.name_prefix
  network_mode             = "awsvpc"
  requires_compatibilities = local.use_ec2 ? ["EC2"] : ["FARGATE"]
  cpu                      = local.use_ec2 ? "256" : "256"
  memory                   = local.use_ec2 ? "512" : "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.container_image
      essential = true
      command   = ["python", "-u", "-c", file("${path.module}/../../shared/api_server.py")]
      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        },
      ]
      environment = [
        for key, value in local.container_environment : {
          name  = key
          value = value
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "api"
        }
      }
    },
  ])

  tags = local.common_tags
}

resource "aws_ecs_service" "api" {
  name            = local.name_prefix
  cluster         = aws_ecs_cluster.api.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count

  launch_type = local.use_ec2 ? null : "FARGATE"

  dynamic "capacity_provider_strategy" {
    for_each = local.use_ec2 ? [1] : []

    content {
      capacity_provider = aws_ecs_capacity_provider.ec2[0].name
      weight            = 1
    }
  }

  network_configuration {
    assign_public_ip = false
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = var.private_subnet_ids
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = var.container_port
  }

  depends_on = [aws_lb_listener.tcp]

  tags = local.common_tags
}

resource "aws_api_gateway_vpc_link" "this" {
  name        = "${local.name_prefix}-vpc-link"
  description = "VPC link for ${local.name_prefix}"
  target_arns = [aws_lb.internal.arn]

  tags = local.common_tags
}

resource "aws_ssm_parameter" "api_name" {
  name        = "${local.ssm_prefix}/name"
  description = "API service name"
  type        = "String"
  value       = var.name
  tags        = local.common_tags
}

resource "aws_ssm_parameter" "api_region" {
  name        = "${local.ssm_prefix}/region"
  description = "API service region"
  type        = "String"
  value       = var.aws_region
  tags        = local.common_tags
}

resource "aws_api_gateway_rest_api" "private" {
  name = local.name_prefix
  body = local.openapi_body

  endpoint_configuration {
    types            = ["PRIVATE"]
    vpc_endpoint_ids = [var.execute_api_vpce_id]
  }

  policy = data.aws_iam_policy_document.api_resource_policy.json

  tags = local.common_tags
}

data "aws_iam_policy_document" "api_resource_policy" {
  statement {
    sid    = "AllowVpceInvoke"
    effect = "Allow"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions   = ["execute-api:Invoke"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceVpce"
      values   = [var.execute_api_vpce_id]
    }
  }
}

resource "aws_api_gateway_deployment" "this" {
  rest_api_id = aws_api_gateway_rest_api.private.id

  triggers = {
    redeploy = sha1(local.openapi_body)
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_cloudwatch_log_group" "api_access" {
  name              = "/aws/apigateway/${local.name_prefix}"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_api_gateway_stage" "stage" {
  stage_name    = var.stage_name
  rest_api_id   = aws_api_gateway_rest_api.private.id
  deployment_id = aws_api_gateway_deployment.this.id

  xray_tracing_enabled = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      sourceIp       = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
    })
  }

  tags = local.common_tags
}

resource "aws_api_gateway_method_settings" "all" {
  rest_api_id = aws_api_gateway_rest_api.private.id
  stage_name  = aws_api_gateway_stage.stage.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled = true
    logging_level   = "INFO"
  }
}

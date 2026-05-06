locals {
  # enable_vpc must be a literal bool from the root module so counts do not depend on unknown VPC outputs.
  use_vpc = var.enable_vpc

  restricted_sg_egress = var.enable_vpc && coalesce(var.vpc_cidr_for_restricted_egress, "") != ""

  alarm_name = coalesce(var.errors_alarm_name, "${var.function_name}-errors")
}

data "aws_region" "current" {}

# Gateway endpoint traffic targets the regional S3 prefix list (not your VPC CIDR).
data "aws_ec2_managed_prefix_list" "s3" {
  count = local.restricted_sg_egress ? 1 : 0

  filter {
    name   = "prefix-list-name"
    values = ["com.amazonaws.${data.aws_region.current.id}.s3"]
  }
}

module "security_group" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "5.3.0"

  count = local.use_vpc ? 1 : 0

  name        = var.security_group_name
  description = var.security_group_description
  vpc_id      = var.vpc_id

  ingress_with_cidr_blocks = [
    for cidr in var.vpc_ingress_cidr_blocks : {
      rule        = "https-443-tcp"
      description = "Optional ingress from VPC CIDR"
      cidr_blocks = cidr
    }
  ]

  egress_with_cidr_blocks = local.restricted_sg_egress ? [
    {
      rule        = "https-443-tcp"
      description = "Interface VPC endpoints (SQS, Logs, X-Ray)"
      cidr_blocks = var.vpc_cidr_for_restricted_egress
    },
    {
      rule        = "dns-udp"
      description = "VPC resolver"
      cidr_blocks = var.vpc_cidr_for_restricted_egress
    },
    {
      rule        = "dns-tcp"
      description = "VPC resolver"
      cidr_blocks = var.vpc_cidr_for_restricted_egress
    },
  ] : []

  egress_with_prefix_list_ids = local.restricted_sg_egress ? [
    {
      rule            = "https-443-tcp"
      description     = "HTTPS to S3 (gateway endpoint / prefix list)"
      prefix_list_ids = data.aws_ec2_managed_prefix_list.s3[0].id
    },
  ] : []

  egress_rules = local.restricted_sg_egress ? [] : ["all-all"]
}

module "lambda" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "8.7.0"

  function_name = var.function_name
  lambda_role   = var.lambda_role
  handler       = var.handler
  runtime       = var.runtime

  create_package      = false
  s3_existing_package = var.s3_existing_package

  vpc_subnet_ids = local.use_vpc ? var.vpc_subnet_ids : null
  vpc_security_group_ids = local.use_vpc ? (
    [module.security_group[0].security_group_id]
  ) : null

  tracing_mode = var.tracing_mode

  environment_variables = var.environment_variables

  attach_network_policy = local.use_vpc
  attach_tracing_policy = var.tracing_mode != null && var.tracing_mode != ""

  attach_policy_statements = var.attach_policy_statements
  policy_statements        = var.policy_statements
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  count = var.create_errors_alarm ? 1 : 0

  alarm_name          = local.alarm_name
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = var.errors_alarm_period_seconds
  statistic           = "Sum"
  threshold           = var.errors_alarm_threshold
  alarm_description   = "Alarm when Lambda errors occur"
  dimensions = {
    FunctionName = module.lambda.lambda_function_name
  }
}

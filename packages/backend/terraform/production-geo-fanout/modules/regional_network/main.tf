terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws]
    }
  }
}

locals {
  tags = merge(var.tags, {
    component = "regional-network"
  })
}

module "network" {
  source = "../../../modules/private_workload_network"

  vpc_name             = var.vpc_name
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  intra_subnet_cidrs   = var.intra_subnet_cidrs
  single_nat_gateway   = var.single_nat_gateway

  interface_endpoint_security_group_name = "${var.vpc_name}-vpce-sg"
  flow_logs_log_group_name               = "/aws/vpc/${var.vpc_name}/flow"

  tags = local.tags
}

resource "aws_vpc_endpoint" "execute_api" {
  vpc_id              = module.network.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.execute-api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = module.network.intra_subnets
  security_group_ids  = [module.network.interface_endpoint_security_group_id]
  private_dns_enabled = true

  tags = merge(local.tags, { Name = "${var.vpc_name}-execute-api-vpce" })
}

resource "aws_ec2_transit_gateway" "this" {
  count = var.create_transit_gateway ? 1 : 0

  description                     = "Transit Gateway for ${var.vpc_name}"
  amazon_side_asn                 = var.transit_gateway_asn
  auto_accept_shared_attachments  = "disable"
  default_route_table_association = "enable"
  default_route_table_propagation = "enable"
  dns_support                     = "enable"
  vpn_ecmp_support                = "enable"

  tags = merge(local.tags, { Name = "${var.environment}-${var.vpc_name}-tgw" })
}

resource "aws_ec2_transit_gateway_vpc_attachment" "this" {
  count = var.create_transit_gateway ? 1 : 0

  subnet_ids         = module.network.intra_subnets
  transit_gateway_id = aws_ec2_transit_gateway.this[0].id
  vpc_id             = module.network.vpc_id

  dns_support  = "enable"
  ipv6_support = "disable"

  tags = merge(local.tags, { Name = "${var.environment}-${var.vpc_name}-tgw-attachment" })
}

module "lambda_artifacts" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "5.8.0"

  bucket = "${var.environment}-${var.aws_account_id}-${var.vpc_name}-lambda-artifacts"

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true

  versioning = {
    status = "Enabled"
  }

  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm = "AES256"
      }
      bucket_key_enabled = true
    }
  }

  attach_deny_insecure_transport_policy = true

  tags = merge(local.tags, { purpose = "lambda-artifacts" })
}

data "aws_iam_policy_document" "apigw_assume" {
  count = var.configure_api_gateway_account ? 1 : 0

  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apigw_cloudwatch" {
  count = var.configure_api_gateway_account ? 1 : 0

  name               = "${var.environment}-${var.vpc_name}-apigw-cloudwatch"
  assume_role_policy = data.aws_iam_policy_document.apigw_assume[0].json
}

resource "aws_iam_role_policy_attachment" "apigw_cloudwatch" {
  count = var.configure_api_gateway_account ? 1 : 0

  role       = aws_iam_role.apigw_cloudwatch[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_api_gateway_account" "this" {
  count = var.configure_api_gateway_account ? 1 : 0

  cloudwatch_role_arn = aws_iam_role.apigw_cloudwatch[0].arn

  depends_on = [aws_iam_role_policy_attachment.apigw_cloudwatch]
}

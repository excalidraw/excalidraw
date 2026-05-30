terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
    archive = {
      source = "hashicorp/archive"
    }
  }
}

locals {
  lambda_zip_path   = "${path.module}/.build/${var.name}.zip"
  ssm_prefix        = "/${var.environment}/${var.name}"
  lambda_invoke_uri = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${module.lambda_service.lambda_function_arn}/invocations"

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

  lambda_environment = merge(
    {
      APP_CONFIG_PATH = local.ssm_prefix
    },
    local.secret_env,
    local.downstream_env,
  )

  lambda_policy_statements = merge(
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

  openapi_body = templatefile(var.openapi_template_path, {
    api_name          = "${var.environment}-${var.name}"
    operation_suffix  = replace(var.name, "-", "")
    lambda_invoke_uri = local.lambda_invoke_uri
  })
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = var.lambda_source_file
  output_path = local.lambda_zip_path
}

resource "aws_s3_object" "lambda_package" {
  bucket = var.artifact_bucket_id
  key    = "${var.name}/${data.archive_file.lambda_zip.output_md5}.zip"
  source = data.archive_file.lambda_zip.output_path
  etag   = data.archive_file.lambda_zip.output_md5

  server_side_encryption = "AES256"
}

module "lambda_service" {
  source = "../../../modules/lambda_service"

  function_name = "${var.environment}-${var.name}"
  lambda_role   = "${var.environment}-${var.name}"
  handler       = "main.handler"
  runtime       = "python3.12"

  enable_vpc = true

  s3_existing_package = {
    bucket = var.artifact_bucket_id
    key    = aws_s3_object.lambda_package.key
  }

  vpc_id                         = var.vpc_id
  vpc_subnet_ids                 = var.private_subnet_ids
  security_group_name            = "${var.environment}-${var.name}-sg"
  vpc_cidr_for_restricted_egress = var.vpc_cidr

  environment_variables = local.lambda_environment

  attach_policy_statements = true
  policy_statements        = local.lambda_policy_statements
}

resource "aws_ssm_parameter" "api_name" {
  name        = "${local.ssm_prefix}/name"
  description = "API service name"
  type        = "String"
  value       = var.name
}

resource "aws_ssm_parameter" "api_region" {
  name        = "${local.ssm_prefix}/region"
  description = "API service region"
  type        = "String"
  value       = var.aws_region
}

resource "aws_api_gateway_rest_api" "private" {
  name = "${var.environment}-${var.name}"
  body = local.openapi_body

  endpoint_configuration {
    types            = ["PRIVATE"]
    vpc_endpoint_ids = [var.execute_api_vpce_id]
  }

  policy = data.aws_iam_policy_document.api_resource_policy.json
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
  name              = "/aws/apigateway/${var.environment}-${var.name}"
  retention_in_days = 30
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

resource "aws_lambda_permission" "allow_apigw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_service.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.private.execution_arn}/*/*"
}

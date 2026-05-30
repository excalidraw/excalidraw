locals {
  localstack_base = "http://localhost:${var.localstack_port}"
}

provider "aws" {
  region                      = var.aws_region
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    apigateway = local.localstack_base
    ec2        = local.localstack_base
    iam        = local.localstack_base
    lambda     = local.localstack_base
    logs       = local.localstack_base
    s3         = local.localstack_base
    ssm        = local.localstack_base
    sts        = local.localstack_base
  }

  default_tags {
    tags = {
      environment = var.environment
      fixture     = "localstack-geo-fanout"
    }
  }
}

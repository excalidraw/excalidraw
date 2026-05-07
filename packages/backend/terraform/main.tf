/*
locals {
  workload_private_subnet_cidrs = ["10.42.1.0/24", "10.42.2.0/24"]
  # Literal — must match private_workload_network.vpc_cidr (lambda_service SG planning).
  workload_vpc_cidr = "10.42.0.0/16"

  workload_tags = {
    environment = "dev"
    owner       = "terraform-graph-demo"
  }
}

module "application_data_bucket" {
  source = "./modules/encrypted_s3_bucket"

  bucket_name = "ts-test-lambda-data"

  tags = local.workload_tags
}

module "application_job_queue" {
  source = "./modules/encrypted_sqs_queue"

  queue_name = "ts-test-lambda-queue"
  dlq_name   = "ts-test-lambda-dlq"
  redrive_policy = {
    maxReceiveCount = 3
  }

  visible_messages_alarm_name = "ts-test-lambda-queue-messages"
  dlq_messages_alarm_name     = "ts-test-lambda-dlq-messages"

  tags = local.workload_tags
}

module "private_workload_network" {
  source = "./modules/private_workload_network"

  vpc_name           = "ts-test-lambda"
  vpc_cidr           = local.workload_vpc_cidr
  intra_subnet_cidrs = local.workload_private_subnet_cidrs

  tags = local.workload_tags
}

# --- Lambda: writer ---

module "workload_writer_lambda" {
  source = "./modules/lambda_service"

  function_name = "test-writer"
  lambda_role   = "test-writer"
  handler       = "main.writer_handler"

  enable_vpc = true

  s3_existing_package = {
    bucket = module.lambda_deployment_artifacts.s3_bucket_id
    key    = aws_s3_object.lambda_deployment_package.key
  }

  vpc_id                         = module.private_workload_network.vpc_id
  vpc_subnet_ids                 = module.private_workload_network.intra_subnets
  security_group_name            = "ts-test-writer-lambda-sg"
  vpc_cidr_for_restricted_egress = local.workload_vpc_cidr

  errors_alarm_name = "test-writer-errors"

  environment_variables = {
    DATA_BUCKET = module.application_data_bucket.s3_bucket_id
    DATA_QUEUE_URL = module.application_job_queue.queue_url
  }

  attach_policy_statements = true
  policy_statements = {
    deployment_pkg_read = {
      effect    = "Allow"
      actions   = ["s3:GetObject"]
      resources = ["${module.lambda_deployment_artifacts.s3_bucket_arn}/${aws_s3_object.lambda_deployment_package.key}"]
    }
    s3_write = {
      effect    = "Allow"
      actions   = ["s3:PutObject"]
      resources = ["${module.application_data_bucket.s3_bucket_arn}/*"]
    }
    sqs_send = {
      effect    = "Allow"
      actions   = ["sqs:SendMessage"]
      resources = [module.application_job_queue.queue_arn]
    }
    kms_s3_data = {
      effect = "Allow"
      actions = [
        "kms:Decrypt",
        "kms:DescribeKey",
        "kms:Encrypt",
        "kms:GenerateDataKey",
        "kms:ReEncrypt*",
      ]
      resources = [module.application_data_bucket.kms_key_arn]
    }
    kms_sqs = {
      effect = "Allow"
      actions = [
        "kms:Decrypt",
        "kms:DescribeKey",
        "kms:GenerateDataKey",
      ]
      resources = [module.application_job_queue.kms_key_arn]
    }
  }
}

# --- Lambda: monitoring (mock/no-op) ---

module "workload_monitoring_lambda" {
  source = "./modules/lambda_service"

  function_name = "test-monitoring"
  lambda_role   = "test-monitoring"
  handler       = "main.monitoring_handler"

  s3_existing_package = {
    bucket = module.lambda_deployment_artifacts.s3_bucket_id
    key    = aws_s3_object.lambda_deployment_package.key
  }

  create_errors_alarm = false

  environment_variables = {
    MOCK_MONITORING = "true"
  }

  attach_policy_statements = true
  policy_statements = {
    deployment_pkg_read = {
      effect    = "Allow"
      actions   = ["s3:GetObject"]
      resources = ["${module.lambda_deployment_artifacts.s3_bucket_arn}/${aws_s3_object.lambda_deployment_package.key}"]
    }
  }
}

# --- Lambda: reader ---

module "workload_reader_lambda" {
  source = "./modules/lambda_service"

  function_name = "test-reader"
  lambda_role   = "test-reader"
  handler       = "main.reader_handler"

  enable_vpc = true

  s3_existing_package = {
    bucket = module.lambda_deployment_artifacts.s3_bucket_id
    key    = aws_s3_object.lambda_deployment_package.key
  }

  vpc_id                         = module.private_workload_network.vpc_id
  vpc_subnet_ids                 = module.private_workload_network.intra_subnets
  security_group_name            = "ts-test-reader-lambda-sg"
  vpc_cidr_for_restricted_egress = local.workload_vpc_cidr

  errors_alarm_name = "test-reader-errors"

  environment_variables = {
    DATA_BUCKET    = module.application_data_bucket.s3_bucket_id
    DATA_QUEUE_URL = module.application_job_queue.queue_url
  }

  attach_policy_statements = true
  policy_statements = {
    deployment_pkg_read = {
      effect    = "Allow"
      actions   = ["s3:GetObject"]
      resources = ["${module.lambda_deployment_artifacts.s3_bucket_arn}/${aws_s3_object.lambda_deployment_package.key}"]
    }
    s3_read = {
      effect    = "Allow"
      actions   = ["s3:GetObject", "s3:ListBucket"]
      resources = [module.application_data_bucket.s3_bucket_arn, "${module.application_data_bucket.s3_bucket_arn}/*"]
    }
    sqs_receive = {
      effect    = "Allow"
      actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
      resources = [module.application_job_queue.queue_arn]
    }
    kms_s3_data = {
      effect    = "Allow"
      actions   = ["kms:Decrypt", "kms:DescribeKey"]
      resources = [module.application_data_bucket.kms_key_arn]
    }
    kms_sqs = {
      effect = "Allow"
      actions = [
        "kms:Decrypt",
        "kms:DescribeKey",
        "kms:GenerateDataKey",
      ]
      resources = [module.application_job_queue.kms_key_arn]
    }
  }
}*/
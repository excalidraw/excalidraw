locals {
  visible_alarm_name = coalesce(var.visible_messages_alarm_name, "${var.queue_name}-visible-messages")
  dlq_alarm_name     = coalesce(var.dlq_messages_alarm_name, "${var.dlq_name}-messages")
}

module "kms" {
  source  = "terraform-aws-modules/kms/aws"
  version = "4.1.0"

  description             = var.kms_description
  deletion_window_in_days = var.kms_deletion_window_in_days
  enable_key_rotation     = true
  enable_default_policy   = true

  tags = var.tags
}

module "queue" {
  source  = "terraform-aws-modules/sqs/aws"
  version = "5.2.1"

  name     = var.queue_name
  dlq_name = var.dlq_name

  kms_master_key_id     = module.kms.key_id
  dlq_kms_master_key_id = module.kms.key_id

  create_dlq     = var.create_dlq
  redrive_policy = var.redrive_policy

  tags = var.tags
}

data "aws_iam_policy_document" "sqs_main_deny_insecure_transport" {
  count = var.attach_deny_insecure_transport_policy ? 1 : 0

  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["sqs:*"]

    resources = [module.queue.queue_arn]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

data "aws_iam_policy_document" "sqs_dlq_deny_insecure_transport" {
  count = var.attach_deny_insecure_transport_policy && var.create_dlq ? 1 : 0

  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["sqs:*"]

    resources = [module.queue.dead_letter_queue_arn]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_sqs_queue_policy" "secure_transport_main" {
  count = var.attach_deny_insecure_transport_policy ? 1 : 0

  queue_url = module.queue.queue_url
  policy    = data.aws_iam_policy_document.sqs_main_deny_insecure_transport[0].json
}

resource "aws_sqs_queue_policy" "secure_transport_dlq" {
  count = var.attach_deny_insecure_transport_policy && var.create_dlq ? 1 : 0

  queue_url = module.queue.dead_letter_queue_id
  policy    = data.aws_iam_policy_document.sqs_dlq_deny_insecure_transport[0].json
}

resource "aws_cloudwatch_metric_alarm" "queue_visible_messages" {
  alarm_name          = local.visible_alarm_name
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = var.visible_messages_period_seconds
  statistic           = "Maximum"
  threshold           = var.visible_messages_threshold
  alarm_description   = "Alarm when main queue has visible messages"
  dimensions = {
    QueueName = module.queue.queue_name
  }
}

resource "aws_cloudwatch_metric_alarm" "dlq_visible_messages" {
  count = var.create_dlq ? 1 : 0

  alarm_name          = local.dlq_alarm_name
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = var.dlq_messages_period_seconds
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Alarm when DLQ has messages"
  dimensions = {
    QueueName = module.queue.dead_letter_queue_name
  }
}

data "aws_iam_policy_document" "publish_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "publish" {
  name               = "${var.name_prefix}-vpc-flow-logs"
  assume_role_policy = data.aws_iam_policy_document.publish_assume.json

  tags = var.tags
}

resource "aws_iam_role_policy" "publish" {
  name = "publish-flow-logs"
  role = aws_iam_role.publish.id

  # VPC Flow Logs publishing requires Create/Put/Describe on the destination log group.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "PublishFlowLogsToCloudWatch"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams",
          "logs:DescribeLogGroups",
        ]
        Resource = "${aws_cloudwatch_log_group.flow.arn}:*"
      },
    ]
  })
}

resource "aws_cloudwatch_log_group" "flow" {
  name              = var.log_group_name
  retention_in_days = var.log_retention_in_days

  tags = var.tags
}

resource "aws_flow_log" "this" {
  iam_role_arn    = aws_iam_role.publish.arn
  log_destination = aws_cloudwatch_log_group.flow.arn
  traffic_type    = var.traffic_type
  vpc_id          = var.vpc_id

  tags = var.tags
}

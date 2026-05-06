/*
data "aws_iam_policy_document" "vpc_flow_logs_publish_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "vpc_flow_logs_publish" {
  name               = "ts-test-lambda-vpc-flow-logs"
  assume_role_policy = data.aws_iam_policy_document.vpc_flow_logs_publish_assume.json

  tags = local.workload_tags
}

resource "aws_iam_role_policy" "vpc_flow_logs_publish" {
  name = "publish-flow-logs"
  role = aws_iam_role.vpc_flow_logs_publish.id

  # VPC Flow Logs publishing — AWS expects Create/Put/Describe on the destination log group.
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
        Resource = "${aws_cloudwatch_log_group.workload_vpc_flow.arn}:*"
      },
    ]
  })
}

resource "aws_cloudwatch_log_group" "workload_vpc_flow" {
  name              = "/aws/vpc/ts-test-lambda-flow"
  retention_in_days = 30

  tags = local.workload_tags
}

resource "aws_flow_log" "workload_vpc_all_traffic" {
  iam_role_arn    = aws_iam_role.vpc_flow_logs_publish.arn
  log_destination = aws_cloudwatch_log_group.workload_vpc_flow.arn
  traffic_type    = "ALL"
  vpc_id          = module.private_workload_network.vpc_id

  tags = local.workload_tags
}
*/
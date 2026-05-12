locals {
  use_https = var.acm_certificate_arn != null && var.acm_certificate_arn != ""
  common_tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-alb"
    },
  )
}

resource "aws_security_group" "alb" {
  name_prefix = "${substr(replace(var.name_prefix, "_", "-"), 0, 20)}-alb-"
  description = "Ingress to the public Application Load Balancer"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = local.use_https ? [80, 443] : [var.listener_port]
    content {
      description = "ALB listener"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = var.internet_ingress_cidr_blocks
    }
  }

  egress {
    description = "To Lambda targets"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-alb-sg" })
}

resource "aws_lb" "this" {
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.deletion_protection
  idle_timeout               = var.idle_timeout

  tags = local.common_tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lb_target_group" "lambda" {
  name_prefix = substr(replace("${var.name_prefix}-tg", "_", "-"), 0, 6)
  target_type = "lambda"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-lambda-tg" })
}

resource "aws_lambda_permission" "alb_invoke" {
  statement_id  = "AllowExecutionFromALB"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "elasticloadbalancing.amazonaws.com"
  source_arn    = aws_lb_target_group.lambda.arn
}

resource "aws_lb_target_group_attachment" "lambda" {
  target_group_arn = aws_lb_target_group.lambda.arn
  target_id        = var.lambda_function_arn

  depends_on = [aws_lambda_permission.alb_invoke]
}

resource "aws_lb_listener" "http_redirect" {
  count = local.use_https ? 1 : 0

  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-http-redirect" })
}

resource "aws_lb_listener" "http_forward" {
  count = local.use_https ? 0 : 1

  load_balancer_arn = aws_lb.this.arn
  port              = var.listener_port
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.lambda.arn
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-http" })
}

resource "aws_lb_listener" "https" {
  count = local.use_https ? 1 : 0

  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.lambda.arn
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-https" })
}

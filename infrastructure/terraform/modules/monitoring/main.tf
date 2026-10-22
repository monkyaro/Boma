# Alerts (SNS email), CloudWatch alarms, container log group, AWS Budget, CloudTrail.

variable "name" { type = string }
variable "account_id" { type = string }
variable "alert_email" { type = string }
variable "monthly_budget_usd" { type = number }
variable "instance_id" { type = string }
variable "db_identifier" { type = string }
variable "log_retention_days" { type = number }

data "aws_region" "current" {}

# --- Notifications
resource "aws_sns_topic" "alerts" {
  name = "${var.name}-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email # recipient must click the confirmation link
}

# --- Container logs (Docker awslogs driver)
resource "aws_cloudwatch_log_group" "containers" {
  name              = "/boma/production/containers"
  retention_in_days = var.log_retention_days
}

# --- Alarms
locals {
  actions = [aws_sns_topic.alerts.arn]
  alarms = {
    ec2-cpu-high = {
      namespace = "AWS/EC2", metric = "CPUUtilization", stat = "Average", op = "GreaterThanThreshold",
      threshold = 80, periods = 3, period = 300, dims = { InstanceId = var.instance_id }
    }
    ec2-memory-high = {
      namespace = "BOMA/Host", metric = "mem_used_percent", stat = "Average", op = "GreaterThanThreshold",
      threshold = 85, periods = 3, period = 300, dims = { InstanceId = var.instance_id }
    }
    ec2-disk-high = {
      namespace = "BOMA/Host", metric = "disk_used_percent", stat = "Maximum", op = "GreaterThanThreshold",
      threshold = 80, periods = 1, period = 300, dims = { InstanceId = var.instance_id }
    }
    rds-cpu-high = {
      namespace = "AWS/RDS", metric = "CPUUtilization", stat = "Average", op = "GreaterThanThreshold",
      threshold = 80, periods = 3, period = 300, dims = { DBInstanceIdentifier = var.db_identifier }
    }
    rds-storage-low = {
      namespace = "AWS/RDS", metric = "FreeStorageSpace", stat = "Minimum", op = "LessThanThreshold",
      threshold = 2147483648, periods = 1, period = 300, dims = { DBInstanceIdentifier = var.db_identifier }
    }
    rds-memory-low = {
      namespace = "AWS/RDS", metric = "FreeableMemory", stat = "Average", op = "LessThanThreshold",
      threshold = 157286400, periods = 3, period = 300, dims = { DBInstanceIdentifier = var.db_identifier }
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "this" {
  for_each            = local.alarms
  alarm_name          = "${var.name}-${each.key}"
  namespace           = each.value.namespace
  metric_name         = each.value.metric
  statistic           = each.value.stat
  comparison_operator = each.value.op
  threshold           = each.value.threshold
  evaluation_periods  = each.value.periods
  period              = each.value.period
  dimensions          = each.value.dims
  treat_missing_data  = "missing"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

# Instance health: auto-recover on hardware failure, notify on any status check failure.
resource "aws_cloudwatch_metric_alarm" "ec2_system_check" {
  alarm_name          = "${var.name}-ec2-system-check-recover"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  statistic           = "Maximum"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 2
  period              = 60
  dimensions          = { InstanceId = var.instance_id }
  alarm_actions       = concat(local.actions, ["arn:aws:automate:${data.aws_region.current.region}:ec2:recover"])
}

resource "aws_cloudwatch_metric_alarm" "ec2_instance_check" {
  alarm_name          = "${var.name}-ec2-instance-check"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_Instance"
  statistic           = "Maximum"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 3
  period              = 60
  dimensions          = { InstanceId = var.instance_id }
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

# --- Budget (alerts only; does not stop spending)
resource "aws_budgets_budget" "monthly" {
  name         = "${var.name}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}

# --- CloudTrail (management events, all regions; first trail is free)
resource "aws_s3_bucket" "trail" {
  bucket = "${var.name}-cloudtrail-${var.account_id}"
}

resource "aws_s3_bucket_ownership_controls" "trail" {
  bucket = aws_s3_bucket.trail.id
  rule { object_ownership = "BucketOwnerEnforced" }
}

resource "aws_s3_bucket_public_access_block" "trail" {
  bucket                  = aws_s3_bucket.trail.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "trail" {
  bucket = aws_s3_bucket.trail.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "trail" {
  bucket = aws_s3_bucket.trail.id
  rule {
    id     = "expire"
    status = "Enabled"
    filter {}
    transition {
      days          = 90
      storage_class = "GLACIER_IR"
    }
    expiration { days = 730 }
  }
}

resource "aws_s3_bucket_policy" "trail" {
  bucket = aws_s3_bucket.trail.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AWSCloudTrailAclCheck"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:GetBucketAcl"
        Resource  = aws_s3_bucket.trail.arn
        Condition = { StringEquals = { "aws:SourceArn" = "arn:aws:cloudtrail:${data.aws_region.current.region}:${var.account_id}:trail/${var.name}" } }
      },
      {
        Sid       = "AWSCloudTrailWrite"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.trail.arn}/AWSLogs/${var.account_id}/*"
        Condition = { StringEquals = {
          "s3:x-amz-acl"  = "bucket-owner-full-control"
          "aws:SourceArn" = "arn:aws:cloudtrail:${data.aws_region.current.region}:${var.account_id}:trail/${var.name}"
        } }
      },
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.trail.arn, "${aws_s3_bucket.trail.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      },
    ]
  })
  depends_on = [aws_s3_bucket_public_access_block.trail]
}

resource "aws_cloudtrail" "this" {
  name                          = var.name
  s3_bucket_name                = aws_s3_bucket.trail.id
  is_multi_region_trail         = true
  include_global_service_events = true
  enable_log_file_validation    = true
  depends_on                    = [aws_s3_bucket_policy.trail]
}

output "log_group_name" { value = aws_cloudwatch_log_group.containers.name }
output "log_group_arn" { value = aws_cloudwatch_log_group.containers.arn }
output "alerts_topic_arn" { value = aws_sns_topic.alerts.arn }

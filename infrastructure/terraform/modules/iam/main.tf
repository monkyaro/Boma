# Instance role for the app host: SSM access, CloudWatch agent, ECR pull,
# scoped S3 access to BOMA buckets, its own SSM parameters, and SES sending.

variable "name" { type = string }
variable "bucket_arns" { type = list(string) }
variable "ssm_parameter_prefix" { type = string } # e.g. /boma/production
variable "log_group_arn" { type = string }

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_iam_role" "app" {
  name = "${var.name}-app-host"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cw_agent" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_role_policy_attachment" "ecr_read" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy" "app" {
  name = "boma-app"
  role = aws_iam_role.app.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "BucketList"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = var.bucket_arns
      },
      {
        Sid      = "ObjectAccess"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = [for b in var.bucket_arns : "${b}/*"]
      },
      {
        Sid    = "ReadOwnParameters"
        Effect = "Allow"
        Action = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_parameter_prefix}",
          "arn:aws:ssm:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_parameter_prefix}/*",
        ]
      },
      {
        Sid      = "SendEmail"
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
        Condition = {
          StringLike = { "ses:FromAddress" = "*@bomahoop.com" }
        }
      },
      {
        Sid      = "ContainerLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
        Resource = ["${var.log_group_arn}", "${var.log_group_arn}:*"]
      },
    ]
  })
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.name}-app-host"
  role = aws_iam_role.app.name
}

output "instance_profile_name" { value = aws_iam_instance_profile.app.name }
output "role_arn" { value = aws_iam_role.app.arn }

# Runtime secret values remain outside Terraform state. Import existing approved resources first.
variable "runtime_secret_arns" {
  type    = list(string)
  default = []
}

resource "aws_iam_role_policy" "runtime_secrets" {
  count = length(var.runtime_secret_arns) > 0 ? 1 : 0
  name  = "boma-managed-runtime-secrets"
  role  = aws_iam_role.app.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "BomaRuntimeSecrets"
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = var.runtime_secret_arns
    }]
  })
}

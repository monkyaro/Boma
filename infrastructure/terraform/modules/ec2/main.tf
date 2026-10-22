# Single Docker host for the BOMA containers (Ubuntu 24.04 LTS, Graviton).

variable "name" { type = string }
variable "instance_type" { type = string }
variable "subnet_id" { type = string }
variable "security_group_ids" { type = list(string) }
variable "instance_profile_name" { type = string }
variable "root_volume_gb" { type = number }
variable "hostname" { type = string }
variable "log_group_name" { type = string }

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
  }
  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

resource "aws_instance" "app" {
  ami                     = data.aws_ami.ubuntu.id
  instance_type           = var.instance_type
  subnet_id               = var.subnet_id
  vpc_security_group_ids  = var.security_group_ids
  iam_instance_profile    = var.instance_profile_name
  disable_api_termination = true
  monitoring              = false # basic 5-min metrics; memory/disk come from the CloudWatch agent

  metadata_options {
    http_tokens                 = "required" # IMDSv2 only
    http_put_response_hop_limit = 2          # lets containers use the instance role
    http_endpoint               = "enabled"
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_gb
    encrypted             = true
    delete_on_termination = true
    tags                  = { Name = "${var.name}-root" }
  }

  user_data = templatefile("${path.module}/../../../scripts/bootstrap.sh", {
    hostname       = var.hostname
    log_group_name = var.log_group_name
  })
  user_data_replace_on_change = false

  tags = { Name = "${var.name}-app" }

  lifecycle {
    # New AMIs or bootstrap edits must not silently replace the running host.
    ignore_changes = [ami, user_data]
  }
}

resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id
  tags     = { Name = "${var.name}-app" }
}

output "instance_id" { value = aws_instance.app.id }
output "public_ip" { value = aws_eip.app.public_ip }
output "ami_id" { value = aws_instance.app.ami }

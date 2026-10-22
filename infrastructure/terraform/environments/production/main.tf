terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  backend "s3" {
    bucket       = "boma-tfstate-282400617488-euw1"
    key          = "production/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true
    profile      = "boma-hoop"
  }
}

provider "aws" {
  region              = "eu-west-1"
  profile             = "boma-hoop"
  allowed_account_ids = ["282400617488"]
  default_tags {
    tags = {
      Project     = "boma"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  name       = "boma-prod"
  domain     = "bomahoop.com"
  account_id = data.aws_caller_identity.current.account_id
  subdomains = ["www", "api", "auth", "admin"]
}

module "network" {
  source = "../../modules/network"
  name   = local.name
  cidr   = "10.20.0.0/16"
  azs    = ["eu-west-1a", "eu-west-1b"]
}

module "security" {
  source = "../../modules/security"
  name   = local.name
  vpc_id = module.network.vpc_id
}

module "s3" {
  source       = "../../modules/s3"
  prefix       = local.name
  account_id   = local.account_id
  cors_origins = concat(["https://${local.domain}"], [for s in ["www", "admin"] : "https://${s}.${local.domain}"])
}

module "ecr" {
  source       = "../../modules/ecr"
  repositories = ["boma/api", "boma/web"]
}

module "monitoring" {
  source             = "../../modules/monitoring"
  name               = local.name
  account_id         = local.account_id
  alert_email        = "admin.hoop@gmail.com"
  monthly_budget_usd = 120
  instance_id        = module.ec2.instance_id
  db_identifier      = module.rds.identifier
  log_retention_days = 30
}

module "iam" {
  source               = "../../modules/iam"
  name                 = local.name
  bucket_arns          = module.s3.bucket_arns
  ssm_parameter_prefix = "/boma/production"
  log_group_arn        = module.monitoring.log_group_arn
}

module "ec2" {
  source                = "../../modules/ec2"
  name                  = local.name
  instance_type         = "t4g.large"
  subnet_id             = module.network.public_subnet_ids[0]
  security_group_ids    = [module.security.app_sg_id]
  instance_profile_name = module.iam.instance_profile_name
  root_volume_gb        = 30
  hostname              = "boma-prod-app-01"
  log_group_name        = module.monitoring.log_group_name
}

module "rds" {
  source                   = "../../modules/rds"
  name                     = "${local.name}-db"
  subnet_ids               = module.network.private_subnet_ids
  security_group_ids       = [module.security.db_sg_id]
  engine_version           = "17.11"
  instance_class           = "db.t4g.small"
  allocated_storage_gb     = 20
  max_allocated_storage_gb = 100
  backup_retention_days    = 7
}

module "dns" {
  source     = "../../modules/dns"
  zone_id    = "Z0468528I0KL8ZKCOQT2"
  domain     = local.domain
  app_ip     = module.ec2.public_ip
  subdomains = local.subdomains
  dmarc_rua  = "admin.hoop@gmail.com"
}

output "app_instance_id" { value = module.ec2.instance_id }
output "app_public_ip" { value = module.ec2.public_ip }
output "db_endpoint" { value = module.rds.endpoint }
output "db_master_secret_arn" { value = module.rds.master_secret_arn }
output "buckets" { value = module.s3.bucket_names }
output "ecr_repositories" { value = module.ecr.repository_urls }
output "hostnames" { value = module.dns.hostnames }

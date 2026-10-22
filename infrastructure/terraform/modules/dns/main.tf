# Records in the existing bomahoop.com hosted zone (the zone itself is not managed here).
# Also sets up SES domain identity with DKIM, SPF and DMARC.

variable "zone_id" { type = string }
variable "domain" { type = string }
variable "app_ip" { type = string }
variable "subdomains" { type = list(string) } # e.g. ["www", "api", "auth", "admin"]
variable "dmarc_rua" { type = string }

resource "aws_route53_record" "apex" {
  zone_id = var.zone_id
  name    = var.domain
  type    = "A"
  ttl     = 300
  records = [var.app_ip]
}

resource "aws_route53_record" "sub" {
  for_each = toset(var.subdomains)
  zone_id  = var.zone_id
  name     = "${each.value}.${var.domain}"
  type     = "A"
  ttl      = 300
  records  = [var.app_ip]
}

# Only Let's Encrypt and Amazon may issue certificates for the domain.
resource "aws_route53_record" "caa" {
  zone_id = var.zone_id
  name    = var.domain
  type    = "CAA"
  ttl     = 3600
  records = ["0 issue \"letsencrypt.org\"", "0 issue \"amazon.com\""]
}

# --- SES sending domain
resource "aws_sesv2_email_identity" "domain" {
  email_identity = var.domain
}

resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = var.zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain}"
  type    = "CNAME"
  ttl     = 3600
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_route53_record" "spf" {
  zone_id = var.zone_id
  name    = var.domain
  type    = "TXT"
  ttl     = 3600
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "dmarc" {
  zone_id = var.zone_id
  name    = "_dmarc.${var.domain}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=DMARC1; p=quarantine; rua=mailto:${var.dmarc_rua}"]
}

output "ses_identity_arn" { value = aws_sesv2_email_identity.domain.arn }
output "hostnames" { value = concat([var.domain], [for s in var.subdomains : "${s}.${var.domain}"]) }

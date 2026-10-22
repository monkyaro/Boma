# Monthly cost estimate (production, eu-west-1)

These are on-demand list prices from the AWS Price List API, queried 2026-10-22. A month is taken as 730 hours. All prices are in USD and exclude tax.

| Item | Size / usage | Unit price | Monthly |
|---|---|---|---|
| EC2 app host | t4g.large, 730 h | $0.0736/h | **$53.73** |
| EBS root | 30 GB gp3 | $0.088/GB-mo | $2.64 |
| Public IPv4 (Elastic IP) | 1 address, 730 h | $0.005/h | $3.65 |
| RDS PostgreSQL | db.t4g.small single-AZ, 730 h | $0.035/h | **$25.55** |
| RDS storage | 20 GB gp3 | $0.127/GB-mo | $2.54 |
| RDS backups | Automated, up to 20 GB, free (equal to allocated storage). Manual snapshots ~10 GB extra | $0.095/GB-mo | ~$1.00 |
| Performance Insights | 7-day retention | free tier | $0.00 |
| Secrets Manager | 1 secret (RDS master) | $0.40/secret | $0.40 |
| SSM Parameter Store | Standard parameters | free | $0.00 |
| Route 53 | 1 hosted zone + queries | $0.50 + $0.40/M | ~$0.90 |
| CloudWatch | ~2 GB logs ingested, 2 custom metrics, 8 alarms | $0.57/GB, $0.30/metric, $0.10/alarm | ~$2.50 |
| CloudTrail | First management trail free; S3 storage | — | ~$0.10 |
| S3 | ~10 GB plus requests (grows with media) | $0.023/GB-mo | ~$0.75 |
| ECR | ~2 GB of images (30 kept per repository) | $0.10/GB-mo | ~$0.20 |
| SES | ~5,000 emails | $0.10 per 1,000 | ~$0.50 |
| Data transfer out | Up to 100 GB/month across services | free | $0.00 |
| **Total** | | | **≈ $95/month** |

The approved budget is **$120/month**. Alerts fire at 80% actual and 100% forecast.

## Assumptions

- Traffic is low at launch: under 100 GB/month out and under 50 GB of media.
- Single-AZ RDS. Multi-AZ doubles the RDS instance and storage cost (+$28).
- No NAT Gateway (+$35 plus $0.048/GB) and no ALB (+$18 plus LCU). See `architecture.md`.
- A monthly restore drill (`restore.sh test`) runs about 1 hour on db.t4g.small, roughly $0.05.
- Keycloak, Redis and Celery share the EC2 host, so they add no separate charge.

## Savings options (not applied)

| Option | Saving |
|---|---|
| 1-year Compute Savings Plan or RI on EC2 (no upfront) | ~30%, about $16/month |
| 1-year RDS reserved instance (no upfront) | ~30%, about $8/month |
| Downsize EC2 to t4g.medium (4 GiB) | $27/month, but too tight for Keycloak plus the app |

## Growth triggers

| When | Change | Added cost |
|---|---|---|
| Sustained CPU above 60% or memory above 80% | t4g.xlarge | +$54 |
| Database CPU or connections saturate | db.t4g.medium | +$26 |
| Search needs beyond PostGIS/full-text | OpenSearch t3.small.search | ~+$30 |
| Uptime commitment | RDS Multi-AZ and a second host behind an ALB | ~+$100 |

Pricing sources: the AWS Price List API (`pricing get-products`), and aws.amazon.com/ec2/pricing, /rds/postgresql/pricing, /cloudwatch/pricing and /s3/pricing.

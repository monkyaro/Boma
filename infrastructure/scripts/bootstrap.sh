#!/bin/bash
# BOMA app host bootstrap (EC2 user data, rendered by Terraform templatefile).
# Template vars: hostname, log_group_name. Bash vars below avoid $${} braces.
set -euxo pipefail
exec > >(tee /var/log/boma-bootstrap.log) 2>&1
export DEBIAN_FRONTEND=noninteractive

# --- Hostname and timezone (UTC; app handles Africa/Dar_es_Salaam display)
hostnamectl set-hostname "${hostname}"
timedatectl set-timezone UTC

# --- Base packages
apt-get update
apt-get -y upgrade
apt-get install -y ca-certificates curl gnupg git unzip jq chrony ufw \
  unattended-upgrades python3-pip python3-venv postgresql-client logrotate

# --- Time sync via the Amazon Time Sync Service
sed -i '1i server 169.254.169.123 prefer iburst minpoll 4 maxpoll 4' /etc/chrony/chrony.conf
systemctl enable --now chrony
systemctl restart chrony

# --- Automatic security updates (no automatic reboot; reboots are scheduled by ops)
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# --- No SSH: administration is via SSM Session Manager
systemctl disable --now ssh.socket ssh.service || true

# --- Host firewall (defence in depth behind the security group)
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# --- Docker Engine + Compose plugin (official repo)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Container logs go to CloudWatch by default; local logs are size-capped.
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "awslogs",
  "log-opts": {
    "awslogs-group": "${log_group_name}",
    "awslogs-create-group": "false",
    "mode": "non-blocking",
    "max-buffer-size": "4m"
  },
  "live-restore": true,
  "no-new-privileges": true
}
EOF
systemctl enable docker
systemctl restart docker
usermod -aG docker ubuntu

# --- AWS CLI v2 (arm64)
cd /tmp
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o awscliv2.zip
unzip -q awscliv2.zip && ./aws/install --update && rm -rf aws awscliv2.zip

# --- CloudWatch agent: memory and disk metrics
curl -fsSL https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/arm64/latest/amazon-cloudwatch-agent.deb -o cwagent.deb
dpkg -i cwagent.deb && rm cwagent.deb
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<'EOF'
{
  "agent": { "metrics_collection_interval": 60 },
  "metrics": {
    "namespace": "BOMA/Host",
    "append_dimensions": { "InstanceId": "$${aws:InstanceId}" },
    "aggregation_dimensions": [["InstanceId"]],
    "metrics_collected": {
      "mem":  { "measurement": ["mem_used_percent"] },
      "disk": { "measurement": ["used_percent"], "resources": ["/"], "drop_device": true }
    }
  }
}
EOF
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

# --- App directory
install -d -o ubuntu -g ubuntu /opt/boma

echo "BOMA bootstrap complete"

#!/bin/bash
# Enable key-only SSH (user boma) on the running BOMA host via SSM (same settings as bootstrap.sh).
# Usage: infrastructure/scripts/enable-ssh.sh <public-key-file> <allowed-ip>
set -euo pipefail

PUB_FILE=${1:?public key file, e.g. ~/.ssh/boma.pub}
ALLOWED_IP=${2:?allowed source IP, e.g. 54.72.97.232}
INSTANCE_ID=i-0b904532baab17f5f
AWS="aws --profile boma-hoop --region eu-west-1"
PUB=$(cat "$PUB_FILE")

read -r -d '' REMOTE <<SCRIPT || true
set -e
id boma >/dev/null 2>&1 || useradd --create-home --shell /bin/bash --groups sudo boma
echo "boma ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-boma
chmod 440 /etc/sudoers.d/90-boma
visudo -cf /etc/sudoers.d/90-boma
getent group docker >/dev/null && usermod -aG docker boma
install -d -m 700 -o boma -g boma /home/boma/.ssh
touch /home/boma/.ssh/authorized_keys
grep -qxF '$PUB' /home/boma/.ssh/authorized_keys || echo '$PUB' >> /home/boma/.ssh/authorized_keys
chown boma:boma /home/boma/.ssh/authorized_keys
chmod 600 /home/boma/.ssh/authorized_keys
printf '%s\n' 'PubkeyAuthentication yes' 'PasswordAuthentication no' 'KbdInteractiveAuthentication no' 'PermitRootLogin no' 'AllowUsers boma' 'MaxAuthTries 3' 'LoginGraceTime 30' 'X11Forwarding no' > /etc/ssh/sshd_config.d/10-boma.conf
install -d -m 755 /run/sshd  # missing until sshd has run once
sshd -t
ufw allow from $ALLOWED_IP to any port 22 proto tcp comment 'SSH admin'
systemctl enable --now ssh.service
systemctl is-active ssh.service
ufw status | grep '22/tcp'
SCRIPT

PARAMS=$(jq -n --arg s "$REMOTE" '{commands: ($s | split("\n"))}')
CID=$($AWS ssm send-command --instance-ids "$INSTANCE_ID" --document-name AWS-RunShellScript \
  --comment "Enable key-only SSH" --parameters "$PARAMS" --query Command.CommandId --output text)
$AWS ssm wait command-executed --command-id "$CID" --instance-id "$INSTANCE_ID" || true
$AWS ssm get-command-invocation --command-id "$CID" --instance-id "$INSTANCE_ID" \
  --query "[Status,StandardOutputContent,StandardErrorContent]" --output text

#!/usr/bin/env bash
set -euo pipefail

app_root=/opt/easy-mdm
config_root=/etc/easy-mdm
certificate_path="$config_root/DigiCertGlobalRootG2.crt.pem"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y caddy ca-certificates curl python3-venv

id -u easy-mdm >/dev/null 2>&1 || useradd --system --home-dir "$app_root" --shell /usr/sbin/nologin easy-mdm
install -d -m 0750 -o root -g easy-mdm "$config_root"
test -f "$app_root/backend/requirements.txt"
test -f "$config_root/easy-mdm.env"
test -f "$config_root/caddy.env"
chown root:easy-mdm "$config_root/easy-mdm.env"
chmod 0640 "$config_root/easy-mdm.env"
chmod 0640 "$config_root/caddy.env"
if test -f "$config_root/gcp-service-account.json"; then
  chown root:easy-mdm "$config_root/gcp-service-account.json"
  chmod 0640 "$config_root/gcp-service-account.json"
fi
curl --fail --silent --show-error --location \
  https://cacerts.digicert.com/DigiCertGlobalRootG2.crt.pem \
  --output "$certificate_path"
chmod 0644 "$certificate_path"

python3 -m venv "$app_root/.venv"
"$app_root/.venv/bin/pip" install --upgrade pip
"$app_root/.venv/bin/pip" install --requirement "$app_root/backend/requirements.txt"

chown -R easy-mdm:easy-mdm "$app_root"
chmod -R a+rX "$app_root"
install -m 0644 "$app_root/deploy/systemd/easy-mdm.service" /etc/systemd/system/easy-mdm.service
install -d -m 0755 /etc/systemd/system/caddy.service.d
install -m 0644 "$app_root/deploy/systemd/caddy-easy-mdm.conf" /etc/systemd/system/caddy.service.d/easy-mdm.conf
install -m 0644 "$app_root/deploy/Caddyfile" /etc/caddy/Caddyfile

systemctl daemon-reload
systemctl enable --now easy-mdm caddy
systemctl restart easy-mdm caddy

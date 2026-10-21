#!/bin/bash
# =============================================================
# Setup inicial do LifeCounter na VPS (rodar como root, UMA vez).
# Depois disso, cada atualização é só `deploy.ps1` no PC.
#
# Pré-requisitos: DNS A lifecounter.mreis.site -> 134.209.45.112 (já feito),
# backend/ e site/ já enviados pra /root/lifecounter (o deploy.ps1 faz isso).
# =============================================================
set -e

APP_DIR="/root/lifecounter"
VENV="$APP_DIR/venv"
PY="/usr/bin/python3.12"

echo "[1/7] venv (python 3.12)"
if [ ! -x "$VENV/bin/python" ]; then
    $PY -m venv "$VENV"
fi
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q -r "$APP_DIR/backend/requirements.txt"

echo "[2/7] .env"
cd "$APP_DIR/backend"
if [ ! -f .env ]; then
    SECRET=$("$VENV/bin/python" -c "import secrets; print(secrets.token_urlsafe(50))")
    cat > .env <<ENVEOF
DJANGO_SECRET_KEY=$SECRET
DJANGO_DEBUG=False
LC_API_KEY=lc-mesa-2026
ENVEOF
fi
mkdir -p media/apk media/profiles

echo "[3/7] migrate + seed + static"
"$VENV/bin/python" manage.py migrate --noinput
"$VENV/bin/python" manage.py seed_profiles
"$VENV/bin/python" manage.py collectstatic --noinput -v 0

echo "[4/7] admin (user: reis / senha: lifecounter123 — troque em /admin/)"
"$VENV/bin/python" manage.py shell -c "
from django.contrib.auth import get_user_model
U = get_user_model()
if not U.objects.filter(username='reis').exists():
    U.objects.create_superuser('reis', 'candidobugarin@gmail.com', 'lifecounter123'); print('admin criado')
else:
    print('admin ja existe')
"

echo "[5/7] systemd"
cp "$APP_DIR/deploy/lifecounter.service" /etc/systemd/system/lifecounter.service
systemctl daemon-reload
systemctl enable lifecounter >/dev/null 2>&1
systemctl restart lifecounter

echo "[6/7] nginx"
if [ ! -f /etc/nginx/conf.d/lifecounter.conf ]; then
    cp "$APP_DIR/deploy/lifecounter.nginx.conf" /etc/nginx/conf.d/lifecounter.conf
fi
nginx -t
systemctl reload nginx

echo "[7/7] SSL (certbot)"
if [ ! -d /etc/letsencrypt/live/lifecounter.mreis.site ]; then
    certbot --nginx -d lifecounter.mreis.site --non-interactive --agree-tos --redirect -m candidobugarin@gmail.com || echo "certbot falhou — rode na mão: certbot --nginx -d lifecounter.mreis.site"
    systemctl reload nginx
fi

echo
echo "OK: https://lifecounter.mreis.site  (API: /api/health/, admin: /admin/)"

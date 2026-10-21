#!/bin/bash
# Backup diário do banco (SQLite) + limpeza de APKs antigos.
# Instalado no cron pelo setup_server.sh / deploy.ps1:  0 4 * * * bash /root/lifecounter/deploy/backup.sh
set -e
APP=/root/lifecounter
DB=$APP/backend/db.sqlite3
OUT=$APP/backups
mkdir -p "$OUT"

# Cópia consistente via sqlite3 (.backup) se houver, senão cp.
STAMP=$(date +%Y%m%d-%H%M)
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB" ".backup '$OUT/db-$STAMP.sqlite3'"
else
    cp "$DB" "$OUT/db-$STAMP.sqlite3"
fi
gzip -f "$OUT/db-$STAMP.sqlite3"

# Mantém 30 backups diários.
ls -1t "$OUT"/db-*.sqlite3.gz 2>/dev/null | tail -n +31 | xargs -r rm -f

# APKs: mantém só os 3 mais recentes (a versão registrada é sempre a mais nova).
ls -1t "$APP"/backend/media/apk/*.apk 2>/dev/null | tail -n +4 | xargs -r rm -f

echo "backup ok: $OUT/db-$STAMP.sqlite3.gz"

#!/usr/bin/env bash
# Перенос данных инфоцентра из Redis, которым пользовался Vercel, в Redis
# своего сервера, плюс скачивание вложений витрины из Vercel Blob на диск.
#
#   OLD_REDIS_URL='redis://default:пароль@хост:порт' bash /opt/infocenter-rck/deploy/migrate.sh
#   (повторный перенос поверх уже работающего сервера — добавьте FORCE=1)
set -euo pipefail
: "${OLD_REDIS_URL:?укажите OLD_REDIS_URL — строку REDIS_URL из настроек проекта на Vercel}"
set -a
. /etc/infocenter-rck.env
set +a
cd /opt/infocenter-rck
node deploy/migrate-from-vercel.js ${FORCE:+--force}
chown -R infocenter:infocenter /var/lib/infocenter-rck
systemctl restart infocenter-rck
echo "Готово: служба перезапущена."

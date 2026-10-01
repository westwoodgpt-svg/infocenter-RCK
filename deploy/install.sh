#!/usr/bin/env bash
# Установка (и обновление) инфоцентра РЦК на свой сервер Ubuntu/Debian.
# Запускать от root. Скрипт можно запускать повторно — он же обновляет код.
#
#   curl -fsSL https://raw.githubusercontent.com/westwoodgpt-svg/infocenter-RCK/main/deploy/install.sh \
#     | DOMAIN=infocenter.2.27.10.126.nip.io bash
#
# Только обновить код уже установленного приложения — deploy/update.sh: он не
# трогает nginx, сертификат, Redis и systemd.
#
# Параметры (переменные окружения):
#   DOMAIN  — домен сервера (для nginx и сертификата)
#   BRANCH  — ветка репозитория (по умолчанию main)
#   EMAIL   — почта для Let's Encrypt (необязательно)
set -euo pipefail

DOMAIN="${DOMAIN:?укажите DOMAIN — имя, на которое выпущен сертификат (например infocenter.2.27.10.126.nip.io)}"
BRANCH="${BRANCH:-main}"
EMAIL="${EMAIL:-}"
REPO="https://github.com/westwoodgpt-svg/infocenter-RCK.git"
APP_DIR=/opt/infocenter-rck
DATA_DIR=/var/lib/infocenter-rck
ENV_FILE=/etc/infocenter-rck.env
APP_USER=infocenter

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите от root" >&2
  exit 1
fi

log "Пакеты: git, nginx, redis, certbot"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q curl git ca-certificates gnupg nginx redis-server certbot python3-certbot-nginx

if ! command -v node >/dev/null || ! node -v | grep -qE '^v(2[2-9]|[3-9][0-9])\.'; then
  log "Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

# Сборка фронтенда (vite) на маленькой машине может не уместиться в память.
if [ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 2000000 ] && [ "$(swapon --show | wc -l)" -eq 0 ]; then
  log "Мало памяти — создаю swap 2 ГБ"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Redis: только localhost, с сохранением на диск"
REDIS_CONF=/etc/redis/redis.conf
sed -i -E 's/^#?\s*bind .*/bind 127.0.0.1/' "$REDIS_CONF"
sed -i -E 's/^#?\s*appendonly .*/appendonly yes/' "$REDIS_CONF"
systemctl enable redis-server
systemctl restart redis-server

log "Пользователь и каталоги"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$DATA_DIR/uploads"
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"

log "Код из GitHub (ветка $BRANCH)"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" checkout --quiet -B "$BRANCH" "origin/$BRANCH"
  git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
else
  git clone --quiet --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
git config --global --add safe.directory "$APP_DIR" || true

log "Зависимости и сборка"
cd "$APP_DIR"
npm ci --no-audit --no-fund
npm run build
chown -R root:root "$APP_DIR"

log "Переменные окружения ($ENV_FILE)"
if [ ! -f "$ENV_FILE" ]; then
  cp "$APP_DIR/deploy/infocenter-rck.env.example" "$ENV_FILE"
  echo "Создан $ENV_FILE — впишите в него BITRIX_CLIENT_ID и BITRIX_CLIENT_SECRET."
fi
chown root:"$APP_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"

log "Служба systemd"
cp "$APP_DIR/deploy/infocenter-rck.service" /etc/systemd/system/infocenter-rck.service
systemctl daemon-reload
systemctl enable infocenter-rck
systemctl restart infocenter-rck

log "nginx для $DOMAIN"
APP_PORT="$(grep -E '^PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2)"
APP_PORT="${APP_PORT:-3000}"
# Уже есть конфиг nginx с этим именем (наш или настроенный вручную, с блоком
# HTTPS от certbot) — не трогаем его, иначе потеряем сертификат и порт.
EXISTING_NGINX="$(grep -rlsE "server_name[^;]*[[:space:]]${DOMAIN//./\\.}[[:space:];]" /etc/nginx/sites-enabled /etc/nginx/conf.d || true)"
if [ -n "$EXISTING_NGINX" ]; then
  echo "Конфиг nginx для $DOMAIN уже есть ($EXISTING_NGINX) — оставляю как есть."
else
  sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__PORT__/$APP_PORT/g" "$APP_DIR/deploy/nginx.conf.template" > /etc/nginx/sites-available/infocenter-rck
  ln -sf /etc/nginx/sites-available/infocenter-rck /etc/nginx/sites-enabled/infocenter-rck
  rm -f /etc/nginx/sites-enabled/default
fi
nginx -t
systemctl reload nginx

if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  log "Файрвол: открываю 80/443"
  ufw allow 'Nginx Full'
  ufw allow OpenSSH
fi

if [ -z "$EXISTING_NGINX" ] && [ ! -f /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem ]; then
  log "Сертификат Let's Encrypt для $DOMAIN"
  if [ -n "$EMAIL" ]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect -m "$EMAIL"
  else
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect --register-unsafely-without-email
  fi
fi

log "Проверка"
sleep 2
systemctl --no-pager --lines=5 status infocenter-rck || true
curl -fsS -o /dev/null -w 'Приложение отвечает: HTTP %{http_code}\n' "https://$DOMAIN/" || \
  echo "HTTPS пока не отвечает — см. journalctl -u infocenter-rck -n 50 и nginx -t"

cat <<MSG

Готово. Дальше:
  1) Впишите BITRIX_CLIENT_ID / BITRIX_CLIENT_SECRET в $ENV_FILE
     и выполните: systemctl restart infocenter-rck
  2) Перенесите данные с Vercel:
     OLD_REDIS_URL='redis://…' bash $APP_DIR/deploy/migrate.sh
  3) Проверьте https://$DOMAIN/api/bitrix-status
  4) В Битрикс24 смените путь обработчика приложения на https://$DOMAIN/
MSG

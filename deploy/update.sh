#!/usr/bin/env bash
# Только обновить код и перезапустить службу. nginx, сертификат, Redis,
# systemd-юнит и /etc/infocenter-rck.env не трогаются.
#
#   BRANCH=<ветка> bash /opt/infocenter-rck/deploy/update.sh
#   (без BRANCH — текущая ветка рабочей копии; FORCE=1 — даже если на сервере
#    есть локальные правки файлов в /opt/infocenter-rck, они будут потеряны)
set -euo pipefail
APP_DIR=/opt/infocenter-rck
ENV_FILE=/etc/infocenter-rck.env
cd "$APP_DIR"
git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true
BRANCH="${BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"

if [ -n "$(git status --porcelain --untracked-files=no)" ] && [ -z "${FORCE:-}" ]; then
  echo "В $APP_DIR есть локальные изменения файлов:" >&2
  git status --short --untracked-files=no >&2
  echo "Они будут потеряны при обновлении. Сохраните их или запустите с FORCE=1." >&2
  exit 1
fi

echo "==> было: $(git log --oneline -1)"
git fetch --quiet origin "$BRANCH"
git checkout --quiet -B "$BRANCH" "origin/$BRANCH"
git reset --quiet --hard "origin/$BRANCH"
echo "==> стало: $(git log --oneline -1)"

npm ci --no-audit --no-fund
npm run build
chown -R root:root "$APP_DIR"
systemctl restart infocenter-rck
sleep 2
systemctl --no-pager --lines=3 status infocenter-rck || true

PORT="$(grep -E '^PORT=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2)"
curl -fsS -o /dev/null -w "Приложение отвечает на порту ${PORT:-3000}: HTTP %{http_code}\n" "http://127.0.0.1:${PORT:-3000}/" \
  || echo "Не отвечает — journalctl -u infocenter-rck -n 50"

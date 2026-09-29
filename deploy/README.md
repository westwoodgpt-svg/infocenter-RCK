# Инфоцентр на своём сервере (без Vercel)

Вместо serverless-функций Vercel работает один Node.js-процесс
(`server/index.js`) за nginx с сертификатом Let's Encrypt. Данные хранятся в Redis
на этом же сервере, вложения витрины — на его диске
(`/var/lib/infocenter-rck/uploads`). Код тот же, что на Vercel: обработчики
`api/*.js` подключены к Express без изменений.

| Что | Где на сервере |
|---|---|
| Код | `/opt/infocenter-rck` |
| Настройки (секреты) | `/etc/infocenter-rck.env` |
| Вложения витрины | `/var/lib/infocenter-rck/uploads` |
| Служба | `systemctl status infocenter-rck`, логи — `journalctl -u infocenter-rck -f` |
| nginx | `/etc/nginx/sites-available/infocenter-rck` |
| Redis | `redis-server`, только localhost, с записью на диск (appendonly) |

Нужны Ubuntu 22.04/24.04 или Debian 12, доступ root, открытые порты 80 и 443
и домен, который указывает на сервер (у хостинга он уже есть, например
`vm1101304.hosted-by.u1host.com`).

## Переезд с Vercel по шагам

1. **Установка.** Зайдите на сервер по SSH под root и выполните:

   ```bash
   BRANCH=main
   curl -fsSL "https://raw.githubusercontent.com/westwoodgpt-svg/infocenter-RCK/$BRANCH/deploy/install.sh" -o install.sh
   DOMAIN=vm1101304.hosted-by.u1host.com BRANCH=$BRANCH bash install.sh
   ```

   Скрипт поставит Node.js 22, Redis, nginx и certbot, соберёт приложение,
   запустит службу и получит HTTPS-сертификат. `BRANCH` — ветка, из которой
   брать код: если изменения ещё не влиты в `main`, укажите их ветку.

2. **Секреты.** Откройте `/etc/infocenter-rck.env` (`nano /etc/infocenter-rck.env`)
   и перенесите значения из Vercel → проект → **Settings → Environment
   Variables**: `BITRIX_CLIENT_ID`, `BITRIX_CLIENT_SECRET` и, если были заданы,
   переменные `INFOCENTER_*`. `REDIS_URL` не меняйте — он уже указывает на
   локальный Redis. Затем выполните `systemctl restart infocenter-rck`.

3. **Данные.** Скопируйте из Vercel строку `REDIS_URL` (Settings → Environment
   Variables) и выполните:

   ```bash
   OLD_REDIS_URL='redis://default:…@…:…' bash /opt/infocenter-rck/deploy/migrate.sh
   ```

   Переносятся все ключи `rck:*`: инфоцентры отделов, витрина, история версий,
   личные настройки сводного экрана, сервисный токен. Ключи ИИЦ (`iic:*`),
   если база общая, не трогаются. Вложения витрины из Vercel Blob
   скачиваются на диск, ссылки на них переписываются.

4. **Проверка.** Откройте `https://<домен>/api/bitrix-status` — там должно быть
   `"ok": true`, `hasBitrixCreds: true`, а в `dashboard` — число карточек.

5. **Повторный перенос прямо перед переключением.** Пока портал смотрит на
   Vercel, сотрудники могут что-то править там. Чтобы ничего не потерять,
   повторите шаг 3 с `FORCE=1` непосредственно перед шагом 6:

   ```bash
   FORCE=1 OLD_REDIS_URL='redis://…' bash /opt/infocenter-rck/deploy/migrate.sh
   ```

   `FORCE=1` перезаписывает данные на сервере данными с Vercel, поэтому после
   переключения портала его больше не запускайте.

6. **Переключение портала.** Битрикс24 → Приложения → Разработчикам → ваше
   локальное приложение: **путь обработчика** (и путь установки, если задан)
   поменяйте на `https://<домен>/`. Сохраните, затем администратор портала
   должен **один раз открыть приложение** (полная перезагрузка страницы).

7. После нескольких дней спокойной работы проект на Vercel можно удалить
   (или хотя бы отключить в нём автодеплой).

## Обновление кода

```bash
DOMAIN=vm1101304.hosted-by.u1host.com BRANCH=main bash /opt/infocenter-rck/deploy/install.sh
```

Повторный запуск забирает свежий код, пересобирает и перезапускает службу;
настройки, данные, вложения и сертификат не трогаются.

## Резервные копии

Сохранять нужно только Redis (`/var/lib/redis`) и
`/var/lib/infocenter-rck/uploads`. Например, так (можно раз в сутки через cron):

```bash
redis-cli BGSAVE && sleep 5 && tar czf /root/infocenter-$(date +%F).tgz /var/lib/redis /var/lib/infocenter-rck/uploads
```

// Общий серверный токен Битрикс24 для записи в app.option от имени приложения,
// а не от имени конкретного открывшего его сотрудника.
//
// Почему это нужно: app.option.set в Битрикс24 разрешён только пользователям
// с правами администратора портала — обычный сотрудник, у которого приложение
// открыто в интерфейсе, получает ошибку доступа. Поэтому запись выполняется
// сервером под токеном, полученным один раз от администратора (см.
// maybeCaptureServiceToken), а не напрямую браузером пользователя.
import Redis from 'ioredis';

const SERVICE_TOKEN_KEY = 'rck:bx-service-token';
// Диагностика последней попытки открытия приложения — чтобы можно было
// понять, что произошло, через api/bitrix-status.js, не заходя в логи Vercel.
const LAST_OPEN_KEY = 'rck:bx-last-open';

// Redis Cloud (интеграция Vercel Marketplace) выдаёт обычную TCP-строку
// подключения в REDIS_URL, а не REST API — поэтому обычный клиент, не
// @upstash/redis. Клиент переиспользуется между вызовами в пределах одного
// «тёплого» экземпляра функции, чтобы не упираться в лимит подключений
// бесплатного плана (30 соединений).
let client;
function redis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('Redis (REDIS_URL) не подключён к проекту на Vercel');
  }
  if (!client) {
    client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  }
  return client;
}

async function kvGet(key) {
  const raw = await redis().get(key);
  return raw ? JSON.parse(raw) : null;
}

async function kvSet(key, value) {
  await redis().set(key, JSON.stringify(value));
}

function normalizeRestBase(raw) {
  if (!raw) return null;
  return raw.endsWith('/') ? raw : `${raw}/`;
}

// Что означают поля в install/open-POST и в ответе oauth.token (по докам
// apidocs.bitrix24.com/settings/oauth/index.html):
//   SERVER_ENDPOINT / server_endpoint — адрес СЕРВЕРА АВТОРИЗАЦИИ (oauth.bitrix.info
//     и региональные зеркала вроде oauth.bitrix24.tech). Годится только для
//     обмена токенов (oauth.token), а НЕ для вызова обычных REST-методов —
//     запрос profile через него отвечает "Access denied" (подтверждено в проде).
//   CLIENT_ENDPOINT / client_endpoint — адрес REST-интерфейса САМОГО ПОРТАЛА
//     (например "https://portal39.mb-product.ru/rest/"). Именно он нужен для
//     profile/app.option.set и т.п.
// В install-POST для этого приложения client_endpoint не присылается вовсе —
// только SERVER_ENDPOINT. Поэтому сразу меняем REFRESH_ID на полноценный
// токен через oauth.token — в его ответе client_endpoint/domain уже есть.
const OAUTH_TOKEN_URL = 'https://oauth.bitrix.info/oauth/token/';

async function exchangeRefreshToken(refreshToken) {
  const clientId = process.env.BITRIX_CLIENT_ID;
  const clientSecret = process.env.BITRIX_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('BITRIX_CLIENT_ID/BITRIX_CLIENT_SECRET не заданы на сервере');
  }

  const url = new URL(OAUTH_TOKEN_URL);
  url.searchParams.set('grant_type', 'refresh_token');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('refresh_token', refreshToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    const err = new Error(data.error_description || data.error || 'не удалось обменять токен Битрикс24');
    err.bxErrorCode = data.error || null;
    err.bxHttpStatus = res.status;
    throw err;
  }

  const restBase = normalizeRestBase(data.client_endpoint) || (data.domain ? `https://${data.domain}/rest/` : null);
  if (!restBase) {
    throw new Error('oauth.token не вернул ни client_endpoint, ни domain');
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    restBase,
    expires_at: Date.now() + (Number(data.expires_in || 3600) - 60) * 1000,
  };
}

async function refreshServiceToken(stored) {
  const fresh = await exchangeRefreshToken(stored.refresh_token);
  await kvSet(SERVICE_TOKEN_KEY, fresh);
  return fresh;
}

// Возвращает действующий сервисный токен, обновляя его через refresh_token,
// если он истёк. Бросает понятную ошибку, если токен ещё ни разу не был получен.
export async function getServiceToken() {
  const stored = await kvGet(SERVICE_TOKEN_KEY);
  if (!stored) {
    throw new Error(
      'Сервисный токен ещё не получен — попросите администратора один раз открыть приложение в Битрикс24'
    );
  }
  if (Date.now() < stored.expires_at) return stored;
  return refreshServiceToken(stored);
}

// Вызывается из api/serve.js при каждом открытии приложения (Битрикс24 шлёт
// POST с AUTH_ID/REFRESH_ID открывшего пользователя). Если это администратор
// портала — обновляем сервисный токен, которым потом пользуется
// api/save-dashboard.js от имени любого сотрудника. Обычных пользователей
// открытие приложения никак не затрагивает — текущий сервисный токен просто
// не трогается.
export async function maybeCaptureServiceToken(fields, rawKeysSeen) {
  const { authId, refreshId } = fields;
  const diag = {
    at: new Date().toISOString(),
    rawKeysSeen: rawKeysSeen || [],
    hasAuthId: Boolean(authId),
    hasRefreshId: Boolean(refreshId),
    exchangeOk: null,
    restBase: null,
    profileHttpStatus: null,
    profileOk: null,
    isAdmin: null,
    captured: false,
    error: null,
    errorCode: null,
  };

  if (!authId || !refreshId) {
    try {
      await kvSet(LAST_OPEN_KEY, diag);
    } catch {
      // Redis недоступен — просто пропускаем, не блокируем открытие страницы
    }
    return;
  }

  try {
    // REFRESH_ID из install-POST одноразовый, как и любой refresh_token —
    // используем его сразу, чтобы получить настоящий client_endpoint портала
    // (см. пояснение у OAUTH_TOKEN_URL выше). authId из POST после этого
    // отбрасываем, используем access_token из ответа обмена.
    const exchanged = await exchangeRefreshToken(refreshId);
    diag.exchangeOk = true;
    diag.restBase = exchanged.restBase;

    const res = await fetch(`${exchanged.restBase}profile?auth=${encodeURIComponent(exchanged.access_token)}`);
    diag.profileHttpStatus = res.status;
    const data = await res.json();
    diag.profileOk = Boolean(data.result);
    if (!data.result) {
      diag.error = data.error_description || 'profile lookup failed';
      diag.errorCode = data.error || null;
      await kvSet(LAST_OPEN_KEY, diag);
      return;
    }
    diag.isAdmin = Boolean(data.result.ADMIN);
    if (!data.result.ADMIN) {
      // не администратор — не трогаем текущий сервисный токен
      await kvSet(LAST_OPEN_KEY, diag);
      return;
    }

    await kvSet(SERVICE_TOKEN_KEY, exchanged);
    diag.captured = true;
    await kvSet(LAST_OPEN_KEY, diag);
  } catch (err) {
    diag.exchangeOk = diag.exchangeOk ?? false;
    diag.error = err instanceof Error ? err.message : String(err);
    diag.errorCode = err && err.bxErrorCode ? err.bxErrorCode : null;
    try {
      await kvSet(LAST_OPEN_KEY, diag);
    } catch {
      // Redis недоступен — не блокируем открытие страницы
    }
  }
}

// Диагностика последней попытки захвата токена (успешной или нет) — для
// api/bitrix-status.js.
export async function peekLastOpenAttempt() {
  return kvGet(LAST_OPEN_KEY);
}

// Только проверяет наличие сервисного токена, не обновляя его — для
// диагностического эндпоинта api/bitrix-status.js. В отличие от
// getServiceToken() не расходует refresh_token (он одноразовый).
export async function peekServiceToken() {
  const stored = await kvGet(SERVICE_TOKEN_KEY);
  if (!stored) return null;
  return { restBase: stored.restBase, expiresAt: stored.expires_at, valid: Date.now() < stored.expires_at };
}

// Лёгкая проверка, что запрос на сохранение действительно пришёл от текущего
// авторизованного сотрудника этого портала (а не произвольного POST извне).
// Не проверяет права — только то, что токен валиден прямо сейчас.
// auth.domain приходит из клиентского BX24.getAuth() (отдельный от install-POST
// API, там поле "domain" — штатное и документированное).
export async function verifyUserToken({ accessToken, domain }) {
  if (!accessToken || !domain) return false;
  try {
    const res = await fetch(`https://${domain}/rest/profile?auth=${encodeURIComponent(accessToken)}`);
    const data = await res.json();
    return Boolean(data.result);
  } catch {
    return false;
  }
}

export async function bxAppOptionSet(key, value) {
  const token = await getServiceToken();
  const body = new URLSearchParams();
  body.set('auth', token.access_token);
  body.set(`options[${key}]`, value);

  const res = await fetch(`${token.restBase}app.option.set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }
  return data.result;
}

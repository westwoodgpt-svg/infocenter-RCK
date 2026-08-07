// Cloudflare Worker: раздаёт собранный dist/ и обслуживает общие данные
// дашборда (карточки редактора) через app.option Битрикс24.
//
// Битрикс24 открывает локальное приложение POST-запросом (передаёт токен
// авторизации во внутренний iframe); статика Cloudflare отвечает на POST
// ошибкой 405, поэтому здесь принудительно переигрываем такой запрос в GET —
// но перед этим, если в теле есть AUTH_ID/REFRESH_ID, пытаемся поймать
// сервисный токен администратора (см. maybeCaptureServiceToken ниже).
//
// app.option.set в Битрикс24 разрешён только администраторам портала —
// обычный сотрудник с открытым приложением получает ошибку доступа. Поэтому
// запись карточек в app.option всегда идёт через этот сервер под токеном,
// один раз полученным от администратора, а не напрямую из браузера
// пользователя (см. /api/save-dashboard ниже). Токен и его refresh_token
// хранятся в Cloudflare KV (биндинг RCK_KV) — это прямой аналог Redis из
// такой же схемы в infocenter-IIC, адаптированный под рантайм Workers
// (там нет Node net-стека, который нужен клиентам вроде ioredis).

const OPTION_KEY = 'rck_dashboard_v1';
const SERVICE_TOKEN_KEY = 'rck:bx-service-token';
const LAST_OPEN_KEY = 'rck:bx-last-open';
const OAUTH_TOKEN_URL = 'https://oauth.bitrix.info/oauth/token/';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function normalizeRestBase(raw) {
  if (!raw) return null;
  return raw.endsWith('/') ? raw : `${raw}/`;
}

async function kvGet(env, key) {
  const raw = await env.RCK_KV.get(key);
  return raw ? JSON.parse(raw) : null;
}

async function kvSet(env, key, value) {
  await env.RCK_KV.put(key, JSON.stringify(value));
}

// Что означают поля в install/open-POST и в ответе oauth.token (по докам
// apidocs.bitrix24.com/settings/oauth/index.html):
//   SERVER_ENDPOINT / server_endpoint — адрес СЕРВЕРА АВТОРИЗАЦИИ (oauth.bitrix.info
//     и региональные зеркала). Годится только для обмена токенов (oauth.token),
//     а НЕ для вызова обычных REST-методов — запрос profile через него
//     отвечает "Access denied".
//   CLIENT_ENDPOINT / client_endpoint — адрес REST-интерфейса САМОГО ПОРТАЛА
//     (например "https://portal39.mb-product.ru/rest/"). Именно он нужен для
//     profile/app.option.set и т.п.
// В install-POST для этого приложения client_endpoint не присылается вовсе —
// только SERVER_ENDPOINT. Поэтому сразу меняем REFRESH_ID на полноценный
// токен через oauth.token — в его ответе client_endpoint/domain уже есть.
async function exchangeRefreshToken(refreshToken, env) {
  const clientId = env.BITRIX_CLIENT_ID;
  const clientSecret = env.BITRIX_CLIENT_SECRET;
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

async function refreshServiceToken(env, stored) {
  const fresh = await exchangeRefreshToken(stored.refresh_token, env);
  await kvSet(env, SERVICE_TOKEN_KEY, fresh);
  return fresh;
}

// Возвращает действующий сервисный токен, обновляя его через refresh_token,
// если он истёк. Бросает понятную ошибку, если токен ещё ни разу не был получен.
async function getServiceToken(env) {
  const stored = await kvGet(env, SERVICE_TOKEN_KEY);
  if (!stored) {
    throw new Error(
      'Сервисный токен ещё не получен — попросите администратора один раз открыть приложение в Битрикс24'
    );
  }
  if (Date.now() < stored.expires_at) return stored;
  return refreshServiceToken(env, stored);
}

// Вызывается при каждом открытии приложения (Битрикс24 шлёт POST с
// AUTH_ID/REFRESH_ID открывшего пользователя). Если это администратор
// портала — обновляем сервисный токен, которым потом пользуется
// /api/save-dashboard от имени любого сотрудника. Обычных пользователей
// открытие приложения никак не затрагивает — текущий сервисный токен просто
// не трогается.
async function maybeCaptureServiceToken(env, fields, rawKeysSeen) {
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
      await kvSet(env, LAST_OPEN_KEY, diag);
    } catch {
      // KV недоступен — просто пропускаем, не блокируем открытие страницы
    }
    return;
  }

  try {
    // REFRESH_ID из install-POST одноразовый, как и любой refresh_token —
    // используем его сразу, чтобы получить настоящий client_endpoint портала
    // (см. пояснение у exchangeRefreshToken выше). authId из POST после этого
    // отбрасываем, используем access_token из ответа обмена.
    const exchanged = await exchangeRefreshToken(refreshId, env);
    diag.exchangeOk = true;
    diag.restBase = exchanged.restBase;

    const res = await fetch(`${exchanged.restBase}profile?auth=${encodeURIComponent(exchanged.access_token)}`);
    diag.profileHttpStatus = res.status;
    const data = await res.json();
    diag.profileOk = Boolean(data.result);
    if (!data.result) {
      diag.error = data.error_description || 'profile lookup failed';
      diag.errorCode = data.error || null;
      await kvSet(env, LAST_OPEN_KEY, diag);
      return;
    }
    diag.isAdmin = Boolean(data.result.ADMIN);
    if (!data.result.ADMIN) {
      // не администратор — не трогаем текущий сервисный токен
      await kvSet(env, LAST_OPEN_KEY, diag);
      return;
    }

    await kvSet(env, SERVICE_TOKEN_KEY, exchanged);
    diag.captured = true;
    await kvSet(env, LAST_OPEN_KEY, diag);
  } catch (err) {
    diag.exchangeOk = diag.exchangeOk ?? false;
    diag.error = err instanceof Error ? err.message : String(err);
    diag.errorCode = err && err.bxErrorCode ? err.bxErrorCode : null;
    try {
      await kvSet(env, LAST_OPEN_KEY, diag);
    } catch {
      // KV недоступен — не блокируем открытие страницы
    }
  }
}

// Диагностика последней попытки захвата токена (успешной или нет) — для /api/bitrix-status.
async function peekLastOpenAttempt(env) {
  return kvGet(env, LAST_OPEN_KEY);
}

// Только проверяет наличие сервисного токена, не обновляя его — для
// диагностического эндпоинта /api/bitrix-status. В отличие от
// getServiceToken() не расходует refresh_token (он одноразовый).
async function peekServiceToken(env) {
  const stored = await kvGet(env, SERVICE_TOKEN_KEY);
  if (!stored) return null;
  return { restBase: stored.restBase, expiresAt: stored.expires_at, valid: Date.now() < stored.expires_at };
}

// Лёгкая проверка, что запрос на сохранение действительно пришёл от текущего
// авторизованного сотрудника этого портала (а не произвольного POST извне).
// Не проверяет права — только то, что токен валиден прямо сейчас.
// auth.domain приходит из клиентского BX24.getAuth() (отдельный от install-POST
// API, там поле "domain" — штатное и документированное).
async function verifyUserToken({ accessToken, domain }) {
  if (!accessToken || !domain) return false;
  try {
    const res = await fetch(`https://${domain}/rest/profile?auth=${encodeURIComponent(accessToken)}`);
    const data = await res.json();
    return Boolean(data.result);
  } catch {
    return false;
  }
}

async function bxAppOptionSet(env, key, value) {
  const token = await getServiceToken(env);
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

// Принимает изменения дашборда от ЛЮБОГО авторизованного сотрудника портала и
// сохраняет их в app.option от имени сервисного (администраторского) токена.
async function handleSaveDashboard(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method not allowed' }, 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'некорректный JSON в теле запроса' }, 400);
  }

  const { state, auth } = payload || {};
  if (!state || !auth || !auth.access_token || !auth.domain) {
    return jsonResponse({ ok: false, error: 'отсутствует state или auth' }, 400);
  }

  const isValidUser = await verifyUserToken({ accessToken: auth.access_token, domain: auth.domain });
  if (!isValidUser) {
    return jsonResponse({ ok: false, error: 'сессия Битрикс24 недействительна — обновите страницу' }, 403);
  }

  try {
    await bxAppOptionSet(env, OPTION_KEY, JSON.stringify(state));
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }, 502);
  }
}

// Диагностический эндпоинт: показывает, поймал ли сервер сервисный токен
// администратора, без раскрытия самого токена. Открыть в браузере:
// https://infocenterrck.westwoodgpt.workers.dev/api/bitrix-status
async function handleBitrixStatus(env) {
  const hasKv = Boolean(env.RCK_KV);
  const hasBitrixCreds = Boolean(env.BITRIX_CLIENT_ID && env.BITRIX_CLIENT_SECRET);

  if (!hasKv || !hasBitrixCreds) {
    return jsonResponse({
      ok: false,
      hasKv,
      hasBitrixCreds,
      serviceToken: null,
      hint: 'Не настроен KV-биндинг RCK_KV или переменные BITRIX_CLIENT_ID/BITRIX_CLIENT_SECRET — см. DEPLOYMENT.md.',
    });
  }

  try {
    const [token, lastOpenAttempt] = await Promise.all([peekServiceToken(env), peekLastOpenAttempt(env)]);
    return jsonResponse({
      ok: true,
      hasKv,
      hasBitrixCreds,
      serviceToken: token
        ? { restBase: token.restBase, valid: token.valid, expiresAt: new Date(token.expiresAt).toISOString() }
        : null,
      lastOpenAttempt,
      hint: token
        ? null
        : 'Сервисный токен ещё не сохранён — администратору нужно заново открыть приложение в Битрикс24 (полная перезагрузка, не просто переключение вкладки).',
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      hasKv,
      hasBitrixCreds,
      serviceToken: null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/save-dashboard') {
      return handleSaveDashboard(request, env);
    }

    if (url.pathname === '/api/bitrix-status') {
      return handleBitrixStatus(env);
    }

    if (request.method === 'POST') {
      // Битрикс24 открывает локальное приложение POST-запросом с
      // AUTH_ID/REFRESH_ID открывшего пользователя (application/x-www-form-urlencoded).
      // Ловим сервисный токен, если открывший — администратор, и ВСЕГДА
      // дожидаемся (await) этого перед ответом: Worker не гарантирует
      // выполнение необождённых промисов после отправки ответа.
      try {
        const form = await request.clone().formData();
        const params = Object.fromEntries(form.entries());
        await maybeCaptureServiceToken(
          env,
          { authId: params.AUTH_ID, refreshId: params.REFRESH_ID },
          Object.keys(params)
        );
      } catch {
        // Тело не form-data (или пустое) — не критично, просто отдаём статику ниже
      }
      return env.ASSETS.fetch(new Request(url.toString(), { method: 'GET' }));
    }

    return env.ASSETS.fetch(request);
  },
};

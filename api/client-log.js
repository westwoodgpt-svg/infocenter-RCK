// Как прошёл запуск приложения у сотрудника: откуда загрузился SDK Битрикс24,
// за сколько он поднялся, чем кончилось. Нужен, чтобы «автономный режим» в
// отдельных браузерах (Яндекс Браузер, десктоп Битрикс24) был виден без
// гаданий по логам nginx. Персональных данных нет: только итог и User-Agent.
//
// Авторизации здесь нет намеренно: пишут именно те, у кого Битрикс24 не
// поднялся и токена нет. Поэтому всё обрезается и проверяется по списку,
// а журнал ограничен последними LOG_MAX записями.
import { redisClient } from './_bitrixAuth.js';

const LOG_KEY = 'rck:client-log';
const LOG_MAX = 300;

const SOURCES = new Set(['bitrix24.com', 'self', 'none']);
const OUTCOMES = new Set(['bitrix', 'no-sdk', 'init-timeout', 'bootstrap-error', 'session-expired', 'ticket-invalid']);
const MODES = new Set(['portal', 'standalone']);

const clip = (v, n) => String(v == null ? '' : v).replace(/[\x00-\x1f]+/g, ' ').slice(0, n);

export function sanitizeClientLog(body, req) {
  const src = body && typeof body === 'object' ? body : {};
  const initMs = Number(src.initMs);
  return {
    at: new Date().toISOString(),
    mode: MODES.has(src.mode) ? src.mode : 'portal',
    outcome: OUTCOMES.has(src.outcome) ? src.outcome : 'unknown',
    sdkSource: SOURCES.has(src.sdkSource) ? src.sdkSource : 'none',
    initMs: Number.isFinite(initMs) ? Math.max(0, Math.min(Math.round(initMs), 600000)) : null,
    error: src.error ? clip(src.error, 200) : null,
    ua: clip(src.ua || (req && req.headers && req.headers['user-agent']), 300),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  try {
    const redis = redisClient();
    await redis.lpush(LOG_KEY, JSON.stringify(sanitizeClientLog(body, req)));
    await redis.ltrim(LOG_KEY, 0, LOG_MAX - 1);
  } catch {
    // журнал необязателен
  }
  res.status(204).end();
}

/** Последние записи и сводка по исходам — для /api/bitrix-status. */
export async function peekClientLog(limit = 40) {
  const rows = await redisClient().lrange(LOG_KEY, 0, LOG_MAX - 1);
  const entries = [];
  for (const raw of rows) {
    try {
      entries.push(JSON.parse(raw));
    } catch {
      // повреждённая запись
    }
  }
  const byOutcome = {};
  for (const e of entries) byOutcome[e.outcome] = (byOutcome[e.outcome] || 0) + 1;
  return { total: entries.length, byOutcome, last: entries.slice(0, limit) };
}

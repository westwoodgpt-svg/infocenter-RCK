// Отдельное окно инфоцентра: вход без iframe портала.
//
// Внутри портала сотрудника удостоверяет токен Битрикс24 (BX24.getAuth). В
// отдельной вкладке BX24 нет, поэтому вход передаётся так:
//   1. Приложение в портале просит билет (действие standalone-ticket) своим
//      обычным токеном. Сервер проверяет сотрудника и кладёт в Redis случайный
//      билет на 60 секунд — одноразовый.
//   2. Билет уходит в новую вкладку во фрагменте адреса (#ticket=…): фрагмент
//      не отправляется на сервер и не попадает в журнал nginx.
//   3. Вкладка меняет билет на сессию (POST /api/standalone-login): билет
//      удаляется, сервер ставит cookie HttpOnly; Secure; SameSite=Lax.
//   4. Дальше /api/dashboard принимает эту cookie вместо токена Битрикс24.
//      Права при каждом запросе считаются заново (resolveAccess).
//
// В Redis лежат только SHA-256 от билета и сессии — по содержимому базы ими
// нельзя войти. Сами билеты и cookie нигде не логируются.
import { createHash, randomBytes } from 'node:crypto';
import { redisClient } from './_bitrixAuth.js';

export const SESSION_COOKIE = 'rck_sa';
const TICKET_TTL_SEC = 60;
// Сессия живёт 8 часов с последней работы, но не дольше суток с входа:
// потом окно снова открывают из портала (заодно обновятся отделы и права).
const SESSION_IDLE_SEC = 8 * 60 * 60;
const SESSION_MAX_SEC = 24 * 60 * 60;
// Продлеваем не на каждый запрос, а раз в несколько минут.
const SESSION_TOUCH_SEC = 5 * 60;

const sha = (value) => createHash('sha256').update(String(value)).digest('hex');
const ticketKey = (ticket) => `rck:standalone-ticket:${sha(ticket)}`;
const sessionKey = (sid) => `rck:standalone-session:${sha(sid)}`;
const token = () => randomBytes(32).toString('base64url');

/** Только то, что нужно для прав: без токенов Битрикс24. */
function slimIdentity(identity) {
  return {
    id: String(identity.id),
    name: identity.name || '',
    isAdmin: Boolean(identity.isAdmin),
    departmentIds: Array.isArray(identity.departmentIds) ? identity.departmentIds.map(String) : [],
  };
}

export async function issueTicket(identity, view) {
  const ticket = token();
  await redisClient().set(ticketKey(ticket), JSON.stringify({ identity: slimIdentity(identity), view: view || null }), 'EX', TICKET_TTL_SEC);
  return ticket;
}

/** Обменять билет: читаем и удаляем одной командой, повторный обмен — null. */
export async function redeemTicket(ticket) {
  if (typeof ticket !== 'string' || ticket.length < 40 || ticket.length > 100) return null;
  // GET и DEL в одной транзакции (MULTI): атомарно и работает на любом Redis,
  // в отличие от GETDEL (только с 6.2).
  const key = ticketKey(ticket);
  const [[, raw]] = await redisClient().multi().get(key).del(key).exec();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function createSession(identity) {
  const sid = token();
  const now = Date.now();
  const record = { identity: slimIdentity(identity), createdAt: now, touchedAt: now };
  await redisClient().set(sessionKey(sid), JSON.stringify(record), 'EX', SESSION_IDLE_SEC);
  return sid;
}

/** Сессия по cookie: { identity, sid, renewed } или null (нет, истекла). */
export async function readSession(req) {
  const sid = readCookie(req, SESSION_COOKIE);
  if (!sid || sid.length > 100) return null;
  const redis = redisClient();
  const raw = await redis.get(sessionKey(sid));
  if (!raw) return null;
  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return null;
  }
  const now = Date.now();
  const age = (now - Number(record.createdAt || 0)) / 1000;
  if (!record.identity || age > SESSION_MAX_SEC) {
    await redis.del(sessionKey(sid)).catch(() => {});
    return null;
  }
  let renewed = false;
  if ((now - Number(record.touchedAt || 0)) / 1000 > SESSION_TOUCH_SEC) {
    const ttl = Math.min(SESSION_IDLE_SEC, Math.max(1, Math.floor(SESSION_MAX_SEC - age)));
    await redis.set(sessionKey(sid), JSON.stringify({ ...record, touchedAt: now }), 'EX', ttl);
    renewed = true;
  }
  return { identity: record.identity, sid, renewed, maxAgeSec: Math.floor(Math.min(SESSION_IDLE_SEC, SESSION_MAX_SEC - age)) };
}

export async function destroySession(req) {
  const sid = readCookie(req, SESSION_COOKIE);
  if (sid && sid.length <= 100) await redisClient().del(sessionKey(sid)).catch(() => {});
}

export async function countSessions() {
  let cursor = '0';
  let count = 0;
  do {
    const [next, batch] = await redisClient().scan(cursor, 'MATCH', 'rck:standalone-session:*', 'COUNT', 500);
    cursor = next;
    count += batch.length;
  } while (cursor !== '0');
  return count;
}

export function sessionCookie(sid, maxAgeSec = SESSION_IDLE_SEC) {
  return `${SESSION_COOKIE}=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

export function readCookie(req, name) {
  const header = (req.headers && req.headers.cookie) || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/**
 * Запрос с cookie должен прийти с нашей же страницы. Чужой сайт не сможет
 * подделать заголовок Origin, поэтому это защита от подделки запросов (CSRF)
 * в дополнение к SameSite=Lax. Ожидаемый адрес — STANDALONE_ORIGIN или
 * https://<Host запроса>.
 */
export function sameOrigin(req) {
  const origin = req.headers && req.headers.origin;
  if (!origin) return false;
  const expected = (process.env.STANDALONE_ORIGIN || '').trim().replace(/\/$/, '');
  if (expected) return origin === expected;
  const host = req.headers.host;
  return Boolean(host) && (origin === `https://${host}` || (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) && origin === `http://${host}`));
}

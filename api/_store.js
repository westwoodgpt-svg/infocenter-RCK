// Хранилище дашборда и истории изменений карточек.
//
// ПОЧЕМУ НЕ app.option: до 28.08.2026 состояние дашборда целиком писалось в
// одну опцию приложения Битрикс24 (`app.option.set`, ключ rck_dashboard_v1).
// Значение опции на портале ограничено по объёму (TEXT-поле), и как только
// в инфоцентре появились карточки-изображения (data:URL в base64) и таблицы,
// запись стала падать. Внешне это выглядело так: сотрудник вносит правку —
// она видна полсекунды и исчезает, потому что следующее чтение из app.option
// возвращало старое, не перезаписанное значение. Теперь состояние живёт в
// Redis (тот же инстанс, что и сервисный токен), а app.option используется
// только как резервная копия, когда состояние достаточно маленькое.
import { getServiceToken, bxAppOptionGet, bxAppOptionSet, redisClient } from './_bitrixAuth.js';
import { LEGACY_BOARD_ID } from './_access.js';

// Каждый инфоцентр (отдел) — свой набор ключей. Префикс `rck` принадлежит
// историческому общему инфоцентру РЦК: его ключи не переименовывались, чтобы
// уже внесённые данные остались на месте (см. storagePrefixFor в _access.js).
const currentKey = (prefix) => `rck:board:${prefix}:current`;
const snapshotKey = (prefix, rev) => `rck:board:${prefix}:snap:${rev}`;
const cardHistoryKey = (prefix, tab, cardId) => `rck:card-history:${prefix}:${tab}:${cardId}`;
// Личная настройка сводного экрана: у каждого руководителя своя.
const summaryConfigKey = (userId) => `rck:summary-config:${userId}`;

// Ключи до разделения по отделам — читаются как запасной вариант для РЦК.
const LEGACY_CURRENT_KEY = 'rck:dashboard:current';
const legacyCardHistoryKey = (tab, cardId) => `rck:card-history:${tab}:${cardId}`;

// Ключ той самой опции, из которой мигрируем и в которую (по возможности)
// продолжаем класть резервную копию.
const OPTION_KEY = 'rck_dashboard_v1';

export const TABS = ['security', 'quality', 'production', 'costs', 'personnel'];

// Витрина — общий для всей компании экран со стикерами. Хранится как любой
// инфоцентр (своя история, слияние правок), только вместо пяти вкладок у неё
// два списка: колонки и стикеры (у стикера — id колонки, порядок = порядок в
// массиве). Поэтому слияние и история работают по тем же правилам, что у карточек.
export const SHOWCASE_PREFIX = 'showcase';
export const SHOWCASE_LISTS = ['columns', 'notes'];
export const listsFor = (prefix) => (prefix === SHOWCASE_PREFIX ? SHOWCASE_LISTS : TABS);

// Лимиты. Redis на бесплатном плане — 30 МБ, поэтому и состояние, и история
// ограничены по объёму, иначе одна карточка с фотографией съест всю базу.
const MAX_STATE_BYTES = 3_500_000;
const SNAPSHOT_MAX_BYTES = 1_200_000;
const SNAPSHOT_TTL_SEC = 60 * 60 * 24; // сутки — снимок нужен только «живым» вкладкам для слияния
const OPTION_MIRROR_MAX_BYTES = 48_000;
const HISTORY_MAX_ENTRIES = 40;
const HISTORY_MAX_BYTES = 700_000;
const HISTORY_ENTRY_MAX_BYTES = 180_000;

export function normalizeState(raw, lists = TABS) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const tab of lists) {
    out[tab] = Array.isArray(src[tab]) ? src[tab].filter((c) => c && typeof c === 'object' && c.id) : [];
  }
  return out;
}

function byId(list) {
  const map = new Map();
  for (const card of list) map.set(card.id, card);
  return map;
}

function sameCard(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function readJson(key) {
  const raw = await redisClient().get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Чтение
// ---------------------------------------------------------------------------

export async function loadDashboard(prefix) {
  let current = await readJson(currentKey(prefix));
  if (!current && prefix === LEGACY_BOARD_ID) {
    // Данные, записанные до разделения инфоцентров по отделам.
    current = await readJson(LEGACY_CURRENT_KEY);
  }
  if (current && current.state) {
    return {
      state: normalizeState(current.state, listsFor(prefix)),
      rev: Number(current.rev) || 1,
      updatedAt: current.updatedAt || null,
      updatedBy: current.updatedBy || null,
      source: 'redis',
    };
  }
  // app.option — хранилище только исторического инфоцентра РЦК.
  if (prefix === LEGACY_BOARD_ID) return migrateFromAppOption();
  return null;
}

// Однократный перенос ранее введённых данных из app.option в Redis. Вызывается
// только когда в Redis ещё ничего нет — потерять уже занесённую информацию при
// переезде на новое хранилище нельзя.
async function migrateFromAppOption() {
  let raw = null;
  try {
    raw = await bxAppOptionGet(OPTION_KEY);
  } catch {
    return null; // нет сервисного токена / портал недоступен — просто нечего мигрировать
  }
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const state = normalizeState(parsed);
  const record = {
    rev: 1,
    state,
    updatedAt: new Date().toISOString(),
    updatedBy: 'перенос из app.option',
  };
  await redisClient().set(currentKey(LEGACY_BOARD_ID), JSON.stringify(record));
  await writeSnapshot(LEGACY_BOARD_ID, 1, state);
  return { ...record, source: 'app.option' };
}

// ---------------------------------------------------------------------------
// Запись
// ---------------------------------------------------------------------------

export async function saveDashboard({ prefix, state: incomingRaw, baseRev, author }) {
  if (!prefix) throw new Error('не указан инфоцентр для сохранения');
  const lists = listsFor(prefix);
  const incoming = normalizeState(incomingRaw, lists);
  const serialized = JSON.stringify(incoming);
  if (serialized.length > MAX_STATE_BYTES) {
    const err = new Error(
      `слишком большой объём данных (${Math.round(serialized.length / 1024)} КБ) — уменьшите изображения в карточках`
    );
    err.tooLarge = true;
    throw err;
  }

  let current = await readJson(currentKey(prefix));
  if (!current && prefix === LEGACY_BOARD_ID) current = await readJson(LEGACY_CURRENT_KEY);
  const prevState = current && current.state ? normalizeState(current.state, lists) : null;
  const currentRev = current ? Number(current.rev) || 0 : 0;

  let merged = incoming;
  let mergedWith = null;
  if (prevState && baseRev != null && Number(baseRev) !== currentRev) {
    // Пока вкладка редактировала, кто-то уже сохранился. Берём снимок,
    // от которого отталкивался этот клиент, и накладываем ТОЛЬКО его правки
    // на актуальное состояние — иначе одна вкладка молча затирает другую.
    const base = await readJson(snapshotKey(prefix, Number(baseRev)));
    if (base && base.state) {
      merged = threeWayMerge(normalizeState(base.state, lists), incoming, prevState, lists);
      mergedWith = currentRev;
    }
  }

  const nextRev = currentRev + 1;
  const record = {
    rev: nextRev,
    state: merged,
    updatedAt: new Date().toISOString(),
    updatedBy: author || null,
  };
  await redisClient().set(currentKey(prefix), JSON.stringify(record));
  await writeSnapshot(prefix, nextRev, merged);
  await recordHistory(prefix, prevState, merged, { rev: nextRev, at: record.updatedAt, by: author || null }, lists);
  if (prefix === LEGACY_BOARD_ID) await mirrorToAppOption(merged);

  return { rev: nextRev, updatedAt: record.updatedAt, state: merged, mergedWith };
}

async function writeSnapshot(prefix, rev, state) {
  const payload = JSON.stringify({ rev, state });
  if (payload.length > SNAPSHOT_MAX_BYTES) return; // слишком тяжёлое — обойдёмся без слияния
  try {
    await redisClient().set(snapshotKey(prefix, rev), payload, 'EX', SNAPSHOT_TTL_SEC);
  } catch {
    // снимок — вспомогательные данные, его потеря не должна ронять сохранение
  }
}

// Резервная копия в app.option — ровно то место, где данные лежали раньше.
// Пишем только пока состояние помещается в опцию портала; ошибки игнорируем,
// чтобы отказ Битрикс24 больше никогда не блокировал сохранение.
async function mirrorToAppOption(state) {
  const payload = JSON.stringify(state);
  if (payload.length > OPTION_MIRROR_MAX_BYTES) return;
  try {
    await getServiceToken();
    await bxAppOptionSet(OPTION_KEY, payload);
  } catch {
    // резервная копия необязательна
  }
}

// ---------------------------------------------------------------------------
// Слияние правок двух вкладок
// ---------------------------------------------------------------------------

export function threeWayMerge(base, mine, theirs, lists = TABS) {
  const out = {};
  for (const tab of lists) {
    out[tab] = mergeTab(base[tab] || [], mine[tab] || [], theirs[tab] || []);
  }
  return out;
}

function mergeTab(baseList, mineList, theirsList) {
  const baseById = byId(baseList);
  const mineById = byId(mineList);
  const result = [];
  const placed = new Set();

  for (const theirCard of theirsList) {
    const id = theirCard.id;
    const mine = mineById.get(id);
    const base = baseById.get(id);
    if (!mine) {
      // карточки нет в моей версии: если она была в базе — я её удалил,
      // если не была — её только что добавил коллега, сохраняем.
      if (!base) {
        result.push(theirCard);
        placed.add(id);
      }
      continue;
    }
    const iChangedIt = !base || !sameCard(base, mine);
    result.push(iChangedIt ? mine : theirCard);
    placed.add(id);
  }

  mineList.forEach((card, idx) => {
    if (placed.has(card.id)) return;
    const base = baseById.get(card.id);
    // Карточки нет у коллеги. Либо я её только что создал, либо коллега её
    // удалил. Удаление уважаем только если сам я её не правил — потерять
    // внесённую информацию хуже, чем оставить лишнюю карточку.
    if (base && sameCard(base, card)) return;
    result.splice(Math.min(idx, result.length), 0, card);
    placed.add(card.id);
  });

  return result;
}

// ---------------------------------------------------------------------------
// История изменений по карточкам (таймлайн в интерфейсе)
// ---------------------------------------------------------------------------

export function diffCards(prevState, nextState, lists = TABS) {
  const changes = [];
  for (const tab of lists) {
    const prevList = prevState ? prevState[tab] || [] : [];
    const nextList = nextState[tab] || [];
    const prevById = byId(prevList);
    const nextById = byId(nextList);

    for (const card of nextList) {
      const before = prevById.get(card.id);
      if (!before) {
        changes.push({ tab, cardId: card.id, action: 'create', card });
      } else if (!sameCard(before, card)) {
        changes.push({ tab, cardId: card.id, action: 'update', card });
      }
    }
    for (const card of prevList) {
      if (!nextById.has(card.id)) {
        changes.push({ tab, cardId: card.id, action: 'delete', card });
      }
    }
  }
  return changes;
}

// Версия для истории без тяжёлых встроенных данных: картинки карточки
// «Изображение» и вложения стикеров, сохранённые прямо в данных (data:URL).
// Файлы из хранилища (обычные ссылки) остаются — они ничего не весят.
function lightweightCopy(card) {
  const out = { ...card };
  if (typeof out.imageUrl === 'string') out.imageUrl = '';
  if (Array.isArray(out.attachments)) {
    out.attachments = out.attachments.map((a) =>
      a && typeof a.url === 'string' && a.url.startsWith('data:') ? { ...a, url: '' } : a
    );
  }
  return out;
}

async function recordHistory(prefix, prevState, nextState, meta, lists = TABS) {
  const changes = diffCards(prevState, nextState, lists);
  if (!changes.length) return;

  const redis = redisClient();
  for (const change of changes) {
    const entry = {
      rev: meta.rev,
      at: meta.at,
      by: meta.by,
      action: change.action,
      card: change.card,
    };
    let payload = JSON.stringify(entry);
    if (payload.length > HISTORY_ENTRY_MAX_BYTES) {
      // Карточка с тяжёлой картинкой: в истории храним всё, кроме самого
      // изображения — иначе таймлайн одной карточки выест всю базу.
      payload = JSON.stringify({ ...entry, card: lightweightCopy(change.card), trimmed: true });
    }
    const key = cardHistoryKey(prefix, change.tab, change.cardId);
    try {
      await redis.lpush(key, payload);
      await redis.ltrim(key, 0, HISTORY_MAX_ENTRIES - 1);
      await trimHistoryBySize(key);
    } catch {
      // история — не критичный путь, сохранение не роняем
    }
  }
}

async function trimHistoryBySize(key) {
  const rows = await redisClient().lrange(key, 0, -1);
  let total = 0;
  let keep = rows.length;
  for (let i = 0; i < rows.length; i += 1) {
    total += rows[i].length;
    if (total > HISTORY_MAX_BYTES) {
      keep = Math.max(i, 1); // хотя бы одну версию оставляем всегда
      break;
    }
  }
  if (keep < rows.length) await redisClient().ltrim(key, 0, keep - 1);
}

// Краткая сводка для диагностического эндпоинта — без содержимого карточек.
export async function peekDashboard(prefix) {
  const raw = (await redisClient().get(currentKey(prefix))) ||
    (prefix === LEGACY_BOARD_ID ? await redisClient().get(LEGACY_CURRENT_KEY) : null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      rev: parsed.rev,
      updatedAt: parsed.updatedAt,
      sizeKb: Math.round(raw.length / 1024),
      cards: TABS.reduce((acc, tab) => acc + ((parsed.state && parsed.state[tab]) || []).length, 0),
    };
  } catch {
    return null;
  }
}

// Какие инфоцентры вообще хранятся на сервере (для диагностики переноса):
// префикс, номер версии, число карточек, когда и кем сохранён последний раз.
export async function listStoredBoards() {
  const redis = redisClient();
  const keys = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', 'rck:board:*:current', 'COUNT', 500);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');
  const out = [];
  for (const key of keys) {
    const prefix = key.slice('rck:board:'.length, -':current'.length);
    try {
      const parsed = JSON.parse(await redis.get(key));
      const lists = listsFor(prefix);
      const cards = lists.reduce((acc, tab) => acc + (((parsed.state || {})[tab]) || []).length, 0);
      out.push({ prefix, rev: parsed.rev, cards, updatedAt: parsed.updatedAt || null, updatedBy: parsed.updatedBy || null });
    } catch {
      out.push({ prefix, error: 'не читается' });
    }
  }
  return out.sort((a, b) => a.prefix.localeCompare(b.prefix));
}

// Версии карточки от старых к новым — в таком порядке их ждёт ползунок.
export async function cardHistory(prefix, tab, cardId) {
  let rows = await redisClient().lrange(cardHistoryKey(prefix, tab, cardId), 0, -1);
  if (!rows.length && prefix === LEGACY_BOARD_ID) {
    rows = await redisClient().lrange(legacyCardHistoryKey(tab, cardId), 0, -1);
  }
  const entries = [];
  for (const raw of rows) {
    try {
      entries.push(JSON.parse(raw));
    } catch {
      // повреждённая запись — пропускаем
    }
  }
  return entries.reverse();
}

// ---------------------------------------------------------------------------
// Настройка сводного экрана (какие отделы и какие карточки на нём показывать)
// ---------------------------------------------------------------------------

const SUMMARY_CONFIG_MAX_BOARDS = 100;
const SUMMARY_CONFIG_MAX_CARDS = 300;

/** Приводим присланную настройку к ожидаемому виду: клиенту доверять нельзя. */
export function normalizeSummaryConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const order = Array.isArray(src.order) ? src.order.filter((id) => typeof id === 'string').slice(0, SUMMARY_CONFIG_MAX_BOARDS) : [];
  const boards = {};
  const srcBoards = src.boards && typeof src.boards === 'object' ? src.boards : {};
  for (const [boardId, pref] of Object.entries(srcBoards).slice(0, SUMMARY_CONFIG_MAX_BOARDS)) {
    if (typeof boardId !== 'string' || !pref || typeof pref !== 'object') continue;
    const entry = {};
    if (pref.hidden) entry.hidden = true;
    if (pref.cards && typeof pref.cards === 'object') {
      const cards = {};
      for (const tab of TABS) {
        const list = pref.cards[tab];
        if (!Array.isArray(list)) continue;
        cards[tab] = list.filter((id) => typeof id === 'string').slice(0, SUMMARY_CONFIG_MAX_CARDS);
      }
      if (Object.keys(cards).length) entry.cards = cards;
    }
    boards[boardId] = entry;
  }
  return { version: 1, order, boards };
}

// ---------------------------------------------------------------------------
// Последний открытый вид сотрудника: витрина, сводный экран или инфоцентр.
// Личная настройка — лежит под сотрудником, как настройка сводного экрана,
// поэтому переезжает с ним на другой компьютер и в десктоп Битрикс24.
// ---------------------------------------------------------------------------

const lastViewKey = (userId) => `rck:last-view:${userId}`;

export function normalizeView(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.kind === 'showcase' || raw.kind === 'summary') return { kind: raw.kind };
  if (raw.kind === 'board' && typeof raw.boardId === 'string' && raw.boardId && raw.boardId.length <= 100) {
    return { kind: 'board', boardId: raw.boardId };
  }
  return null;
}

export async function loadLastView(userId) {
  return normalizeView(await readJson(lastViewKey(userId)));
}

export async function saveLastView(userId, view) {
  await redisClient().set(lastViewKey(userId), JSON.stringify(view));
}

export async function loadSummaryConfig(userId) {
  const stored = await readJson(summaryConfigKey(userId));
  return stored ? normalizeSummaryConfig(stored) : null;
}

export async function saveSummaryConfig(userId, raw) {
  const config = normalizeSummaryConfig(raw);
  await redisClient().set(summaryConfigKey(userId), JSON.stringify(config));
  return config;
}

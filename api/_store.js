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

const CURRENT_KEY = 'rck:dashboard:current';
const snapshotKey = (rev) => `rck:dashboard:snap:${rev}`;
const cardHistoryKey = (tab, cardId) => `rck:card-history:${tab}:${cardId}`;

// Ключ той самой опции, из которой мигрируем и в которую (по возможности)
// продолжаем класть резервную копию.
const OPTION_KEY = 'rck_dashboard_v1';

export const TABS = ['security', 'quality', 'production', 'costs', 'personnel'];

// Лимиты. Redis на бесплатном плане — 30 МБ, поэтому и состояние, и история
// ограничены по объёму, иначе одна карточка с фотографией съест всю базу.
const MAX_STATE_BYTES = 3_500_000;
const SNAPSHOT_MAX_BYTES = 1_200_000;
const SNAPSHOT_TTL_SEC = 60 * 60 * 24; // сутки — снимок нужен только «живым» вкладкам для слияния
const OPTION_MIRROR_MAX_BYTES = 48_000;
const HISTORY_MAX_ENTRIES = 40;
const HISTORY_MAX_BYTES = 700_000;
const HISTORY_ENTRY_MAX_BYTES = 180_000;

export function normalizeState(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const tab of TABS) {
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

export async function loadDashboard() {
  const current = await readJson(CURRENT_KEY);
  if (current && current.state) {
    return {
      state: normalizeState(current.state),
      rev: Number(current.rev) || 1,
      updatedAt: current.updatedAt || null,
      updatedBy: current.updatedBy || null,
      source: 'redis',
    };
  }
  return migrateFromAppOption();
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
  await redisClient().set(CURRENT_KEY, JSON.stringify(record));
  await writeSnapshot(1, state);
  return { ...record, source: 'app.option' };
}

// ---------------------------------------------------------------------------
// Запись
// ---------------------------------------------------------------------------

export async function saveDashboard({ state: incomingRaw, baseRev, author }) {
  const incoming = normalizeState(incomingRaw);
  const serialized = JSON.stringify(incoming);
  if (serialized.length > MAX_STATE_BYTES) {
    const err = new Error(
      `слишком большой объём данных (${Math.round(serialized.length / 1024)} КБ) — уменьшите изображения в карточках`
    );
    err.tooLarge = true;
    throw err;
  }

  const current = await readJson(CURRENT_KEY);
  const prevState = current && current.state ? normalizeState(current.state) : null;
  const currentRev = current ? Number(current.rev) || 0 : 0;

  let merged = incoming;
  let mergedWith = null;
  if (prevState && baseRev != null && Number(baseRev) !== currentRev) {
    // Пока вкладка редактировала, кто-то уже сохранился. Берём снимок,
    // от которого отталкивался этот клиент, и накладываем ТОЛЬКО его правки
    // на актуальное состояние — иначе одна вкладка молча затирает другую.
    const base = await readJson(snapshotKey(Number(baseRev)));
    if (base && base.state) {
      merged = threeWayMerge(normalizeState(base.state), incoming, prevState);
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
  await redisClient().set(CURRENT_KEY, JSON.stringify(record));
  await writeSnapshot(nextRev, merged);
  await recordHistory(prevState, merged, { rev: nextRev, at: record.updatedAt, by: author || null });
  await mirrorToAppOption(merged);

  return { rev: nextRev, updatedAt: record.updatedAt, state: merged, mergedWith };
}

async function writeSnapshot(rev, state) {
  const payload = JSON.stringify({ rev, state });
  if (payload.length > SNAPSHOT_MAX_BYTES) return; // слишком тяжёлое — обойдёмся без слияния
  try {
    await redisClient().set(snapshotKey(rev), payload, 'EX', SNAPSHOT_TTL_SEC);
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

export function threeWayMerge(base, mine, theirs) {
  const out = {};
  for (const tab of TABS) {
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

export function diffCards(prevState, nextState) {
  const changes = [];
  for (const tab of TABS) {
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

async function recordHistory(prevState, nextState, meta) {
  const changes = diffCards(prevState, nextState);
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
      payload = JSON.stringify({ ...entry, card: { ...change.card, imageUrl: '' }, trimmed: true });
    }
    const key = cardHistoryKey(change.tab, change.cardId);
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
export async function peekDashboard() {
  const raw = await redisClient().get(CURRENT_KEY);
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

// Версии карточки от старых к новым — в таком порядке их ждёт ползунок.
export async function cardHistory(tab, cardId) {
  const rows = await redisClient().lrange(cardHistoryKey(tab, cardId), 0, -1);
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

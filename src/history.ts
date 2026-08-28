import { AnyCard, DashboardState, TabId } from './types';
import { CardHistoryEntry } from './bitrix';

// История изменений карточек для автономного режима (инфоцентр открыт вне
// Битрикс24). Внутри портала история ведётся на сервере — см. api/_store.js,
// формат записей одинаковый, поэтому ползунок на карточке работает одинаково
// в обоих режимах.

const LOCAL_HISTORY_KEY = 'rck-dashboard-history-v1';
const MAX_ENTRIES_PER_CARD = 25;
const MAX_ENTRY_BYTES = 60_000;

const TABS: TabId[] = ['security', 'quality', 'production', 'costs', 'personnel'];

type LocalHistory = Record<string, CardHistoryEntry[]>;

const keyOf = (tab: TabId, cardId: string) => `${tab}:${cardId}`;

function sameCard(a: AnyCard, b: AnyCard) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface CardChange {
  tab: TabId;
  cardId: string;
  action: 'create' | 'update' | 'delete';
  card: AnyCard;
}

export function diffCards(prev: DashboardState, next: DashboardState): CardChange[] {
  const changes: CardChange[] = [];
  for (const tab of TABS) {
    const prevList = prev[tab] || [];
    const nextList = next[tab] || [];
    const prevById = new Map(prevList.map((c) => [c.id, c]));
    const nextIds = new Set(nextList.map((c) => c.id));

    for (const card of nextList) {
      const before = prevById.get(card.id);
      if (!before) changes.push({ tab, cardId: card.id, action: 'create', card });
      else if (!sameCard(before, card)) changes.push({ tab, cardId: card.id, action: 'update', card });
    }
    for (const card of prevList) {
      if (!nextIds.has(card.id)) changes.push({ tab, cardId: card.id, action: 'delete', card });
    }
  }
  return changes;
}

function readAll(): LocalHistory {
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as LocalHistory) : {};
  } catch {
    return {};
  }
}

function writeAll(history: LocalHistory) {
  try {
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // квота браузера исчерпана — история необязательна, данные карточек важнее
  }
}

export function recordLocalHistory(prev: DashboardState, next: DashboardState, author = 'этот браузер') {
  const changes = diffCards(prev, next);
  if (!changes.length) return;

  const history = readAll();
  const at = new Date().toISOString();
  for (const change of changes) {
    const key = keyOf(change.tab, change.cardId);
    let entry: CardHistoryEntry = { at, by: author, action: change.action, card: change.card };
    if (JSON.stringify(entry).length > MAX_ENTRY_BYTES) {
      entry = { ...entry, card: { ...change.card, imageUrl: '' } as AnyCard, trimmed: true };
    }
    const list = history[key] ? [...history[key], entry] : [entry];
    history[key] = list.slice(-MAX_ENTRIES_PER_CARD);
  }
  writeAll(history);
}

export function readLocalCardHistory(tab: TabId, cardId: string): CardHistoryEntry[] {
  return readAll()[keyOf(tab, cardId)] || [];
}

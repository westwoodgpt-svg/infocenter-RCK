import { SummaryBoardPref, SummaryConfig, SummarySection, TabId } from './types';

// Настройка сводного экрана применяется на клиенте: сервер отдаёт всё, что
// сотруднику доступно, а руководитель сам решает, какие отделы и какие карточки
// он хочет видеть у себя в сводке.

export function prefFor(config: SummaryConfig, boardId: string): SummaryBoardPref {
  return config.boards[boardId] || {};
}

/** Отдел показывается на сводном экране? */
export function isBoardVisible(config: SummaryConfig, boardId: string): boolean {
  return !prefFor(config, boardId).hidden;
}

/** Выбранные карточки отдела на вкладке; null — «все карточки» (по умолчанию). */
export function selectedCardIds(config: SummaryConfig, boardId: string, tab: TabId): string[] | null {
  const list = prefFor(config, boardId).cards?.[tab];
  return Array.isArray(list) ? list : null;
}

function orderIndex(config: SummaryConfig, boardId: string): number {
  const idx = config.order.indexOf(boardId);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

/** Разделы сводного экрана с учётом настройки: порядок, скрытые отделы, выбранные карточки. */
export function applySummaryConfig(
  sections: SummarySection[],
  config: SummaryConfig,
  tab: TabId
): SummarySection[] {
  return sections
    .filter((s) => isBoardVisible(config, s.boardId))
    .map((s, i) => ({ section: s, i }))
    .sort((a, b) => orderIndex(config, a.section.boardId) - orderIndex(config, b.section.boardId) || a.i - b.i)
    .map(({ section }) => {
      const selected = selectedCardIds(config, section.boardId, tab);
      if (!selected) return section;
      const allowed = new Set(selected);
      // Порядок карточек берём из самого инфоцентра — отдел решает, как их расставить.
      return { ...section, cards: section.cards.filter((c) => allowed.has(c.id)) };
    });
}

/** Настройка с изменённым предпочтением одного отдела (пустые записи не храним). */
export function withBoardPref(config: SummaryConfig, boardId: string, pref: SummaryBoardPref): SummaryConfig {
  const boards = { ...config.boards };
  const isEmpty = !pref.hidden && (!pref.cards || Object.keys(pref.cards).length === 0);
  if (isEmpty) delete boards[boardId];
  else boards[boardId] = pref;
  return { ...config, boards };
}

/** Переставить отдел в порядке сводного экрана. */
export function moveBoard(config: SummaryConfig, boardIds: string[], boardId: string, direction: -1 | 1): SummaryConfig {
  const order = config.order.length ? boardIds.slice().sort((a, b) => orderIndex(config, a) - orderIndex(config, b)) : boardIds.slice();
  const idx = order.indexOf(boardId);
  const target = idx + direction;
  if (idx === -1 || target < 0 || target >= order.length) return config;
  [order[idx], order[target]] = [order[target], order[idx]];
  return { ...config, order };
}

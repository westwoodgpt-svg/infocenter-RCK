import { AnyCard, DashboardState, TabId } from './types';
import { SEED_DATA } from './seedData';

const TABS: TabId[] = ['security', 'quality', 'production', 'costs', 'personnel'];

let counter = 0;
const copyId = () => {
  counter += 1;
  return `card-${Date.now()}-m${counter}`;
};

const same = (a: AnyCard, b: AnyCard) => JSON.stringify(a) === JSON.stringify(b);

/** Добавить карточки из другого инфоцентра, ничего не удаляя и не заменяя.
 *  Карточка с тем же id и тем же содержимым пропускается; с тем же id, но
 *  другим содержимым — добавляется копией с новым id: обе версии остаются. */
export function appendCards(target: DashboardState, extra: DashboardState): { state: DashboardState; added: number } {
  let added = 0;
  const state = { ...target };
  for (const tab of TABS) {
    const list = [...(target[tab] || [])];
    const byId = new Map(list.map((c) => [c.id, c]));
    for (const card of extra[tab] || []) {
      if (!card || !card.id) continue;
      const existing = byId.get(card.id);
      if (existing && same(existing, card)) continue;
      const next = existing ? ({ ...card, id: copyId() } as AnyCard) : card;
      list.push(next);
      byId.set(next.id, next);
      added += 1;
    }
    state[tab] = list;
  }
  return { state, added };
}

/** Карточки, которые сотрудник сам внёс в автономном режиме: автономный
 *  инфоцентр стартует со стартового набора РЦК (SEED_DATA), и его нетронутые
 *  карточки переносить в инфоцентр отдела незачем. */
export function ownCards(state: DashboardState): { state: DashboardState; count: number } {
  const seedById = new Map<string, AnyCard>();
  for (const tab of TABS) for (const c of SEED_DATA[tab]) seedById.set(c.id, c);
  let count = 0;
  const out = {} as DashboardState;
  for (const tab of TABS) {
    out[tab] = (state[tab] || []).filter((c) => {
      const seed = c && seedById.get(c.id);
      const keep = Boolean(c && c.id) && !(seed && same(seed, c));
      if (keep) count += 1;
      return keep;
    });
  }
  return { state: out, count };
}

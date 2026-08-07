import { DashboardState } from './types';

// Пустой дашборд на каждой из 5 вкладок — стартовая точка для РЦК: карточки
// собираются вручную через режим редактирования, готового примера (в отличие
// от ИИЦ) здесь нет, потому что раньше данные РЦК приходили из Списков Б24,
// а не из ручных карточек.

export const EMPTY_DASHBOARD: DashboardState = {
  security: [],
  quality: [],
  production: [],
  costs: [],
  personnel: [],
};

export const SEED_DATA: DashboardState = EMPTY_DASHBOARD;

import { DashboardConfig } from '../types';

// Конфигурация по умолчанию — воспроизводит сегодняшнее поведение (5 фиксированных
// вкладок, без пользовательских графиков). Используется, пока в app.option ещё
// ничего не сохранено, и как основа для сброса «к заводским настройкам».
export const DEFAULT_CONFIG: DashboardConfig = {
  version: 1,
  tabs: [
    { id: 'security', label: 'Безопасность', order: 0, visible: true, builtin: true },
    { id: 'quality', label: 'Качество', order: 1, visible: true, builtin: true },
    { id: 'production', label: 'Производство', order: 2, visible: true, builtin: true },
    { id: 'costs', label: 'Затраты', order: 3, visible: true, builtin: true },
    { id: 'personnel', label: 'Персонал', order: 4, visible: true, builtin: true },
  ],
  customCharts: [],
};

export const DASHBOARD_CONFIG_OPTION_KEY = 'rck_dashboard_config';

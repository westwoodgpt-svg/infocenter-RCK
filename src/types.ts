export interface FineItem {
  car: string;
  lastFine: string; // ISO date string or similar format "YYYY-MM-DD"
}

export interface EventItem {
  name: string;
  date: string; // "YYYY-MM-DD"
}

export interface NpsGroup {
  companies: string[];
  dates: string[];
  fact: number[];
  goal: number;
}

export interface NpsTreningiGroup {
  names: string[];
  fact: number[];
  goal: number;
}

export interface ProductionProgress {
  plan: number[];
  gotovitsya: (number | null)[];
  gotov: (number | null)[];
}

export interface ProductionProjects {
  plan: number[];
  otkryto: (number | null)[];
  zakryto: (number | null)[];
}

export interface ProductionEdu {
  plan: number[];
  fact: (number | null)[];
}

export interface ProductionSmi {
  weeks: string[];
  plan: number[];
  fact: (number | null)[];
}

export interface Smeta {
  total: number;
  contractedNotSpent: number;
  spent: number;
  notContracted: number;
}

export interface PersonnelRatio {
  plan: number;
  fact: number;
}

export interface RckDashboardData {
  updated: string;
  fines: FineItem[];
  certification: string;
  events: EventItem[];
  npsFabrika: NpsGroup;
  npsFabrikaOfis: NpsGroup;
  npsTreningi: NpsTreningiGroup;
  ibp: ProductionProgress;
  projects: ProductionProjects;
  edu: ProductionEdu;
  smi: ProductionSmi;
  smeta: Smeta;
  rck: PersonnelRatio;
  cuppp: PersonnelRatio;
}

export type BuiltinTabId = 'security' | 'quality' | 'production' | 'costs' | 'personnel';
// Свободный TabId — вкладки, добавленные через редактор, получают собственные строковые id
export type TabId = BuiltinTabId | (string & {});

/* ── Редактор: конфигурация вкладок и графиков ───────────────
   Хранится целиком в Bitrix24 (app.option), не в отдельной БД —
   см. DEPLOYMENT.md и разбор архитектуры. */

export interface TabConfig {
  id: TabId;
  label: string;
  order: number;
  visible: boolean;
  /** Встроенная вкладка (пять исходных) — нельзя удалить, только скрыть/переименовать/переместить. */
  builtin: boolean;
}

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'kpi' | 'table' | 'events' | 'person';

export interface ChartFilter {
  field: string;
  op: 'eq' | 'neq' | 'contains' | 'gte' | 'lte';
  value: string;
}

export interface ChartSeries {
  key: string;
  label: string;
  /** Логическое имя поля Списка ("NAME" либо "PROPERTY_123") */
  field: string;
  color?: string;
  /** Для type "bar": рисовать этот ряд линией поверх столбцов (совмещённая диаграмма) */
  asLine?: boolean;
}

export interface ChartDataSource {
  listId: number;
  listName?: string;
  /** Поле, используемое как подпись категории/оси X (обычно NAME или дата).
   *  Для type "events" — то же самое поле, что и подпись элемента. */
  nameField: string;
  /** Для type "events" используется только series[0].field — как поле с датой события. */
  series: ChartSeries[];
  filters?: ChartFilter[];
}

/** Карточка «Ответственный» — вводится вручную через автодополнение по
 *  сотрудникам портала (user.get), не привязана к Списку Б24. */
export interface PersonCardData {
  userId?: string;
  name: string;
  role: string;
  photoUrl?: string;
  tags: string[];
  note?: string;
}

export type StatusIndicatorColor = 'emerald' | 'amber' | 'rose' | 'sky';

export interface StatusIndicatorConfig {
  enabled: boolean;
  /** manual — цвет выбирается вручную; auto — зелёный/красный по сравнению первого ряда с целью (goal) */
  mode: 'manual' | 'auto';
  color: StatusIndicatorColor;
}

export interface ChartConfig {
  id: string;
  tabId: TabId;
  order: number;
  visible: boolean;
  title: string;
  subtitle?: string;
  type: ChartType;
  goal?: number;
  /** Обязательно для всех типов, кроме "person" */
  dataSource?: ChartDataSource;
  /** Только для type "person" */
  person?: PersonCardData;
  statusIndicator?: StatusIndicatorConfig;
}

export interface DashboardConfig {
  version: number;
  updatedAt?: string;
  updatedBy?: string;
  tabs: TabConfig[];
  customCharts: ChartConfig[];
}

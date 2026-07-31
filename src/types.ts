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

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'kpi' | 'table';

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
}

export interface ChartDataSource {
  listId: number;
  listName?: string;
  /** Поле, используемое как подпись категории/оси X (обычно NAME или дата) */
  nameField: string;
  series: ChartSeries[];
  filters?: ChartFilter[];
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
  dataSource: ChartDataSource;
}

export interface DashboardConfig {
  version: number;
  updatedAt?: string;
  updatedBy?: string;
  tabs: TabConfig[];
  customCharts: ChartConfig[];
}

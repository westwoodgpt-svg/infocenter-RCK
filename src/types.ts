export type TabId = 'security' | 'quality' | 'production' | 'costs' | 'personnel';

export type ChartType = 'bar' | 'line' | 'area' | 'pie';

export type CardType = 'kpi' | 'chart' | 'money' | 'list' | 'person' | 'event' | 'events';

export type IndicatorColor = 'emerald' | 'amber' | 'rose' | 'sky';

export interface CardIndicator {
  enabled: boolean;
  color: IndicatorColor;
}

interface BaseCard {
  id: string;
  type: CardType;
  title: string;
  subtitle?: string;
  /** Мигающий цветной индикатор («светофор») в углу карточки — необязателен, любой тип карточки. */
  indicator?: CardIndicator;
}

export interface KpiCard extends BaseCard {
  type: 'kpi';
  planValue: string;
  planDate?: string;
  factValue: string;
  factDate?: string;
  percent: number | null;
}

export interface ChartRow {
  category: string;
  values: number[];
}

export interface ChartCard extends BaseCard {
  type: 'chart';
  chartType: ChartType;
  seriesNames: string[];
  rows: ChartRow[];
  /** Только для chartType "bar": индекс ряда → рисовать линией поверх столбцов
   *  (совмещённая диаграмма, например «План» линией над «Факт» столбцами). Длина
   *  массива синхронизирована с seriesNames; отсутствующие элементы = false. */
  seriesAsLine?: boolean[];
  /** Индекс ряда → цвет (hex). Отсутствующие элементы = цвет по умолчанию из палитры. */
  seriesColors?: string[];
}

export interface MoneyCard extends BaseCard {
  type: 'money';
  plan: number;
  fact: number;
}

export interface ListCard extends BaseCard {
  type: 'list';
  items: string[];
}

export interface PersonCard extends BaseCard {
  type: 'person';
  role: string;
  tags: string[];
  note?: string;
  photoUrl?: string;
}

export interface EventCard extends BaseCard {
  type: 'event';
  date: string; // "YYYY-MM-DD"
}

export interface EventListItem {
  title: string;
  date: string; // "YYYY-MM-DD"
}

export interface EventsCard extends BaseCard {
  type: 'events';
  items: EventListItem[];
}

export type AnyCard = KpiCard | ChartCard | MoneyCard | ListCard | PersonCard | EventCard | EventsCard;

export type DashboardState = Record<TabId, AnyCard[]>;

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  kpi: 'KPI (план/факт/%)',
  chart: 'График',
  money: 'Смета (план/факт)',
  list: 'Список',
  person: 'Ответственный',
  event: 'Событие',
  events: 'Список событий (несколько в одной карточке)',
};

export const INDICATOR_COLOR_LABELS: Record<IndicatorColor, string> = {
  emerald: 'Зелёный',
  amber: 'Жёлтый',
  rose: 'Красный',
  sky: 'Синий',
};

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Столбчатый',
  line: 'Линейный',
  area: 'С областями',
  pie: 'Круговой',
};

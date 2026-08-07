export type TabId = 'security' | 'quality' | 'production' | 'costs' | 'personnel';

export type ChartType = 'bar' | 'line' | 'area' | 'pie';

export type CardType = 'kpi' | 'chart' | 'money' | 'list' | 'person';

interface BaseCard {
  id: string;
  type: CardType;
  title: string;
  subtitle?: string;
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

export type AnyCard = KpiCard | ChartCard | MoneyCard | ListCard | PersonCard;

export type DashboardState = Record<TabId, AnyCard[]>;

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  kpi: 'KPI (план/факт/%)',
  chart: 'График',
  money: 'Смета (план/факт)',
  list: 'Список',
  person: 'Ответственный',
};

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Столбчатый',
  line: 'Линейный',
  area: 'С областями',
  pie: 'Круговой',
};

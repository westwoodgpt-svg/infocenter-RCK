export type TabId = 'security' | 'quality' | 'production' | 'costs' | 'personnel';

export type ChartType = 'bar' | 'line' | 'area' | 'pie';

export type CardType = 'kpi' | 'chart' | 'money' | 'list' | 'person' | 'event' | 'events' | 'table' | 'image';

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
  /** Только для chartType "pie": цвет сектора этой категории (hex). Отсутствует = цвет по умолчанию из палитры. */
  color?: string;
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
  /** Только для chartType "bar" с рядом-линией (план): подсвечивать столбцы факта
   *  отдельным цветом, если их значение меньше значения плановой линии в той же категории. */
  highlightBelowPlan?: boolean;
  /** Цвет подсветки отставания от плана (hex). По умолчанию — красный. */
  belowPlanColor?: string;
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

export type EventCounterMode = 'countdown' | 'elapsed';

export interface EventCard extends BaseCard {
  type: 'event';
  date: string; // "YYYY-MM-DD"
  /** "countdown" (по умолчанию) — считает дни до/после даты события.
   *  "elapsed" — обратный счёт: сколько дней прошло от даты (например, «дней без штрафа»). */
  counterMode?: EventCounterMode;
}

export interface EventListItem {
  title: string;
  date: string; // "YYYY-MM-DD"
  /** Как считать дни по этому событию — так же, как в одиночной карточке «Событие»:
   *  "countdown" (по умолчанию) — сколько дней осталось до даты,
   *  "elapsed" — обратный счёт: сколько дней прошло от даты («дней без штрафа»). */
  counterMode?: EventCounterMode;
}

export interface EventsCard extends BaseCard {
  type: 'events';
  items: EventListItem[];
}

/** Заливка ячейки таблицы. "none" (или отсутствие значения) — без заливки. */
export type TableCellColor = 'none' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'slate';

export interface TableCard extends BaseCard {
  type: 'table';
  headers: string[];
  rows: string[][];
  /** Цвет ячеек тела таблицы, выровнен по rows: cellColors[строка][столбец].
   *  Отсутствующие элементы = без заливки. */
  cellColors?: TableCellColor[][];
  /** Цвет ячеек строки заголовков, выровнен по headers. */
  headerColors?: TableCellColor[];
}

export interface ImageCard extends BaseCard {
  type: 'image';
  imageUrl: string;
}

export type AnyCard =
  | KpiCard
  | ChartCard
  | MoneyCard
  | ListCard
  | PersonCard
  | EventCard
  | EventsCard
  | TableCard
  | ImageCard;

export type DashboardState = Record<TabId, AnyCard[]>;

/** Инфоцентр отдела (или исторический общий инфоцентр РЦК). */
export interface BoardInfo {
  id: string;
  title: string;
  departmentId?: string | null;
  canEdit: boolean;
}

export type UserRole = 'admin' | 'director' | 'head' | 'employee';

/** Настройка одного отдела на сводном экране. */
export interface SummaryBoardPref {
  /** Отдел скрыт со сводного экрана целиком. */
  hidden?: boolean;
  /** Явно выбранные карточки по вкладкам. Вкладки нет в объекте = берём все карточки вкладки. */
  cards?: Partial<Record<TabId, string[]>>;
}

/** Что и откуда тянуть на сводный экран. Настройка личная: каждый руководитель
 *  собирает свой сводный экран, не меняя его коллегам. */
export interface SummaryConfig {
  version: 1;
  /** Порядок отделов (id инфоцентров). Отделы вне списка показываются после него. */
  order: string[];
  boards: Record<string, SummaryBoardPref>;
}

export const EMPTY_SUMMARY_CONFIG: SummaryConfig = { version: 1, order: [], boards: {} };

/** Что сервер сообщает открывшему приложение: кто он и что ему доступно. */
export interface BootstrapInfo {
  me: { id: string; name: string; isAdmin: boolean };
  role: UserRole;
  boards: BoardInfo[];
  defaultBoardId: string | null;
  canSeeSummary: boolean;
  legacyBoardId: string;
  warning: string | null;
}

/** Один отдел на сводном экране. */
export interface SummarySection {
  boardId: string;
  title: string;
  canEdit: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  cards: AnyCard[];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор портала',
  director: 'Директор',
  head: 'Руководитель',
  employee: 'Сотрудник',
};

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  kpi: 'KPI (план/факт/%)',
  chart: 'График',
  money: 'Смета (план/факт)',
  list: 'Список',
  person: 'Ответственный',
  event: 'Событие',
  events: 'Список событий (несколько в одной карточке)',
  table: 'Таблица (xlsx/csv)',
  image: 'Изображение',
};

export const TABLE_CELL_COLOR_LABELS: Record<TableCellColor, string> = {
  none: 'Без заливки',
  emerald: 'Зелёная',
  amber: 'Жёлтая',
  rose: 'Красная',
  sky: 'Синяя',
  violet: 'Фиолетовая',
  slate: 'Серая',
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

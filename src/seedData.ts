import { AnyCard, DashboardState } from './types';

// Восстановленные данные РЦК, которые раньше приходили из Списков Битрикс24
// (src/data.ts, коммит 4aa4997, до перехода на редактор карточек). Значения
// актуальны на 09.07.2026 — источник больше не подключён, дальше эти
// карточки редактируются вручную через «Режим редактирования», как и любые
// новые.
//
// Каждая карточка ниже описана ровно в той форме, в которой её сохранил бы
// CardEditorModal (см. src/types.ts) — так что открыть и поправить любую из
// них через редактор можно без сюрпризов.

let n = 0;
const id = (tab: string) => `seed-${tab}-${++n}`;

export const EMPTY_DASHBOARD: DashboardState = {
  security: [],
  quality: [],
  production: [],
  costs: [],
  personnel: [],
};

const security: AnyCard[] = [
  {
    id: id('security'),
    type: 'list',
    title: 'Штрафы автомобилей',
    subtitle: 'Дата последнего зафиксированного нарушения',
    items: [
      'Авто 544 — последний штраф 13.11.2025',
      'Авто 564 — последний штраф 01.02.2026',
      'Авто 538 — последний штраф 09.09.2025',
      'Авто 326 — последний штраф 29.03.2025',
    ],
  },
  {
    id: id('security'),
    type: 'kpi',
    title: 'Сертификация РЦК',
    subtitle: 'Плановая дата сертификации',
    planValue: '10.09.2026',
    factValue: 'Ожидается',
    percent: null,
  },
  {
    id: id('security'),
    type: 'list',
    title: 'План ключевых мероприятий 2026',
    subtitle: 'Контрольные точки и сертификации',
    items: [
      'Рейтинг РЦК 1/2 года — 30.06.2026',
      'Медицинская комиссия — 30.07.2026',
      'Сертификация РЦК — 10.09.2026',
      'Закрытие 6 волны — 30.09.2026',
      'Закрытие 7 волны — 15.11.2026',
      'ППКО — 15.12.2026',
    ],
  },
];

const quality: AnyCard[] = [
  {
    id: id('quality'),
    type: 'chart',
    title: 'NPS Фабрика процессов',
    subtitle: 'Оценка удовлетворённости по компаниям',
    chartType: 'bar',
    seriesNames: ['Факт', 'Цель'],
    rows: [
      { category: 'ООО «Бауцентр Рус» (06.03.2026)', values: [100, 80] },
      { category: 'АО «Калининградгазификация» (09.04.2026)', values: [83, 80] },
    ],
  },
  {
    id: id('quality'),
    type: 'chart',
    title: 'NPS Фабрика офиса',
    subtitle: 'Оценка удовлетворённости по сессиям',
    chartType: 'bar',
    seriesNames: ['Факт', 'Цель'],
    rows: [
      { category: 'Сессия 1 (25.03.2026)', values: [100, 80] },
      { category: 'Сессия 2 (13.05.2026)', values: [83, 80] },
    ],
  },
  {
    id: id('quality'),
    type: 'chart',
    title: 'NPS Тренинги',
    subtitle: 'Оценка удовлетворённости по инструментам бережливого производства',
    chartType: 'bar',
    seriesNames: ['Факт', 'Цель'],
    rows: [
      { category: 'ОБП', values: [100, 80] },
      { category: 'Картирование', values: [83, 80] },
      { category: 'РПУ', values: [83, 80] },
      { category: '5С', values: [83, 80] },
      { category: 'ПА', values: [83, 80] },
      { category: 'СР', values: [83, 80] },
      { category: 'СМЕД', values: [83, 80] },
      { category: 'ОЕЕ', values: [83, 80] },
      { category: 'МРП', values: [83, 80] },
    ],
  },
];

const production: AnyCard[] = [
  {
    id: id('production'),
    type: 'chart',
    title: 'Подготовка инструкторов ИБП',
    subtitle: 'Обучение по бережливому производству нарастающим итогом',
    chartType: 'bar',
    seriesNames: ['План', 'Готовится', 'Готов ИБП'],
    rows: [
      { category: 'I кв', values: [4, 5, 0] },
      { category: 'II кв', values: [14, 4, 5] },
      { category: 'III кв', values: [20, 0, 0] },
      { category: 'IV кв', values: [24, 0, 0] },
    ],
  },
  {
    id: id('production'),
    type: 'chart',
    title: 'Проекты в работе',
    subtitle: 'Осуществление проектов улучшений нарастающим итогом',
    chartType: 'bar',
    seriesNames: ['План', 'Открыто', 'Закрыто'],
    rows: [
      { category: 'I кв', values: [4, 4, 0] },
      { category: 'II кв', values: [10, 5, 2] },
      { category: 'III кв', values: [12, 0, 0] },
      { category: 'IV кв', values: [14, 0, 0] },
    ],
  },
  {
    id: id('production'),
    type: 'chart',
    title: 'Обучение сотрудников предприятий',
    subtitle: 'Обучение инструментам бережливого производства (нарастающим итогом, чел.)',
    chartType: 'bar',
    seriesNames: ['План', 'Факт'],
    rows: [
      { category: 'I кв', values: [56, 44] },
      { category: 'II кв', values: [98, 70] },
      { category: 'III кв', values: [140, 0] },
      { category: 'IV кв', values: [168, 0] },
    ],
  },
  {
    id: id('production'),
    type: 'chart',
    title: 'Инфоповоды в СМИ за период',
    subtitle: 'Публикации и медиа-активность РЦК по неделям текущего месяца',
    chartType: 'bar',
    seriesNames: ['План', 'Факт'],
    rows: [
      { category: 'с 04 по 08', values: [0, 0] },
      { category: 'с 12 по 15', values: [1, 0] },
      { category: 'с 18 по 22', values: [2, 1] },
      { category: 'с 25 по 29', values: [4, 0] },
    ],
  },
];

const costs: AnyCard[] = [
  {
    id: id('costs'),
    type: 'money',
    title: 'Смета РЦК',
    subtitle: 'Освоение сметы нарастающим итогом',
    plan: 1_000_000_000,
    fact: 200_000_000,
  },
  {
    id: id('costs'),
    type: 'chart',
    title: 'Структура сметы',
    subtitle: 'Распределение по статусу освоения, млн руб.',
    chartType: 'pie',
    seriesNames: ['Млн руб.'],
    rows: [
      { category: 'Потрачено', values: [200] },
      { category: 'Законтрактовано и не потрачено', values: [500] },
      { category: 'Не законтрактовано и не потрачено', values: [300] },
    ],
  },
];

const personnel: AnyCard[] = [
  {
    id: id('personnel'),
    type: 'kpi',
    title: 'Сотрудники РЦК',
    subtitle: 'Региональный центр компетенций — штат',
    planValue: '6',
    factValue: '6',
    percent: 100,
  },
  {
    id: id('personnel'),
    type: 'kpi',
    title: 'Сотрудники ЦУППП',
    subtitle: 'Центр управления процессами — штат',
    planValue: '4',
    factValue: '1',
    percent: 25,
  },
];

export const SEED_DATA: DashboardState = { security, quality, production, costs, personnel };

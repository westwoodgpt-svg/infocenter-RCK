import { B24ListDescriptor } from '../b24/client';

// Списки Б24, на которых сегодня держится дашборд (ID 78–88).
// Вынесено из App.tsx, чтобы этот же справочник мог использовать
// и редактор (например, как готовые пресеты источника данных).
export const BUILTIN_LISTS: Record<string, B24ListDescriptor> = {
  fines:          { id: 78, props: { car: 'PROPERTY_494', date: 'PROPERTY_495' } },
  npsFabrika:     { id: 79, props: { company: 'PROPERTY_496', date: 'PROPERTY_497', fact: 'PROPERTY_498' } },
  npsFabrikaOfis: { id: 80, props: { company: 'PROPERTY_499', date: 'PROPERTY_500', fact: 'PROPERTY_501' } },
  npsTreningi:    { id: 81, props: { name: 'PROPERTY_502', fact: 'PROPERTY_503' } },
  ibp:            { id: 82, props: { quarter: 'PROPERTY_504', plan: 'PROPERTY_505', prep: 'PROPERTY_506', ready: 'PROPERTY_507' } },
  projects:       { id: 83, props: { quarter: 'PROPERTY_508', plan: 'PROPERTY_509', open: 'PROPERTY_510', closed: 'PROPERTY_511' } },
  edu:            { id: 84, props: { quarter: 'PROPERTY_512', plan: 'PROPERTY_513', fact: 'PROPERTY_514' } },
  smi:            { id: 85, props: { week: 'PROPERTY_515', plan: 'PROPERTY_516', fact: 'PROPERTY_517' } },
  smeta:          { id: 86, props: { item: 'PROPERTY_518', amount: 'PROPERTY_519' } },
  personnel:      { id: 87, props: { dept: 'PROPERTY_520', plan: 'PROPERTY_521', fact: 'PROPERTY_522' } },
  events:         { id: 88, props: { date: 'PROPERTY_523' } },
};

// Человекочитаемые названия Списков — баннер ошибок в App.tsx, подписи в редакторе.
export const BUILTIN_LIST_LABELS: Record<string, string> = {
  fines: 'Штрафы',
  npsFabrika: 'NPS — Фабрика процессов',
  npsFabrikaOfis: 'NPS — Фабрика офисных процессов',
  npsTreningi: 'NPS — Тренинги',
  ibp: 'Производство — ИБП',
  projects: 'Производство — Проекты',
  edu: 'Производство — Обучение',
  smi: 'Производство — СМИ',
  smeta: 'Затраты — Смета',
  personnel: 'Персонал',
  events: 'Ключевые события',
};

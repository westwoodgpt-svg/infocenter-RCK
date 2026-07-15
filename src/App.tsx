import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Award, 
  Settings, 
  Clock, 
  CheckCircle2, 
  RefreshCw, 
  TrendingUp, 
  PiggyBank, 
  Users2,
  AlertTriangle,
  Info
} from 'lucide-react';

import { RckDashboardData, TabId } from './types';
import { RCK_DATA } from './data';

// Subcomponents
import SecurityPanel from './components/SecurityPanel';
import QualityPanel from './components/QualityPanel';
import ProductionPanel from './components/ProductionPanel';
import CostsPanel from './components/CostsPanel';
import PersonnelPanel from './components/PersonnelPanel';

const LISTS = {
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
  events:         { id: 88, props: { date: 'PROPERTY_523' } }
};

// Человекочитаемые названия Списков — используются в баннере ошибок
const LIST_LABELS: Record<string, string> = {
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

export default function App() {
  const [data, setData] = useState<RckDashboardData>(RCK_DATA);
  const [activeTab, setActiveTab] = useState<TabId>('security');
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const [b24Detected, setB24Detected] = useState(false);

  // Момент последней успешной синхронизации хотя бы одного Списка (реальные данные из Б24)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Страховка: если TIMESTAMP_X не удалось получить/распарсить ни у одного Списка
  // (бывает на некоторых версиях коробки), показываем хотя бы время последней
  // успешной загрузки в браузере, а не бесконечную надпись "загрузка…".
  const [clientFetchedAt, setClientFetchedAt] = useState<Date | null>(null);

  // Список ключей Списков, которые не удалось загрузить в последний раз (для баннера ошибок)
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});

  // Formatting date for subtitle
  const formattedToday = useMemo(() => {
    return new Date().toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  // Utility to clean prop values from B24
  const extractPropValue = (v: any): string => {
    if (v === null || v === undefined) return '';
    
    // If it's an array
    if (Array.isArray(v)) {
      if (v.length === 0) return '';
      return extractPropValue(v[0]);
    }
    
    // If it's an object
    if (typeof v === 'object') {
      if ('VALUE' in v) return extractPropValue(v.VALUE);
      if ('TEXT' in v) return extractPropValue(v.TEXT);
      
      const keys = Object.keys(v);
      if (keys.length === 0) return '';
      return extractPropValue(v[keys[0]]);
    }
    
    return String(v).trim();
  };

  // Safe converter for numeric fields
  const toNum = (v: any, fallback = 0): number => {
    if (v === '' || v === null || v === undefined) return fallback;
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  };

  // Safe converter for nullable fields in cumulative charts
  const toNullableNum = (v: any): number | null => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  };

  // Парсинг TIMESTAMP_X — REST API Битрикс24 обычно отдаёт ISO 8601
  // ("2026-07-15T15:03:00+03:00"), но коробочные версии иногда возвращают
  // классический админский формат "DD.MM.YYYY HH:mm:ss" — пробуем оба варианта.
  const parseB24Timestamp = (v: any): Date | null => {
    const raw = extractPropValue(v);
    if (!raw) return null;

    const iso = new Date(raw);
    if (!isNaN(iso.getTime())) return iso;

    const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = m;
    const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
    return isNaN(dt.getTime()) ? null : dt;
  };

  // Приводим дату из Списка ("DD.MM.YYYY" или уже "YYYY-MM-DD") к единому формату
  // "YYYY-MM-DD", который одинаково понимают все места App.tsx/SecurityPanel.tsx,
  // включая необработанный new Date(...) для карточки "Запланировано на".
  const normalizeToIsoDate = (raw: string): string => {
    const trimmed = raw.trim();
    const ru = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (ru) {
      const [, dd, mm, yyyy] = ru;
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];
    return trimmed;
  };

  // B24 lists rows fetcher
  const loadListRows = (
    listKey: string,
    listCfg: any,
    onLoaded: (rows: any[]) => void
  ) => {
    const propKeys = Object.keys(listCfg.props).map((k) => (listCfg.props as any)[k]);
    const BX24 = (window as any).BX24;

    if (typeof BX24 === 'undefined') return;

    BX24.callMethod(
      'lists.element.get',
      {
        IBLOCK_TYPE_ID: 'lists',
        IBLOCK_ID: listCfg.id,
        SELECT: ['ID', 'NAME', 'TIMESTAMP_X', ...propKeys]
      },
      (result: any) => {
        if (result.error()) {
          const err = result.error();
          const message = (err && (err.ex?.error_description || err.error_description)) || 'неизвестная ошибка';
          console.warn(`Список ID ${listCfg.id} (${listKey}) недоступен, показываю данные по умолчанию:`, err);
          setLoadErrors(prev => ({ ...prev, [listKey]: message }));
          return;
        }

        // Список отдал ответ успешно — снимаем возможную прежнюю пометку об ошибке
        setLoadErrors(prev => {
          if (!(listKey in prev)) return prev;
          const next = { ...prev };
          delete next[listKey];
          return next;
        });

        const rows = result.answer.result || [];

        // Отмечаем самое позднее реальное время изменения строки среди всех Списков
        let latestInList: Date | null = null;
        rows.forEach((row: any) => {
          const ts = parseB24Timestamp(row.TIMESTAMP_X);
          if (ts && (!latestInList || ts > latestInList)) latestInList = ts;
        });
        if (latestInList) {
          setLastSyncedAt(prev => (!prev || (latestInList as Date) > prev ? (latestInList as Date) : prev));
        }

        const mapped = rows.map((row: any) => {
          const o: any = {};
          
          // 1. First, extract standard values from configured keys
          Object.keys(listCfg.props).forEach((logical) => {
            const rawPropValue = row[(listCfg.props as any)[logical]];
            o[logical] = extractPropValue(rawPropValue);
          });
          o.NAME = extractPropValue(row.NAME);

          // 2. Perform advanced self-healing auto-detection for empty properties
          Object.keys(listCfg.props).forEach((logical) => {
            const configPropKey = (listCfg.props as any)[logical];
            const rawValue = row[configPropKey];
            
            // Check if the configured property is missing or genuinely blank
            const isConfiguredEmpty = rawValue === undefined || rawValue === null || 
              (Array.isArray(rawValue) && rawValue.length === 0) ||
              (typeof rawValue === 'object' && Object.keys(rawValue).length === 0) ||
              extractPropValue(rawValue).trim() === '';

            if (isConfiguredEmpty) {
              // Try to find a property of the correct type from the other properties in row
              if (logical === 'date') {
                for (const key of Object.keys(row)) {
                  if (key.startsWith('PROPERTY_') && key !== configPropKey) {
                    const val = extractPropValue(row[key]);
                    if (val && (val.includes('.') || val.includes('-')) && val.length >= 8 && val.length <= 25) {
                      o[logical] = val;
                      break;
                    }
                  }
                }
              } else if (logical === 'fact' || logical === 'plan' || logical === 'prep' || logical === 'ready' || logical === 'amount' || logical === 'otkryto' || logical === 'zakryto') {
                for (const key of Object.keys(row)) {
                  if (key.startsWith('PROPERTY_') && key !== configPropKey) {
                    const val = extractPropValue(row[key]);
                    if (val !== '') {
                      const n = Number(val);
                      if (!isNaN(n) && n >= 0 && n <= 1000000) {
                        o[logical] = val;
                        break;
                      }
                    }
                  }
                }
              } else if (logical === 'company' || logical === 'name' || logical === 'car' || logical === 'item' || logical === 'dept') {
                for (const key of Object.keys(row)) {
                  if (key.startsWith('PROPERTY_') && key !== configPropKey) {
                    const val = extractPropValue(row[key]);
                    if (val && isNaN(Number(val)) && !val.includes('.') && !val.includes('-') && val.length > 1) {
                      o[logical] = val;
                      break;
                    }
                  }
                }
                // Fallback to standard NAME if still empty
                if (!o[logical]) {
                  o[logical] = o.NAME;
                }
              }
            }
          });

          return o;
        });

        if (mapped.length) {
          onLoaded(mapped);
        }
      }
    );
  };

  // Загрузка (и повторная загрузка по кнопке "Обновить") всех Списков Б24
  const loadAllData = useCallback(() => {
    const BX24 = (window as any).BX24;
    if (typeof BX24 === 'undefined') return;

    setB24Detected(true);
    setIsLiveLoading(true);

    // Load Fines (78)
    loadListRows('fines', LISTS.fines, (rows) => {
      setData(prev => ({
        ...prev,
        fines: rows.map(r => ({ car: String(r.car), lastFine: String(r.date) }))
      }));
    });

    // Load NPS Fabrika (79)
    loadListRows('npsFabrika', LISTS.npsFabrika, (rows) => {
      const validRows = rows.map(r => {
        const companyVal = String(r.company || r.NAME || '').trim();
        const dateVal = String(r.date || '');
        const factVal = toNum(r.fact, 0);
        return { company: companyVal, date: dateVal, fact: factVal };
      }).filter(item => item.company !== '');

      if (validRows.length) {
        setData(prev => ({
          ...prev,
          npsFabrika: {
            ...prev.npsFabrika,
            companies: validRows.map(r => r.company),
            dates: validRows.map(r => r.date),
            fact: validRows.map(r => r.fact)
          }
        }));
      }
    });

    // Load NPS Fabrika Ofis (80)
    loadListRows('npsFabrikaOfis', LISTS.npsFabrikaOfis, (rows) => {
      const validRows = rows.map(r => {
        const companyVal = String(r.company || r.NAME || '').trim();
        const dateVal = String(r.date || '');
        const factVal = toNum(r.fact, 0);
        return { company: companyVal, date: dateVal, fact: factVal };
      }).filter(item => item.company !== '');

      if (validRows.length) {
        setData(prev => ({
          ...prev,
          npsFabrikaOfis: {
            ...prev.npsFabrikaOfis,
            companies: validRows.map(r => r.company),
            dates: validRows.map(r => r.date),
            fact: validRows.map(r => r.fact)
          }
        }));
      }
    });

    // Load NPS Treningi (81)
    loadListRows('npsTreningi', LISTS.npsTreningi, (rows) => {
      const validRows = rows.map(r => {
        const nameVal = String(r.name || r.NAME || '').trim();
        const factVal = toNum(r.fact, 0);
        return { name: nameVal, fact: factVal };
      }).filter(item => item.name !== '');

      if (validRows.length) {
        setData(prev => ({
          ...prev,
          npsTreningi: {
            ...prev.npsTreningi,
            names: validRows.map(r => r.name),
            fact: validRows.map(r => r.fact)
          }
        }));
      }
    });

    // Load IBP progress (82)
    loadListRows('ibp', LISTS.ibp, (rows) => {
      setData(prev => ({
        ...prev,
        ibp: {
          plan: rows.map(r => toNum(r.plan, 0)),
          gotovitsya: rows.map(r => toNullableNum(r.prep)),
          gotov: rows.map(r => toNullableNum(r.ready))
        }
      }));
    });

    // Load Projects (83)
    loadListRows('projects', LISTS.projects, (rows) => {
      setData(prev => ({
        ...prev,
        projects: {
          plan: rows.map(r => toNum(r.plan, 0)),
          otkryto: rows.map(r => toNullableNum(r.open)),
          zakryto: rows.map(r => toNullableNum(r.closed))
        }
      }));
    });

    // Load Education (84)
    loadListRows('edu', LISTS.edu, (rows) => {
      setData(prev => ({
        ...prev,
        edu: {
          plan: rows.map(r => toNum(r.plan, 0)),
          fact: rows.map(r => toNullableNum(r.fact))
        }
      }));
    });

    // Load SMI mentions (85)
    loadListRows('smi', LISTS.smi, (rows) => {
      setData(prev => ({
        ...prev,
        smi: {
          weeks: rows.map(r => String(r.week)),
          plan: rows.map(r => toNum(r.plan, 0)),
          fact: rows.map(r => toNullableNum(r.fact))
        }
      }));
    });

    // Load Smeta / Costs (86)
    loadListRows('smeta', LISTS.smeta, (rows) => {
      setData(prev => {
        let spent = prev.smeta.spent;
        let contractedNotSpent = prev.smeta.contractedNotSpent;
        let notContracted = prev.smeta.notContracted;

        rows.forEach(r => {
          const item = String(r.item).toLowerCase();
          const amount = toNum(r.amount, 0);
          if (item.includes('потрачено') || item.includes('освоено')) {
            spent = amount;
          } else if (item.includes('законтрактовано')) {
            contractedNotSpent = amount;
          } else if (item.includes('не законтрактовано')) {
            notContracted = amount;
          }
        });

        return {
          ...prev,
          smeta: {
            total: spent + contractedNotSpent + notContracted,
            spent,
            contractedNotSpent,
            notContracted
          }
        };
      });
    });

    // Load Personnel (87)
    // Строки сопоставляются по названию отдела (dept), а не по порядку в Списке —
    // так перестановка или добавление строки в Битриксе не перепутает РЦК и ЦУППП.
    loadListRows('personnel', LISTS.personnel, (rows) => {
      const findByDept = (needle: string) =>
        rows.find(r => String(r.dept || r.NAME || '').toLowerCase().includes(needle));

      const rckRow = findByDept('рцк') || rows[0] || { plan: 6, fact: 6 };
      const cupppRow = findByDept('цуппп') || rows[1] || { plan: 4, fact: 1 };

      setData(prev => ({
        ...prev,
        rck: { plan: toNum(rckRow.plan, 6), fact: toNum(rckRow.fact, 6) },
        cuppp: { plan: toNum(cupppRow.plan, 4), fact: toNum(cupppRow.fact, 1) }
      }));
    });

    // Load Key Events / Certification date (88)
    // Сортируем по дате и берём как "Сертификация" строку, где в названии
    // встречается "сертификац" — так карточка "Дней до сертификации" не требует
    // отдельного поля в Списке.
    loadListRows('events', LISTS.events, (rows) => {
      const validRows = rows
        .map(r => ({
          name: String(r.NAME || '').trim(),
          date: normalizeToIsoDate(String(r.date || '')),
        }))
        .filter(item => item.name !== '' && item.date !== '');

      if (validRows.length) {
        validRows.sort((a, b) => a.date.localeCompare(b.date));
        const certEvent = validRows.find(e => e.name.toLowerCase().includes('сертификац'));

        setData(prev => ({
          ...prev,
          events: validRows,
          certification: certEvent ? certEvent.date : prev.certification,
        }));
      }
    });

    // Complete live load flag
    setTimeout(() => {
      setIsLiveLoading(false);
      setClientFetchedAt(new Date());
    }, 800);
  }, []);

  // Load B24 live data if window.BX24 is present
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const tabs = [
    { id: 'security', label: 'Безопасность', color: 'bg-red-500', shadowColor: 'rgba(239, 68, 68, 0.15)', hoverBg: 'hover:bg-red-500/5', activeText: 'text-red-400 bg-red-500/10 border-red-500/20', icon: ShieldCheck },
    { id: 'quality', label: 'Качество', color: 'bg-blue-500', shadowColor: 'rgba(59, 130, 246, 0.15)', hoverBg: 'hover:bg-blue-500/5', activeText: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: Award },
    { id: 'production', label: 'Производство', color: 'bg-amber-500', shadowColor: 'rgba(245, 158, 11, 0.15)', hoverBg: 'hover:bg-amber-500/5', activeText: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: TrendingUp },
    { id: 'costs', label: 'Затраты', color: 'bg-emerald-500', shadowColor: 'rgba(16, 185, 129, 0.15)', hoverBg: 'hover:bg-emerald-500/5', activeText: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: PiggyBank },
    { id: 'personnel', label: 'Персонал', color: 'bg-indigo-500', shadowColor: 'rgba(99, 102, 241, 0.15)', hoverBg: 'hover:bg-indigo-500/5', activeText: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', icon: Users2 },
  ] as const;

  const errorCount = Object.keys(loadErrors).length;

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] py-8 px-4 md:px-8 font-sans antialiased">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Modern Header Banner */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="elegant-card rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="h-4 w-1 bg-indigo-500 rounded-full shadow-[0_0_8px_#6366f1]" />
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 font-display">ЦПП Калининградской области</p>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-display flex flex-wrap items-center gap-x-3 gap-y-1.5">
              Инфоцентр
              <span className="font-mono font-black tracking-tighter flex items-center text-lg md:text-2xl select-none px-2.5 py-0.5 bg-zinc-900 rounded-xl border border-[#27272a] shadow-[0_0_15px_rgba(14,165,233,0.05)]">
                <span className="text-sky-400">&lt;</span>
                <span className="text-white">|</span>
                <span className="text-sky-400">&gt;</span>
                <span className="text-white ml-1">ЦК</span>
                <span className="text-[#f43f5e] ml-1">&gt;</span>
              </span>
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#a1a1aa] pt-1.5">
              <span className="flex items-center gap-1.5 bg-[#161619] px-3 py-1 rounded-full border border-[#27272a]">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  Данные обновлены:{' '}
                  <strong className="text-white">
                    {b24Detected
                      ? (lastSyncedAt
                          ? lastSyncedAt.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : clientFetchedAt
                            ? `${clientFetchedAt.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} (время загрузки)`
                            : 'загрузка…')
                      : new Date(data.updated).toLocaleDateString('ru-RU')}
                  </strong>
                </span>
              </span>
              <span className="flex items-center gap-1.5 bg-[#161619] px-3 py-1 rounded-full border border-[#27272a]">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Сегодня: <span className="text-white">{formattedToday}</span></span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {b24Detected ? (
              <>
                <button
                  type="button"
                  onClick={loadAllData}
                  disabled={isLiveLoading}
                  title="Перезагрузить данные из Списков Битрикс24"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 text-xs font-medium rounded-full border border-zinc-700/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLiveLoading ? 'animate-spin' : ''}`} />
                  Обновить
                </button>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 text-sky-400 text-xs font-semibold rounded-full border border-sky-500/25 shadow-[0_0_10px_rgba(14,165,233,0.1)]">
                  <RefreshCw className={`w-3.5 h-3.5 ${isLiveLoading ? 'animate-spin' : ''}`} />
                  Интеграция со Списками B24 Активна
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800/60 text-zinc-400 text-xs font-medium rounded-full border border-zinc-700/60">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_6px_#6366f1]" />
                Автономный режим (Файл данных)
              </span>
            )}
          </div>
        </motion.header>

        {/* Error banner: показывает, какие Списки не удалось загрузить */}
        {errorCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="elegant-card rounded-2xl p-4 border border-amber-500/30 bg-amber-500/5 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <p className="font-semibold text-amber-300">
                Не удалось обновить {errorCount === 1 ? 'раздел' : 'разделы'} из Списков Битрикс24 — показаны прежние данные:
              </p>
              <p className="mt-1">
                {Object.entries(loadErrors).map(([key, message], idx) => (
                  <span key={key}>
                    {idx > 0 && ', '}
                    <strong>{LIST_LABELS[key] || key}</strong> ({message})
                  </span>
                ))}
              </p>
              <p className="mt-1 text-amber-200/70">
                Проверьте, что у приложения есть доступ к этим Спискам, и что их ID/структура не менялись.
              </p>
            </div>
          </motion.div>
        )}

        {/* Tab Navigation Menu */}
        <motion.nav 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="elegant-card rounded-3xl p-2"
        >
          <div className="flex flex-wrap md:flex-nowrap gap-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex-1 min-w-[120px] md:min-w-0 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 border border-transparent font-display ${
                    isActive 
                      ? `${tab.activeText}`
                      : `text-[#a1a1aa] hover:text-white ${tab.hoverBg}`
                  }`}
                  style={isActive ? { boxShadow: `0 0 15px ${tab.shadowColor}` } : {}}
                >
                  <Icon className={`w-4 h-4 transition-all duration-300 ${isActive ? 'scale-110 opacity-100' : 'opacity-60'}`} />
                  <span>{tab.label}</span>
                  
                  {isActive && (
                    <motion.div 
                      layoutId="activeTabIndicator"
                      className={`absolute bottom-0 left-4 right-4 h-0.5 ${tab.color} rounded-full`}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.nav>

        {/* Render Panel Content with beautiful transition animation */}
        <main className="min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === 'security' && (
                <SecurityPanel 
                  fines={data.fines} 
                  certificationDate={data.certification} 
                  events={data.events} 
                />
              )}
              {activeTab === 'quality' && (
                <QualityPanel 
                  npsFabrika={data.npsFabrika} 
                  npsFabrikaOfis={data.npsFabrikaOfis} 
                  npsTreningi={data.npsTreningi} 
                />
              )}
              {activeTab === 'production' && (
                <ProductionPanel 
                  ibp={data.ibp} 
                  projects={data.projects} 
                  edu={data.edu} 
                  smi={data.smi} 
                />
              )}
              {activeTab === 'costs' && (
                <CostsPanel 
                  smeta={data.smeta} 
                />
              )}
              {activeTab === 'personnel' && (
                <PersonnelPanel 
                  rck={data.rck} 
                  cuppp={data.cuppp} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Informative Footer explaining administration instructions */}
        <motion.footer 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="elegant-card rounded-3xl p-6 flex items-start gap-4"
        >
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl flex-shrink-0 border border-indigo-500/20">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 text-xs text-[#a1a1aa] leading-relaxed">
            <h4 className="font-bold text-white">Как обновлять и синхронизировать показатели:</h4>
            <p>
              Большинство аналитических показателей настраиваются в разделе <strong className="text-zinc-200">«Списки» Битрикс24</strong> (Штрафы по автопарку, показатели NPS, производственные планы по кварталам, статьи затрат по смете и штатное расписание). Изменения автоматически подтягиваются при открытии приложения — или сразу, если нажать «Обновить».
            </p>
            <p className="pt-1">
              Даты плановой сертификации и ключевых событий года, а также другие статические константы прописаны в структуру <code className="bg-[#1c1c1f] px-1.5 py-0.5 rounded text-indigo-400 border border-[#2d2d34] font-mono">/src/data.ts</code>. Счётчики безаварийных дней и дни до сертификации рассчитываются в реальном времени.
            </p>
          </div>
        </motion.footer>

      </div>
    </div>
  );
}

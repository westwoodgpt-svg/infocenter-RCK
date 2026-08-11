import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, LayoutGrid, UserRound, Layers, CalendarClock, CheckCircle2, Flame } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { ChartConfig, ChartFilter, StatusIndicatorColor } from '../types';
import { getListElements, isB24Available } from '../b24/client';
import { extractPropValue, toNum } from '../b24/normalize';

const PALETTE = ['#6366f1', '#10b981', '#0ea5e9', '#f59e0b', '#f43f5e', '#a855f7'];

const INDICATOR_DOT: Record<StatusIndicatorColor, string> = {
  emerald: 'bg-emerald-500 shadow-[0_0_6px_#10b981]',
  amber: 'bg-amber-500 shadow-[0_0_6px_#f59e0b]',
  rose: 'bg-rose-500 shadow-[0_0_6px_#f43f5e]',
  sky: 'bg-sky-500 shadow-[0_0_6px_#0ea5e9]',
};

interface ChartCardProps {
  config: ChartConfig;
  key?: string;
}

function applyFilter(row: Record<string, any>, filter: ChartFilter): boolean {
  const val = row[filter.field];
  const target = filter.value;
  switch (filter.op) {
    case 'eq': return String(val ?? '') === target;
    case 'neq': return String(val ?? '') !== target;
    case 'contains': return String(val ?? '').toLowerCase().includes(String(target).toLowerCase());
    case 'gte': return Number(val) >= Number(target);
    case 'lte': return Number(val) <= Number(target);
    default: return true;
  }
}

function parseAnyDate(raw: string): Date | null {
  const s = (raw || '').trim();
  if (!s) return null;
  const ru = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (ru) return new Date(Number(ru[3]), Number(ru[2]) - 1, Number(ru[1]));
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export default function ChartCard({ config }: ChartCardProps) {
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(config.type !== 'person');
  const [error, setError] = useState<string | null>(null);

  const dataSource = config.dataSource;

  useEffect(() => {
    if (config.type === 'person' || !dataSource) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      if (!isB24Available() || !dataSource) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const fields = [dataSource.nameField, ...dataSource.series.map((s) => s.field)];
        const elements = await getListElements(dataSource.listId, fields);
        let mapped = elements.map((el) => {
          const row: Record<string, any> = {
            name: extractPropValue(el.values[dataSource.nameField] ?? el.name),
          };
          dataSource.series.forEach((s, i) => {
            if (config.type === 'events' && i === 0) {
              row[s.key] = extractPropValue(el.values[s.field]);
            } else {
              row[s.key] = toNum(el.values[s.field]);
            }
          });
          return row;
        });
        (dataSource.filters || []).forEach((f) => {
          mapped = mapped.filter((r) => applyFilter(r, f));
        });
        if (!cancelled) setRows(mapped);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить данные Списка');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [config]);

  const series = dataSource?.series ?? [];

  const kpiValue = useMemo(() => {
    if (!series[0]) return 0;
    return rows.reduce((sum, r) => sum + (Number(r[series[0].key]) || 0), 0);
  }, [rows, series]);

  const indicatorColor = useMemo((): StatusIndicatorColor | null => {
    const ind = config.statusIndicator;
    if (!ind || !ind.enabled) return null;
    if (ind.mode === 'manual') return ind.color;
    if (typeof config.goal !== 'number' || !series[0] || rows.length === 0) return null;
    const last = Number(rows[rows.length - 1][series[0].key]) || 0;
    if (last >= config.goal) return 'emerald';
    if (last >= config.goal * 0.8) return 'amber';
    return 'rose';
  }, [config.statusIndicator, config.goal, series, rows]);

  const eventItems = useMemo(() => {
    if (config.type !== 'events' || !series[0]) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let nextMarked = false;
    return rows
      .map((r) => ({ name: r.name as string, dateRaw: r[series[0].key] as string, dateObj: parseAnyDate(r[series[0].key]) }))
      .filter((e) => e.dateObj !== null)
      .sort((a, b) => (a.dateObj as Date).getTime() - (b.dateObj as Date).getTime())
      .map((e) => {
        const eventTime = (e.dateObj as Date).getTime();
        const isPast = eventTime < today.getTime();
        let status: 'past' | 'next' | 'future' = 'future';
        if (isPast) status = 'past';
        else if (!nextMarked) { status = 'next'; nextMarked = true; }
        return { ...e, status };
      });
  }, [config.type, rows, series]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col min-h-[300px] transition-all duration-300 hover:border-[#2d2d34]"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
            {indicatorColor && (
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse flex-shrink-0 ${INDICATOR_DOT[indicatorColor]}`} title="Индикатор статуса" />
            )}
            <LayoutGrid className="w-4 h-4 text-indigo-400 flex-shrink-0" /> {config.title}
          </h3>
          {config.subtitle && <p className="text-xs text-[#a1a1aa] mt-1">{config.subtitle}</p>}
        </div>
        {typeof config.goal === 'number' && (
          <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full font-mono border border-indigo-500/20 whitespace-nowrap">
            Цель: {config.goal}
          </span>
        )}
      </div>

      {config.type === 'person' && (
        <PersonCardBody config={config} />
      )}

      {config.type !== 'person' && !isB24Available() && (
        <p className="text-xs text-[#71717a] flex-1 flex items-center justify-center">
          Данные графика подключатся при открытии внутри портала Bitrix24.
        </p>
      )}

      {config.type !== 'person' && isB24Available() && error && (
        <div className="flex-1 flex items-start gap-2 text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
          <span>Не удалось получить данные из Списка ID {dataSource?.listId}: {error}</span>
        </div>
      )}

      {config.type !== 'person' && isB24Available() && !error && loading && (
        <p className="text-xs text-[#71717a] flex-1 flex items-center justify-center">Загрузка…</p>
      )}

      {config.type !== 'person' && isB24Available() && !error && !loading && rows.length === 0 && (
        <p className="text-xs text-[#71717a] flex-1 flex items-center justify-center">Нет данных в источнике.</p>
      )}

      {config.type !== 'person' && isB24Available() && !error && !loading && rows.length > 0 && (
        <div className="flex-1 w-full min-h-[220px]">
          {config.type === 'kpi' && (
            <div className="h-full flex flex-col items-center justify-center">
              <span className="text-5xl font-extrabold tracking-tight font-mono text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                {kpiValue}
              </span>
              {series[0] && <span className="text-[#a1a1aa] text-sm mt-2">{series[0].label}</span>}
            </div>
          )}

          {config.type === 'events' && (
            <div className="space-y-1.5 overflow-y-auto max-h-full">
              {eventItems.map((e, i) => {
                let badge;
                let rowStyle = 'text-zinc-300';
                if (e.status === 'past') {
                  badge = (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 bg-zinc-800/40 px-2 py-0.5 rounded-md border border-zinc-700/20">
                      <CheckCircle2 className="w-3 h-3" /> Завершено
                    </span>
                  );
                  rowStyle = 'opacity-40 line-through text-zinc-500';
                } else if (e.status === 'next') {
                  badge = (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      <Flame className="w-3 h-3" /> Ближайшее
                    </span>
                  );
                  rowStyle = 'text-white font-medium';
                } else {
                  badge = (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                      Планируется
                    </span>
                  );
                }
                return (
                  <div key={i} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-[#1f1f23] ${rowStyle}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <CalendarClock className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <span className="truncate text-sm">{e.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-mono text-zinc-400">{(e.dateObj as Date).toLocaleDateString('ru-RU')}</span>
                      {badge}
                    </div>
                  </div>
                );
              })}
              {eventItems.length === 0 && (
                <p className="text-xs text-[#71717a] text-center py-6">Нет событий с распознанной датой.</p>
              )}
            </div>
          )}

          {config.type === 'table' && (
            <div className="overflow-x-auto h-full">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#1f1f23]">
                    <th className="text-left py-2 px-3 font-semibold text-[#71717a] text-xs uppercase tracking-wider">Наименование</th>
                    {series.map((s) => (
                      <th key={s.key} className="text-right py-2 px-3 font-semibold text-[#71717a] text-xs uppercase tracking-wider">{s.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f1f23]/60">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2.5 px-3 text-zinc-200">{r.name}</td>
                      {series.map((s) => (
                        <td key={s.key} className="py-2.5 px-3 text-right font-mono text-white">{r[s.key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {config.type === 'pie' && series[0] && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={{ background: '#161619', border: '1px solid #27272a', borderRadius: 10, fontSize: 12 }} />
                <Pie data={rows} dataKey={series[0].key} nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>
                  {rows.map((_, i) => <Cell key={i} fill={series[0].color || PALETTE[i % PALETTE.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}

          {(config.type === 'bar' || config.type === 'line' || config.type === 'area') && (
            <ResponsiveContainer width="100%" height="100%">
              {config.type === 'bar' ? (
                <ComposedChart data={rows} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
                  <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#161619', border: '1px solid #27272a', borderRadius: 10, fontSize: 12 }} />
                  {typeof config.goal === 'number' && (
                    <ReferenceLine y={config.goal} stroke="#4f46e5" strokeDasharray="5 5" />
                  )}
                  {series.map((s, i) => (
                    s.asLine ? (
                      <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color || PALETTE[i % PALETTE.length]} strokeWidth={2.5} dot={{ r: 3 }} />
                    ) : (
                      <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color || PALETTE[i % PALETTE.length]} radius={[6, 6, 0, 0]} barSize={28} />
                    )
                  ))}
                </ComposedChart>
              ) : config.type === 'line' ? (
                <LineChart data={rows} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
                  <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#161619', border: '1px solid #27272a', borderRadius: 10, fontSize: 12 }} />
                  {typeof config.goal === 'number' && (
                    <ReferenceLine y={config.goal} stroke="#4f46e5" strokeDasharray="5 5" />
                  )}
                  {series.map((s, i) => (
                    <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color || PALETTE[i % PALETTE.length]} strokeWidth={2.5} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              ) : (
                <AreaChart data={rows} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
                  <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#161619', border: '1px solid #27272a', borderRadius: 10, fontSize: 12 }} />
                  {typeof config.goal === 'number' && (
                    <ReferenceLine y={config.goal} stroke="#4f46e5" strokeDasharray="5 5" />
                  )}
                  {series.map((s, i) => (
                    <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color || PALETTE[i % PALETTE.length]} fill={s.color || PALETTE[i % PALETTE.length]} fillOpacity={0.15} strokeWidth={2.5} />
                  ))}
                </AreaChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      )}
    </motion.div>
  );
}

function PersonCardBody({ config }: { config: ChartConfig }) {
  const p = config.person;
  if (!p) return <p className="text-xs text-[#71717a]">Карточка сотрудника не настроена.</p>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        {p.photoUrl ? (
          <img src={p.photoUrl} alt={p.name} className="w-11 h-11 rounded-xl object-cover border border-indigo-500/20 flex-shrink-0" />
        ) : (
          <span className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 flex-shrink-0">
            <UserRound className="w-5 h-5" />
          </span>
        )}
        <div className="min-w-0">
          <h4 className="text-base font-bold text-white font-display truncate">{p.name}</h4>
          <p className="text-xs text-indigo-400 font-medium mt-0.5">{p.role}</p>
        </div>
      </div>

      {p.tags.length > 0 && (
        <div className="space-y-2 border-t border-[#1f1f23] pt-4">
          <p className="text-[10px] text-[#71717a] uppercase tracking-wider font-semibold font-display flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Направления
          </p>
          <div className="flex flex-wrap gap-2">
            {p.tags.map((t, i) => (
              <span key={i} className="text-xs text-zinc-300 bg-[#161619] px-2.5 py-1 rounded-lg border border-[#27272a]/60">{t}</span>
            ))}
          </div>
        </div>
      )}

      {p.note && (
        <div className="text-xs text-amber-400 font-medium bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/10">{p.note}</div>
      )}
    </div>
  );
}

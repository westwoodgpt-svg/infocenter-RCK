import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, LayoutGrid } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { ChartConfig, ChartFilter } from '../types';
import { getListElements, isB24Available } from '../b24/client';
import { extractPropValue, toNum } from '../b24/normalize';

const PALETTE = ['#6366f1', '#10b981', '#0ea5e9', '#f59e0b', '#f43f5e', '#a855f7'];

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

export default function ChartCard({ config }: ChartCardProps) {
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isB24Available()) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const fields = [config.dataSource.nameField, ...config.dataSource.series.map((s) => s.field)];
        const elements = await getListElements(config.dataSource.listId, fields);
        let mapped = elements.map((el) => {
          const row: Record<string, any> = {
            name: extractPropValue(el.values[config.dataSource.nameField] ?? el.name),
          };
          config.dataSource.series.forEach((s) => {
            row[s.key] = toNum(el.values[s.field]);
          });
          return row;
        });
        (config.dataSource.filters || []).forEach((f) => {
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

  const series = config.dataSource.series;

  const kpiValue = useMemo(() => {
    if (!series[0]) return 0;
    return rows.reduce((sum, r) => sum + (Number(r[series[0].key]) || 0), 0);
  }, [rows, series]);

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
            <LayoutGrid className="w-4 h-4 text-indigo-400" /> {config.title}
          </h3>
          {config.subtitle && <p className="text-xs text-[#a1a1aa] mt-1">{config.subtitle}</p>}
        </div>
        {typeof config.goal === 'number' && (
          <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full font-mono border border-indigo-500/20 whitespace-nowrap">
            Цель: {config.goal}
          </span>
        )}
      </div>

      {!isB24Available() && (
        <p className="text-xs text-[#71717a] flex-1 flex items-center justify-center">
          Данные графика подключатся при открытии внутри портала Bitrix24.
        </p>
      )}

      {isB24Available() && error && (
        <div className="flex-1 flex items-start gap-2 text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
          <span>Не удалось получить данные из Списка ID {config.dataSource.listId}: {error}</span>
        </div>
      )}

      {isB24Available() && !error && loading && (
        <p className="text-xs text-[#71717a] flex-1 flex items-center justify-center">Загрузка…</p>
      )}

      {isB24Available() && !error && !loading && rows.length === 0 && (
        <p className="text-xs text-[#71717a] flex-1 flex items-center justify-center">Нет данных в источнике.</p>
      )}

      {isB24Available() && !error && !loading && rows.length > 0 && (
        <div className="flex-1 w-full min-h-[220px]">
          {config.type === 'kpi' && (
            <div className="h-full flex flex-col items-center justify-center">
              <span className="text-5xl font-extrabold tracking-tight font-mono text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                {kpiValue}
              </span>
              {series[0] && <span className="text-[#a1a1aa] text-sm mt-2">{series[0].label}</span>}
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
                <BarChart data={rows} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
                  <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#161619', border: '1px solid #27272a', borderRadius: 10, fontSize: 12 }} />
                  {typeof config.goal === 'number' && (
                    <ReferenceLine y={config.goal} stroke="#4f46e5" strokeDasharray="5 5" />
                  )}
                  {series.map((s, i) => (
                    <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color || PALETTE[i % PALETTE.length]} radius={[6, 6, 0, 0]} barSize={28} />
                  ))}
                </BarChart>
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

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { ChartCard } from '../../types';
import { colorFor, seriesColorFor } from './palette';
import { planSeriesIndex } from './chartStatus';

export default function ChartCardView({ card }: { card: ChartCard }) {
  const data = useMemo(
    () =>
      card.rows.map((row) => {
        const point: Record<string, string | number> = { name: row.category };
        card.seriesNames.forEach((name, i) => {
          point[name] = row.values[i] ?? 0;
        });
        return point;
      }),
    [card]
  );

  const pieData = useMemo(() => {
    const seriesName = card.seriesNames[0] ?? 'Значение';
    return card.rows.map((row, i) => ({ name: row.category, value: row.values[0] ?? 0, seriesName, color: row.color || colorFor(i) }));
  }, [card]);

  const hasData = card.rows.length > 0 && card.seriesNames.length > 0;
  const isLineSeries = (i: number) => card.chartType === 'bar' && (card.seriesAsLine?.[i] ?? false);
  const planIdx = card.chartType === 'bar' && card.highlightBelowPlan ? planSeriesIndex(card) : null;
  const belowPlanColor = card.belowPlanColor || '#f43f5e';

  return (
    <div className="p-6">
      <div className="mb-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
          <BarChart3 className="w-4 h-4 text-blue-400" /> {card.title}
        </h3>
        {card.subtitle && <p className="text-xs text-[#a1a1aa] mt-1">{card.subtitle}</p>}
      </div>

      {!hasData ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-[#71717a] border border-dashed border-[#27272a] rounded-xl">
          Нет данных для графика
        </div>
      ) : (
        <div className="w-full h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            {card.chartType === 'pie' ? (
              <PieChart>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const p = payload[0].payload;
                      return (
                        <div className="bg-[#161619] text-[#fafafa] p-3 text-xs rounded-xl shadow-lg border border-[#27272a]">
                          <p className="font-semibold text-white">{p.name}</p>
                          <p className="text-indigo-400 font-mono font-bold mt-1">{p.value}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* itemSorter={null} — по умолчанию Legend сортирует пункты по алфавиту (value),
                    из-за чего порядок легенды расходится с порядком секторов; null сохраняет
                    порядок отрисовки. */}
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#fafafa' }} itemSorter={null} />
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {pieData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            ) : card.chartType === 'line' ? (
              <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
                <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#161619', border: '1px solid #27272a', borderRadius: 12, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10, color: '#fafafa' }} itemSorter={null} />
                {card.seriesNames.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={seriesColorFor(card.seriesColors, i)} strokeWidth={2.5} dot={{ r: 3 }} />
                ))}
              </LineChart>
            ) : card.chartType === 'area' ? (
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
                <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#161619', border: '1px solid #27272a', borderRadius: 12, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10, color: '#fafafa' }} itemSorter={null} />
                {card.seriesNames.map((name, i) => (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={seriesColorFor(card.seriesColors, i)}
                    fill={seriesColorFor(card.seriesColors, i)}
                    fillOpacity={0.2}
                    strokeWidth={2.5}
                  />
                ))}
              </AreaChart>
            ) : (
              <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
                {/* Один общий ось X для столбцов и линии — так точки линии центрируются
                    над столбцами внутри своей категории вместо растяжения до краёв графика. */}
                <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#161619', border: '1px solid #27272a', borderRadius: 12, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10, color: '#fafafa' }} itemSorter={null} />
                {card.seriesNames.map((name, i) =>
                  isLineSeries(i) ? (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={seriesColorFor(card.seriesColors, i)}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  ) : (
                    <Bar
                      key={name}
                      dataKey={name}
                      fill={seriesColorFor(card.seriesColors, i)}
                      radius={[4, 4, 0, 0]}
                      barSize={Math.max(8, 32 / card.seriesNames.length)}
                    >
                      {planIdx !== null &&
                        card.rows.map((row, ri) => {
                          const planValue = row.values[planIdx];
                          const value = row.values[i];
                          const below = planValue !== undefined && value !== undefined && value < planValue;
                          return <Cell key={ri} fill={below ? belowPlanColor : seriesColorFor(card.seriesColors, i)} />;
                        })}
                    </Bar>
                  )
                )}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

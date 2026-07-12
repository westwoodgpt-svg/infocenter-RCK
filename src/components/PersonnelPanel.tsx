import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Users2, CheckCircle2, AlertCircle, Building } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { PersonnelRatio } from '../types';

interface PersonnelPanelProps {
  rck: PersonnelRatio;
  cuppp: PersonnelRatio;
}

export default function PersonnelPanel({ rck, cuppp }: PersonnelPanelProps) {
  
  // Format stats
  const formattedData = useMemo(() => {
    const rckPct = rck.plan > 0 ? Math.round((rck.fact / rck.plan) * 100) : 0;
    const cupppPct = cuppp.plan > 0 ? Math.round((cuppp.fact / cuppp.plan) * 100) : 0;

    return [
      { name: 'РЦК (Региональный центр компетенций)', pct: rckPct, plan: rck.plan, fact: rck.fact },
      { name: 'ЦУППП (Центр управления процессами)', pct: cupppPct, plan: cuppp.plan, fact: cuppp.fact },
    ];
  }, [rck, cuppp]);

  return (
    <div id="panel-personnel" className="space-y-6">
      
      {/* KPI statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* RCC Employees card */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col justify-between min-h-[200px] transition-all duration-300 hover:border-[#2d2d34]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wider text-emerald-400 uppercase font-display">Кадровые ресурсы</p>
              <h3 className="text-base font-bold text-white mt-0.5 font-display">Сотрудники РЦК</h3>
            </div>
            <span className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 my-4">
            <div className="bg-[#161619] p-3 rounded-xl border border-[#27272a]/40">
              <p className="text-[10px] text-[#71717a] uppercase tracking-wider font-semibold font-display">Фактический штат</p>
              <p className="text-3xl font-black text-white font-mono mt-1">{rck.fact}</p>
              <p className="text-[10px] text-[#a1a1aa]">сотрудников</p>
            </div>
            <div className="bg-[#161619] p-3 rounded-xl border border-[#27272a]/40">
              <p className="text-[10px] text-[#71717a] uppercase tracking-wider font-semibold font-display">Штатное расписание</p>
              <p className="text-3xl font-black text-zinc-400 font-mono mt-1">{rck.plan}</p>
              <p className="text-[10px] text-[#a1a1aa]">позиций по плану</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium bg-[#161619]/40 p-2 rounded-lg border border-[#27272a]/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Штат укомплектован полностью на <strong>100%</strong></span>
          </div>
        </motion.div>

        {/* CUPPP Employees card */}
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col justify-between min-h-[200px] transition-all duration-300 hover:border-[#2d2d34]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wider text-amber-400 uppercase font-display">Кадровый резерв</p>
              <h3 className="text-base font-bold text-white mt-0.5 font-display">Сотрудники ЦУППП</h3>
            </div>
            <span className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <AlertCircle className="w-5 h-5" />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 my-4">
            <div className="bg-[#161619] p-3 rounded-xl border border-[#27272a]/40">
              <p className="text-[10px] text-[#71717a] uppercase tracking-wider font-semibold font-display">Фактический штат</p>
              <p className="text-3xl font-black text-white font-mono mt-1">{cuppp.fact}</p>
              <p className="text-[10px] text-[#a1a1aa]">сотрудник</p>
            </div>
            <div className="bg-[#161619] p-3 rounded-xl border border-[#27272a]/40">
              <p className="text-[10px] text-[#71717a] uppercase tracking-wider font-semibold font-display">Штатное расписание</p>
              <p className="text-3xl font-black text-zinc-400 font-mono mt-1">{cuppp.plan}</p>
              <p className="text-[10px] text-[#a1a1aa]">позиции по плану</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-400 font-medium bg-[#161619]/40 p-2 rounded-lg border border-[#27272a]/30">
            <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Требуется заполнение <strong>{cuppp.plan - cuppp.fact}</strong> вакансий ({Math.round((cuppp.fact / cuppp.plan) * 100)}% укомплектовано)</span>
          </div>
        </motion.div>

      </div>

      {/* Staffing levels comparison chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col min-h-[240px]"
      >
        <div className="mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
            <Building className="w-5 h-5 text-indigo-400" /> Уровень укомплектованности подразделений
          </h3>
          <p className="text-xs text-[#a1a1aa] mt-1">Отношение фактической численности сотрудников к штатному расписанию в %</p>
        </div>

        <div className="w-full h-[140px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={formattedData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: -10, bottom: 5 }}
            >
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis 
                dataKey="name" 
                type="category" 
                tick={{ fill: '#a1a1aa', fontSize: 11, width: 140 }} 
                width={150}
                axisLine={false} 
                tickLine={false} 
              />
              <Tooltip
                cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-[#161619] text-[#fafafa] p-3 text-xs rounded-xl shadow-lg border border-[#27272a] space-y-1">
                        <p className="font-semibold text-white">{data.name}</p>
                        <p className="text-emerald-400">Укомплектованность: <span className="font-bold font-mono">{data.pct}%</span></p>
                        <p className="text-[#a1a1aa] text-[10px]">Фаст: {data.fact} / План: {data.plan}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="pct" radius={[0, 6, 6, 0]} barSize={18}>
                {formattedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.pct === 100 ? '#10b981' : '#f59e0b'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}

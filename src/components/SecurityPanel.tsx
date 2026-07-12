import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Calendar, AlertTriangle, CheckCircle2, Flame } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { FineItem, EventItem } from '../types';

interface SecurityPanelProps {
  fines: FineItem[];
  certificationDate: string;
  events: EventItem[];
}

export default function SecurityPanel({ fines, certificationDate, events }: SecurityPanelProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Helper to calculate days between two dates
  const daysBetween = (a: Date, b: Date) => {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  };

  // Convert "YYYY-MM-DD" or "DD.MM.YYYY" to Date
  const parseAnyDate = (s: string) => {
    const trimmed = s.trim();
    const ruMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (ruMatch) {
      return new Date(Number(ruMatch[3]), Number(ruMatch[2]) - 1, Number(ruMatch[1]));
    }
    return new Date(trimmed);
  };

  // Dynamic calculations
  const fineDaysData = useMemo(() => {
    return fines.map((f) => {
      const fineDate = parseAnyDate(f.lastFine);
      const days = daysBetween(fineDate, today);
      return {
        name: `Авто ${f.car}`,
        days: days >= 0 ? days : 0,
        rawDate: f.lastFine,
      };
    });
  }, [fines, today]);

  const daysToCert = useMemo(() => {
    const certDate = parseAnyDate(certificationDate);
    return daysBetween(today, certDate);
  }, [certificationDate, today]);

  // Sort events chronologically to process them safely
  const processedEvents = useMemo(() => {
    let nextMarked = false;
    return events.map((e) => {
      const eventDate = parseAnyDate(e.date);
      const isPast = eventDate < today;
      let status: 'past' | 'next' | 'future' = 'future';

      if (isPast) {
        status = 'past';
      } else if (!nextMarked) {
        status = 'next';
        nextMarked = true;
      }

      return {
        ...e,
        parsedDate: eventDate,
        status,
      };
    });
  }, [events, today]);

  return (
    <div id="panel-security" className="space-y-6">
      {/* Upper row: Grid with stats cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Certification Countdown Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden bg-[#111113] p-6 rounded-2xl border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.04)] flex flex-col justify-between min-h-[220px] transition-all duration-300 hover:border-red-500/30"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full -mr-10 -mt-10 blur-xl pointer-events-none" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wider text-red-400 uppercase font-display glow-text-red">Сертификация РЦК</p>
              <h3 className="text-base font-bold text-white mt-1">Дней до сертификации</h3>
            </div>
            <span className="p-2.5 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
              <ShieldAlert className="w-5 h-5" />
            </span>
          </div>

          <div className="my-3">
            <span className="text-6xl font-extrabold tracking-tight font-mono text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.25)]">
              {daysToCert > 0 ? daysToCert : '0'}
            </span>
            <span className="text-[#a1a1aa] text-sm ml-2 font-medium">календарных дней</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#a1a1aa] border-t border-[#1f1f23] pt-3">
            <Calendar className="w-4 h-4 text-red-400" />
            <span>Запланировано на: <strong className="text-white">{new Date(certificationDate).toLocaleDateString('ru-RU')}</strong></span>
          </div>
        </motion.div>

        {/* Fines Metric summary card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-[#111113] p-6 rounded-2xl border border-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.02)] flex flex-col justify-between min-h-[220px] transition-all duration-300 hover:border-emerald-500/25"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wider text-emerald-400 uppercase font-display glow-text-emerald">Безопасность вождения</p>
              <h3 className="text-base font-bold text-white mt-1">Рекорд без нарушений</h3>
            </div>
            <span className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          </div>

          <div className="my-3">
            <span className="text-6xl font-extrabold tracking-tight font-mono text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              {Math.max(...fineDaysData.map(d => d.days), 0)}
            </span>
            <span className="text-[#a1a1aa] text-sm ml-2 font-medium">дней подряд</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>Автомобиль с наименьшим сроком: <strong className="text-white">{fineDaysData.reduce((min, d) => d.days < min.days ? d : min, fineDaysData[0] || { name: '—', days: 0 }).name}</strong></span>
          </div>
        </motion.div>

        {/* Auto stats chart card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col min-h-[220px] transition-all duration-300 hover:border-[#2d2d34]"
        >
          <h3 className="text-sm font-bold text-white mb-2">Безаварийный стаж экипажей</h3>
          <p className="text-xs text-[#a1a1aa] mb-4">Количество дней с даты последнего зарегистрированного штрафа</p>
          <div className="flex-1 w-full min-h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={fineDaysData}
                layout="vertical"
                margin={{ top: 5, right: 15, left: -20, bottom: 5 }}
              >
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#161619] text-[#fafafa] p-3 text-xs rounded-xl shadow-lg border border-[#27272a]">
                          <p className="font-semibold text-white mb-1">{data.name}</p>
                          <p className="text-[#a1a1aa]">Дней без штрафов: <span className="font-mono text-emerald-400 font-bold">{data.days}</span></p>
                          <p className="text-[#71717a] text-[10px] mt-1">Последний штраф: {new Date(data.rawDate).toLocaleDateString('ru-RU')}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="days" radius={[0, 6, 6, 0]} barSize={16}>
                  {fineDaysData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.days < 100 ? '#f59e0b' : entry.days < 200 ? '#3b82f6' : '#10b981'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Events timeline section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-[#111113] rounded-2xl border border-[#27272a] shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-[#1f1f23] flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-white">План ключевых мероприятий 2026</h3>
            <p className="text-xs text-[#a1a1aa] mt-1">Мониторинг прохождения контрольных точек и сертификаций</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-[#18181b] text-indigo-400 rounded-full border border-[#27272a] font-mono">
            {events.length} событий
          </span>
        </div>

        <div className="p-6 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#1f1f23]">
                <th className="text-left py-3 px-4 font-semibold text-[#71717a] text-xs tracking-wider uppercase font-display">Событие</th>
                <th className="text-left py-3 px-4 font-semibold text-[#71717a] text-xs tracking-wider uppercase font-display">Дата проведения</th>
                <th className="text-right py-3 px-4 font-semibold text-[#71717a] text-xs tracking-wider uppercase font-display">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f23]/60">
              {processedEvents.map((event, idx) => {
                let statusBadge = null;
                let rowStyle = "";

                if (event.status === 'past') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 bg-zinc-800/40 px-2.5 py-1 rounded-md border border-zinc-700/20">
                      <CheckCircle2 className="w-3 h-3 text-zinc-500" /> Завершено
                    </span>
                  );
                  rowStyle = "opacity-40 line-through text-zinc-500";
                } else if (event.status === 'next') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.08)] animate-pulse">
                      <Flame className="w-3 h-3 text-amber-500" /> Ближайшее
                    </span>
                  );
                  rowStyle = "bg-amber-500/5 border-l-2 border-l-amber-500 text-white font-medium";
                } else {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20">
                      Планируется
                    </span>
                  );
                  rowStyle = "text-zinc-300";
                }

                return (
                  <tr key={idx} className={`hover:bg-zinc-800/20 border-b border-[#1f1f23]/30 transition-all duration-300 ${rowStyle}`}>
                    <td className="py-3.5 px-4 font-sans">{event.name}</td>
                    <td className="py-3.5 px-4 font-mono text-xs">{event.parsedDate.toLocaleDateString('ru-RU')}</td>
                    <td className="py-3.5 px-4 text-right">{statusBadge}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

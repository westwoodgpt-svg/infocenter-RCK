import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Award, Check, Percent, Target, TrendingUp, Sparkles, BookOpen } from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine, 
  Cell, 
  AreaChart, 
  Area, 
  LineChart, 
  Line 
} from 'recharts';
import { NpsGroup, NpsTreningiGroup } from '../types';

interface QualityPanelProps {
  npsFabrika: NpsGroup;
  npsFabrikaOfis: NpsGroup;
  npsTreningi: NpsTreningiGroup;
}

export default function QualityPanel({ npsFabrika, npsFabrikaOfis, npsTreningi }: QualityPanelProps) {
  
  // Chronological satisfaction timeline
  const timelineData = useMemo(() => {
    const list: { name: string; date: string; dateObj: Date; fact: number; type: string }[] = [];
    
    const parseDate = (dStr: string) => {
      if (!dStr) return new Date(0);
      
      // If date includes dots (e.g. DD.MM.YYYY)
      if (dStr.includes('.')) {
        const parts = dStr.split(' ')[0].split('.');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      }
      
      // If date includes dashes (e.g. YYYY-MM-DD)
      if (dStr.includes('-')) {
        const parts = dStr.split(' ')[0].split('-');
        if (parts.length === 3) {
          return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
      }
      
      const parsed = Date.parse(dStr);
      return isNaN(parsed) ? new Date(0) : new Date(parsed);
    };

    npsFabrika.companies.forEach((company, index) => {
      const dStr = npsFabrika.dates[index] || '';
      list.push({
        name: company,
        date: dStr,
        dateObj: parseDate(dStr),
        fact: npsFabrika.fact[index],
        type: 'Фабрика процессов'
      });
    });

    npsFabrikaOfis.companies.forEach((company, index) => {
      const dStr = npsFabrikaOfis.dates[index] || '';
      list.push({
        name: company,
        date: dStr,
        dateObj: parseDate(dStr),
        fact: npsFabrikaOfis.fact[index],
        type: 'Фабрика офиса'
      });
    });

    // Sort chronologically by date
    return list
      .filter(item => item.dateObj.getTime() !== 0)
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .map(item => ({
        name: item.name,
        date: item.date,
        fact: item.fact,
        type: item.type
      }));
  }, [npsFabrika, npsFabrikaOfis]);

  // Format data for Individual Tracks
  const fabrikaData = useMemo(() => {
    return npsFabrika.companies.map((company, index) => ({
      name: company,
      date: npsFabrika.dates[index] || '',
      fact: npsFabrika.fact[index],
      goal: npsFabrika.goal,
    }));
  }, [npsFabrika]);

  const fabrikaOfisData = useMemo(() => {
    return npsFabrikaOfis.companies.map((company, index) => ({
      name: company,
      date: npsFabrikaOfis.dates[index] || '',
      fact: npsFabrikaOfis.fact[index],
      goal: npsFabrikaOfis.goal,
    }));
  }, [npsFabrikaOfis]);

  const trainingData = useMemo(() => {
    return npsTreningi.names.map((name, index) => ({
      name,
      fact: npsTreningi.fact[index],
      goal: npsTreningi.goal,
    }));
  }, [npsTreningi]);

  // General statistics
  const avgNps = useMemo(() => {
    const allFacts = [
      ...npsFabrika.fact,
      ...npsFabrikaOfis.fact,
      ...npsTreningi.fact
    ];
    if (allFacts.length === 0) return 0;
    return Math.round(allFacts.reduce((sum, f) => sum + f, 0) / allFacts.length);
  }, [npsFabrika, npsFabrikaOfis, npsTreningi]);

  // Color selection helper
  const getBarColor = (fact: number, goal: number) => {
    return fact >= goal ? '#10b981' : '#f43f5e'; // Emerald or Rose
  };

  const getBarFill = (fact: number, goal: number, track: 'green' | 'blue' = 'green') => {
    if (fact >= goal) {
      return track === 'green' ? 'url(#greenGradient)' : 'url(#blueGradient)';
    }
    return 'url(#redGradient)';
  };

  return (
    <div id="panel-quality" className="space-y-6">
      
      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-[#111113] p-5 rounded-2xl border border-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.01)] flex items-center gap-4 transition-all duration-300 hover:border-emerald-500/20"
        >
          <span className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/25">
            <Percent className="w-6 h-6" />
          </span>
          <div>
            <p className="text-xs text-[#a1a1aa] font-medium font-display">Средний NPS по всем трекам</p>
            <h3 className="text-2xl font-extrabold text-white font-mono mt-0.5 drop-shadow-[0_0_10px_rgba(16,185,129,0.15)]">{avgNps}%</h3>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-[#111113] p-5 rounded-2xl border border-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.01)] flex items-center gap-4 transition-all duration-300 hover:border-blue-500/20"
        >
          <span className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/25">
            <Target className="w-6 h-6" />
          </span>
          <div>
            <p className="text-xs text-[#a1a1aa] font-medium font-display">Целевой ориентир удовлетворенности</p>
            <h3 className="text-2xl font-extrabold text-white font-mono mt-0.5 drop-shadow-[0_0_10px_rgba(59,130,246,0.15)]">{npsFabrika.goal}%</h3>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-[#111113] p-5 rounded-2xl border border-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.01)] flex items-center gap-4 transition-all duration-300 hover:border-indigo-500/20"
        >
          <span className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/25">
            <Award className="w-6 h-6" />
          </span>
          <div>
            <p className="text-xs text-[#a1a1aa] font-medium font-display">Максимальный балл (Рекорд)</p>
            <h3 className="text-2xl font-extrabold text-white font-mono mt-0.5 drop-shadow-[0_0_10px_rgba(99,102,241,0.15)]">100%</h3>
          </div>
        </motion.div>
      </div>

      {/* NEW SECTION: Chronological satisfaction timeline to show historical NPS dynamics by company/session */}
      {timelineData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col min-h-[320px] transition-all duration-300 hover:border-[#2d2d34]"
        >
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                Хронологическая динамика удовлетворенности NPS 2026
              </h3>
              <p className="text-xs text-[#a1a1aa] mt-1">
                Развитие показателей качества и обратной связи от сессии к сессии нарастающим итогом
              </p>
            </div>
            <div className="flex gap-4 text-[10px] text-[#a1a1aa]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Фабрика процессов
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                Фабрика офиса
              </span>
            </div>
          </div>

          <div className="w-full h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 15, right: 15, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
                <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[50, 105]} tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const isFabrika = data.type === 'Фабрика процессов';
                      return (
                        <div className="bg-[#161619] text-[#fafafa] p-3 text-xs rounded-xl shadow-lg border border-[#27272a] space-y-1.5">
                          <p className="font-semibold text-white">{data.name}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-[#a1a1aa]">
                            <span className={`w-1.5 h-1.5 rounded-full ${isFabrika ? 'bg-emerald-500' : 'bg-sky-500'}`} />
                            <span>{data.type}</span>
                          </div>
                          <p className="text-[#a1a1aa]">Дата: <span className="text-white font-mono">{data.date}</span></p>
                          <div className="flex items-center gap-1.5 mt-1 border-t border-[#1f1f23] pt-1.5">
                            <span className="text-[#a1a1aa]">NPS Уровень:</span>
                            <span className="font-bold font-mono text-indigo-400">{data.fact}%</span>
                            {data.fact >= 80 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Цель 80%', fill: '#f43f5e', fontSize: 10, position: 'insideBottomLeft' }} />
                <Area 
                  type="monotone" 
                  dataKey="fact" 
                  stroke="#6366f1" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#timelineGrad)"
                  dot={({ cx, cy, payload }) => {
                    const isFabrika = payload.type === 'Фабрика процессов';
                    return (
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={5} 
                        fill={isFabrika ? '#10b981' : '#0ea5e9'} 
                        stroke="#09090b" 
                        strokeWidth={2}
                        className="cursor-pointer transition-all duration-200 hover:r-7" 
                      />
                    );
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Factory of Processes NPS */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col min-h-[340px] transition-all duration-300 hover:border-[#2d2d34]"
        >
          <div className="mb-4">
            <div className="flex justify-between items-start">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5 font-display">
                <Sparkles className="w-4 h-4 text-emerald-400" /> NPS «Фабрика процессов 2026»
              </h3>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full font-mono border border-emerald-500/20">Цель: {npsFabrika.goal}%</span>
            </div>
            <p className="text-xs text-[#a1a1aa] mt-1">
              {npsFabrika.companies.join(' · ') || 'Нет данных'}
            </p>
          </div>

          <div className="flex-1 w-full h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fabrikaData} margin={{ top: 20, right: 10, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#e11d48" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
                <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 110]} tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const isTargetMet = data.fact >= data.goal;
                      return (
                        <div className="bg-[#161619] text-[#fafafa] p-3 text-xs rounded-xl shadow-lg border border-[#27272a] space-y-1">
                          <p className="font-semibold text-white">{data.name}</p>
                          <p className="text-[#a1a1aa]">Дата: <span className="text-white font-mono">{data.date}</span></p>
                          <div className="flex items-center gap-1.5 mt-1 border-t border-[#1f1f23] pt-1.5">
                            <span className="text-[#a1a1aa]">NPS:</span>
                            <span className={`font-bold font-mono ${isTargetMet ? 'text-emerald-400' : 'text-rose-400'}`}>{data.fact}%</span>
                            {isTargetMet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                          </div>
                          <p className="text-[10px] text-[#71717a]">Целевой уровень: {data.goal}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={npsFabrika.goal} stroke="#4f46e5" strokeDasharray="5 5" label={{ value: 'Цель', fill: '#818cf8', fontSize: 10, position: 'top' }} />
                <Bar dataKey="fact" radius={[8, 8, 0, 0]} barSize={40}>
                  {fabrikaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarFill(entry.fact, entry.goal, 'green')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Factory of Office Processes NPS */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col min-h-[340px] transition-all duration-300 hover:border-[#2d2d34]"
        >
          <div className="mb-4">
            <div className="flex justify-between items-start">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5 font-display">
                <Sparkles className="w-4 h-4 text-sky-400" /> NPS «Фабрика офисных процессов 2026»
              </h3>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full font-mono border border-emerald-500/20">Цель: {npsFabrikaOfis.goal}%</span>
            </div>
            <p className="text-xs text-[#a1a1aa] mt-1">
              {npsFabrikaOfis.companies.join(' · ') || 'Нет данных'}
            </p>
          </div>

          <div className="flex-1 w-full h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fabrikaOfisData} margin={{ top: 20, right: 10, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
                <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 110]} tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const isTargetMet = data.fact >= data.goal;
                      return (
                        <div className="bg-[#161619] text-[#fafafa] p-3 text-xs rounded-xl shadow-lg border border-[#27272a] space-y-1">
                          <p className="font-semibold text-white">{data.name}</p>
                          <p className="text-[#a1a1aa]">Дата сессии: <span className="text-white font-mono">{data.date}</span></p>
                          <div className="flex items-center gap-1.5 mt-1 border-t border-[#1f1f23] pt-1.5">
                            <span className="text-[#a1a1aa]">NPS:</span>
                            <span className={`font-bold font-mono ${isTargetMet ? 'text-emerald-400' : 'text-rose-400'}`}>{data.fact}%</span>
                            {isTargetMet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                          </div>
                          <p className="text-[10px] text-[#71717a]">Целевой уровень: {data.goal}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={npsFabrikaOfis.goal} stroke="#4f46e5" strokeDasharray="5 5" label={{ value: 'Цель', fill: '#818cf8', fontSize: 10, position: 'top' }} />
                <Bar dataKey="fact" radius={[8, 8, 0, 0]} barSize={40}>
                  {fabrikaOfisData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarFill(entry.fact, entry.goal, 'blue')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Trainings wide chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col min-h-[360px] transition-all duration-300 hover:border-[#2d2d34]"
      >
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                NPS по тренингам 2026
              </h3>
              <p className="text-xs text-[#a1a1aa] mt-1">Оценка качества учебных программ выпускниками РЦК</p>
            </div>
            <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full font-mono border border-indigo-500/20 text-center">
              ОБП · Картирование · РПУ · 5С · ПА · СР · СМЕД · ОЕЕ · МРП
            </span>
          </div>
        </div>

        <div className="w-full h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trainingData} margin={{ top: 20, right: 10, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
              <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11, fontWeight: 500 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 110]} tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isTargetMet = data.fact >= data.goal;
                    return (
                      <div className="bg-[#161619] text-[#fafafa] p-3 text-xs rounded-xl shadow-lg border border-[#27272a] space-y-1">
                        <p className="font-semibold text-indigo-300">Тренинг: {data.name}</p>
                        <div className="flex items-center gap-1.5 mt-1 border-t border-[#1f1f23] pt-1.5">
                          <span className="text-[#a1a1aa]">NPS Факт:</span>
                          <span className={`font-bold font-mono ${isTargetMet ? 'text-emerald-400' : 'text-rose-400'}`}>{data.fact}%</span>
                          {isTargetMet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                        </div>
                        <p className="text-[10px] text-[#71717a]">Цель: {data.goal}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={npsTreningi.goal} stroke="#4f46e5" strokeDasharray="4 4" label={{ value: 'Цель 80%', fill: '#818cf8', fontSize: 10, position: 'top' }} />
              <Bar dataKey="fact" radius={[6, 6, 0, 0]} barSize={36}>
                {trainingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.fact, entry.goal)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}

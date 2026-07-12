import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Award, Briefcase, GraduationCap, Share2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import { ProductionProgress, ProductionProjects, ProductionEdu, ProductionSmi } from '../types';

interface ProductionPanelProps {
  ibp: ProductionProgress;
  projects: ProductionProjects;
  edu: ProductionEdu;
  smi: ProductionSmi;
}

export default function ProductionPanel({ ibp, projects, edu, smi }: ProductionPanelProps) {
  const quarters = ['I кв', 'II кв', 'III кв', 'IV кв'];

  // 1. Preparing IBP Instructors Data
  const ibpData = useMemo(() => {
    return quarters.map((q, idx) => ({
      name: q,
      'План': ibp.plan[idx] ?? 0,
      'Готовится': ibp.gotovitsya[idx] === null ? undefined : ibp.gotovitsya[idx],
      'Готов ИБП': ibp.gotov[idx] === null ? undefined : ibp.gotov[idx],
    }));
  }, [ibp]);

  // 2. Active Projects Data
  const projectsData = useMemo(() => {
    return quarters.map((q, idx) => ({
      name: q,
      'План': projects.plan[idx] ?? 0,
      'Открыто': projects.otkryto[idx] === null ? undefined : projects.otkryto[idx],
      'Закрыто': projects.zakryto[idx] === null ? undefined : projects.zakryto[idx],
    }));
  }, [projects]);

  // 3. Enterprise Employee Training Data
  const eduData = useMemo(() => {
    return quarters.map((q, idx) => ({
      name: q,
      'План': edu.plan[idx] ?? 0,
      'Факт': edu.fact[idx] === null ? undefined : edu.fact[idx],
    }));
  }, [edu]);

  // 4. Media Mentions Data
  const smiData = useMemo(() => {
    return smi.weeks.map((week, idx) => ({
      name: `Неделя ${idx + 1}`,
      period: week,
      'План': smi.plan[idx] ?? 0,
      'Факт': smi.fact[idx] === null ? undefined : smi.fact[idx],
    }));
  }, [smi]);

  return (
    <div id="panel-production" className="space-y-6">
      
      {/* Grid of 4 beautiful interactive widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* IBP Instructors training (Бережливое производство) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col min-h-[380px] transition-all duration-300 hover:border-[#2d2d34]"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <Award className="w-5 h-5 text-amber-500" /> Подготовка инструкторов ИБП
              </h3>
              <p className="text-xs text-[#a1a1aa] mt-1">Обучение по бережливому производству нарастающим итогом</p>
            </div>
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md font-mono border border-amber-500/20">2026</span>
          </div>
 
          <div className="flex-1 w-full h-[240px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ibpData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
                <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#161619] text-[#fafafa] p-3 text-xs rounded-xl shadow-lg border border-[#27272a] space-y-1.5">
                          <p className="font-semibold text-white">{payload[0].payload.name}</p>
                          <div className="space-y-1 border-t border-[#1f1f23] pt-1.5 mt-1">
                            {payload.map((p, i) => (
                              <div key={i} className="flex items-center gap-4 justify-between">
                                <span className="flex items-center gap-1.5 text-[#a1a1aa]">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                  {p.name}:
                                </span>
                                <span className="font-bold font-mono text-white">{p.value} чел.</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10, color: '#fafafa' }} />
                <Bar dataKey="План" fill="#3f3f46" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="Готовится" fill="#eab308" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="Готов ИБП" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
 
        {/* Projects in work */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col min-h-[380px] transition-all duration-300 hover:border-[#2d2d34]"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <Briefcase className="w-5 h-5 text-indigo-500" /> Проекты в работе
              </h3>
              <p className="text-xs text-[#a1a1aa] mt-1">Осуществление проектов улучшений нарастающим итогом</p>
            </div>
            <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md font-mono border border-indigo-500/20">2026</span>
          </div>
 
          <div className="flex-1 w-full h-[240px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
                <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#161619] text-[#fafafa] p-3 text-xs rounded-xl shadow-lg border border-[#27272a] space-y-1.5">
                          <p className="font-semibold text-white">{payload[0].payload.name}</p>
                          <div className="space-y-1 border-t border-[#1f1f23] pt-1.5 mt-1">
                            {payload.map((p, i) => (
                              <div key={i} className="flex items-center gap-4 justify-between">
                                <span className="flex items-center gap-1.5 text-[#a1a1aa]">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                  {p.name}:
                                </span>
                                <span className="font-bold font-mono text-white">{p.value} проектов</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10, color: '#fafafa' }} />
                <Bar dataKey="План" fill="#3f3f46" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="Открыто" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="Закрыто" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
 
        {/* Enterprise Employee Training */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col min-h-[380px] transition-all duration-300 hover:border-[#2d2d34]"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <GraduationCap className="w-5 h-5 text-emerald-500" /> Обучение сотрудников предприятий
              </h3>
              <p className="text-xs text-[#a1a1aa] mt-1">Обучение инструментам бережливого производства (нарастающим итогом, чел.)</p>
            </div>
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md font-mono border border-emerald-500/20">Чел.</span>
          </div>
 
          <div className="flex-1 w-full h-[240px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={eduData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="planGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#52525b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#52525b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="factGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
                <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#161619] text-[#fafafa] p-3 text-xs rounded-xl shadow-lg border border-[#27272a] space-y-1.5">
                          <p className="font-semibold text-white">{payload[0].payload.name}</p>
                          <div className="space-y-1 border-t border-[#1f1f23] pt-1.5 mt-1">
                            {payload.map((p, i) => (
                              <div key={i} className="flex items-center gap-4 justify-between">
                                <span className="flex items-center gap-1.5 text-[#a1a1aa]">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                  {p.name}:
                                </span>
                                <span className="font-bold font-mono text-white">{p.value} чел.</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10, color: '#fafafa' }} />
                <Area type="monotone" dataKey="План" stroke="#52525b" strokeWidth={2.5} fillOpacity={1} fill="url(#planGrad)" />
                <Area type="monotone" dataKey="Факт" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#factGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
 
        {/* PR Media mentions */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col min-h-[380px] transition-all duration-300 hover:border-[#2d2d34]"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <Share2 className="w-5 h-5 text-sky-500" /> Инфоповоды в СМИ за период
              </h3>
              <p className="text-xs text-[#a1a1aa] mt-1">Публикации и медиа-активность РЦК по неделям текущего месяца</p>
            </div>
            <span className="text-[10px] font-semibold text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-md font-mono border border-sky-500/20">СМИ</span>
          </div>
 
          <div className="flex-1 w-full h-[240px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={smiData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f23" />
                <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#161619] text-[#fafafa] p-3 text-xs rounded-xl shadow-lg border border-[#27272a] space-y-1.5">
                          <p className="font-semibold text-white">{data.name}</p>
                          <p className="text-[10px] text-[#71717a]">Период: {data.period}</p>
                          <div className="space-y-1 border-t border-[#1f1f23] pt-1.5 mt-1">
                            {payload.map((p, i) => (
                              <div key={i} className="flex items-center gap-4 justify-between">
                                <span className="flex items-center gap-1.5 text-[#a1a1aa]">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                  {p.name}:
                                </span>
                                <span className="font-bold font-mono text-white">{p.value} публикаций</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10, color: '#fafafa' }} />
                <Bar dataKey="План" fill="#3f3f46" radius={[3, 3, 0, 0]} barSize={14} />
                <Bar dataKey="Факт" fill="#0284c7" radius={[3, 3, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
 
      </div>
    </div>
  );
}

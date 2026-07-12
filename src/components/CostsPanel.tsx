import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PiggyBank, Receipt, DollarSign, Wallet2 } from 'lucide-react';
import { Smeta } from '../types';

interface CostsPanelProps {
  smeta: Smeta;
}

export default function CostsPanel({ smeta }: CostsPanelProps) {
  
  // Format items array
  const smetaItems = useMemo(() => {
    return [
      { name: 'Потрачено', amount: smeta.spent, color: '#10b981', lightColor: '#10b981/10' },
      { name: 'Законтрактовано и не потрачено', amount: smeta.contractedNotSpent, color: '#f59e0b', lightColor: '#f59e0b/10' },
      { name: 'Не законтрактовано и не потрачено', amount: smeta.notContracted, color: '#52525b', lightColor: '#52525b/10' },
    ];
  }, [smeta]);

  const totalSmeta = useMemo(() => {
    return smetaItems.reduce((acc, curr) => acc + curr.amount, 0);
  }, [smetaItems]);

  return (
    <div id="panel-costs" className="space-y-6">
      
      {/* Upper overview stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Spent */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-[#111113] p-5 rounded-2xl border border-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.01)] flex items-center gap-4 transition-all duration-300 hover:border-emerald-500/20"
        >
          <span className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <DollarSign className="w-5 h-5" />
          </span>
          <div>
            <p className="text-xs text-[#a1a1aa] font-medium">Освоено (Потрачено)</p>
            <h3 className="text-xl font-bold text-white font-mono">{smeta.spent} млн руб.</h3>
            <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">
              {totalSmeta > 0 ? Math.round((smeta.spent / totalSmeta) * 100) : 0}% от общей сметы
            </p>
          </div>
        </motion.div>

        {/* Contracted not spent */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-[#111113] p-5 rounded-2xl border border-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.01)] flex items-center gap-4 transition-all duration-300 hover:border-amber-500/20"
        >
          <span className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Receipt className="w-5 h-5" />
          </span>
          <div>
            <p className="text-xs text-[#a1a1aa] font-medium">Законтрактовано (Резерв)</p>
            <h3 className="text-xl font-bold text-white font-mono">{smeta.contractedNotSpent} млн руб.</h3>
            <p className="text-[10px] text-amber-400 font-semibold mt-0.5">
              {totalSmeta > 0 ? Math.round((smeta.contractedNotSpent / totalSmeta) * 100) : 0}% в работе
            </p>
          </div>
        </motion.div>

        {/* Not contracted */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-[#111113] p-5 rounded-2xl border border-zinc-500/10 shadow-[0_0_15px_rgba(113,113,122,0.01)] flex items-center gap-4 transition-all duration-300 hover:border-zinc-500/20"
        >
          <span className="p-3 bg-zinc-800/40 text-zinc-400 rounded-xl border border-zinc-700/30">
            <Wallet2 className="w-5 h-5" />
          </span>
          <div>
            <p className="text-xs text-[#a1a1aa] font-medium">Свободный остаток сметы</p>
            <h3 className="text-xl font-bold text-white font-mono">{smeta.notContracted} млн руб.</h3>
            <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
              {totalSmeta > 0 ? Math.round((smeta.notContracted / totalSmeta) * 100) : 0}% не распределено
            </p>
          </div>
        </motion.div>

      </div>

      {/* Breakdown with Pie Chart and utilization Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Pie Chart display - Left */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-5 bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col justify-between"
        >
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
              <PiggyBank className="w-5 h-5 text-indigo-400" /> Структура сметы 2026
            </h3>
            <p className="text-xs text-[#a1a1aa] mt-1">
              Общий объем финансирования: <span className="font-semibold text-zinc-200 font-mono">{totalSmeta} млн руб.</span>
            </p>
          </div>

          <div className="flex-1 min-h-[220px] flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const percentage = totalSmeta > 0 ? Math.round((data.amount / totalSmeta) * 100) : 0;
                      return (
                        <div className="bg-[#161619] text-[#fafafa] p-3 text-xs rounded-xl shadow-lg border border-[#27272a]">
                          <p className="font-semibold text-white">{data.name}</p>
                          <p className="text-indigo-400 font-mono font-bold mt-1">{data.amount} млн руб. ({percentage}%)</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Pie
                  data={smetaItems}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="amount"
                >
                  {smetaItems.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Inner ring metrics info */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider font-display">Всего по смете</span>
              <span className="text-2xl font-black font-mono text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{totalSmeta}</span>
              <span className="text-[10px] text-[#a1a1aa]">млн руб</span>
            </div>
          </div>

          {/* Mini interactive legend */}
          <div className="space-y-2 border-t border-[#1f1f23] pt-4">
            {smetaItems.map((item, index) => {
              const pct = totalSmeta > 0 ? Math.round((item.amount / totalSmeta) * 100) : 0;
              return (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-[#a1a1aa]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="font-bold font-mono text-white">{item.amount} млн ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Utilization breakdown table - Right */}
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="lg:col-span-7 bg-[#111113] p-6 rounded-2xl border border-[#27272a] shadow-sm flex flex-col"
        >
          <div className="mb-4">
            <h3 className="text-base font-bold text-white">Освоение сметы по статьям</h3>
            <p className="text-xs text-[#a1a1aa] mt-1">Табличная ведомость финансовых обязательств</p>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#1f1f23]">
                  <th className="text-left py-3 px-2 font-semibold text-[#71717a] text-xs tracking-wider uppercase font-display">Статья расходов</th>
                  <th className="text-right py-3 px-2 font-semibold text-[#71717a] text-xs tracking-wider uppercase font-display">Объем (млн руб)</th>
                  <th className="text-right py-3 px-2 font-semibold text-[#71717a] text-xs tracking-wider uppercase font-display w-36">Прогресс доли</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f23]/60">
                {smetaItems.map((item, idx) => {
                  const pct = totalSmeta > 0 ? Math.round((item.amount / totalSmeta) * 100) : 0;
                  return (
                    <tr key={idx} className="hover:bg-zinc-800/20 border-b border-[#1f1f23]/30 transition-all duration-300">
                      <td className="py-4 px-2 font-medium text-zinc-300">{item.name}</td>
                      <td className="py-4 px-2 text-right font-mono font-bold text-white">{item.amount}</td>
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-3 justify-end">
                          <span className="font-mono text-xs font-semibold text-[#a1a1aa]">{pct}%</span>
                          <div className="w-20 bg-zinc-900 h-2 rounded-full overflow-hidden border border-[#27272a]">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: 0.1 * idx }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#1f1f23] bg-[#161619] font-bold">
                  <td className="py-4 px-2 text-white font-semibold">Итого по смете</td>
                  <td className="py-4 px-2 text-right font-mono text-lg text-indigo-400">{totalSmeta}</td>
                  <td className="py-4 px-2 text-right font-mono text-sm text-[#71717a]">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

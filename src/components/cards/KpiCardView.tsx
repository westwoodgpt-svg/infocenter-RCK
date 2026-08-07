import { motion } from 'motion/react';
import { KpiCard } from '../../types';

function percentColor(pct: number | null) {
  if (pct === null) return { text: 'text-zinc-400', bg: 'bg-zinc-800/40', border: 'border-zinc-700/30', bar: '#52525b' };
  if (pct >= 100) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', bar: '#10b981' };
  if (pct >= 50) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', bar: '#f59e0b' };
  return { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', bar: '#f43f5e' };
}

export default function KpiCardView({ card }: { card: KpiCard }) {
  const c = percentColor(card.percent);
  const barWidth = card.percent === null ? 0 : Math.min(Math.max(card.percent, 0), 100);

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-zinc-200 font-medium leading-relaxed">{card.title}</p>
          {card.subtitle && <p className="text-[11px] text-[#71717a] mt-1">{card.subtitle}</p>}
        </div>
        <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-md border whitespace-nowrap ${c.text} ${c.bg} ${c.border}`}>
          {card.percent === null ? '—' : `${card.percent}%`}
        </span>
      </div>
      <div className="flex items-center gap-4 mt-3 text-[11px] text-[#a1a1aa]">
        <span>
          План: <strong className="text-white font-mono">{card.planValue}</strong>
          {card.planDate ? ` к ${card.planDate}` : ''}
        </span>
        <span>
          Факт: <strong className="text-white font-mono">{card.factValue}</strong>
          {card.factDate ? ` (${card.factDate})` : ''}
        </span>
      </div>
      <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-[#27272a] mt-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.8 }}
          className="h-full rounded-full"
          style={{ backgroundColor: c.bar }}
        />
      </div>
    </div>
  );
}

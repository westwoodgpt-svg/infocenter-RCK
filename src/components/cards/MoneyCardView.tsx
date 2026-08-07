import { motion } from 'motion/react';
import { Banknote } from 'lucide-react';
import { MoneyCard } from '../../types';

const fmt = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n));

export default function MoneyCardView({ card }: { card: MoneyCard }) {
  const pct = card.plan > 0 ? Math.round((card.fact / card.plan) * 100) : 0;
  const remainder = card.plan - card.fact;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
            <Banknote className="w-4 h-4 text-emerald-400" /> {card.title}
          </h3>
          {card.subtitle && <p className="text-[11px] text-[#71717a] mt-1">{card.subtitle}</p>}
        </div>
        <span className="font-mono text-sm text-white font-bold whitespace-nowrap">
          {fmt(card.fact)} / {fmt(card.plan)} ₽
        </span>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <div className="flex-1 bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-[#27272a]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(pct, 100)}%` }}
            transition={{ duration: 0.8 }}
            className="h-full rounded-full bg-emerald-500"
          />
        </div>
        <span className="font-mono text-xs font-semibold text-[#a1a1aa] w-10 text-right">{pct}%</span>
      </div>

      <p className="text-[11px] text-[#71717a] mt-2">Остаток: <span className="text-zinc-300 font-mono">{fmt(remainder)} ₽</span></p>
    </div>
  );
}

import { useMemo } from 'react';
import { CalendarClock, CheckCircle2, Flame } from 'lucide-react';
import { EventsCard } from '../../types';

function parseIsoDate(iso: string): Date | null {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export default function EventsCardView({ card }: { card: EventsCard }) {
  const rows = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let nextMarked = false;
    return card.items
      .map((item) => ({ ...item, dateObj: parseIsoDate(item.date) }))
      .filter((item) => item.dateObj !== null)
      .sort((a, b) => (a.dateObj as Date).getTime() - (b.dateObj as Date).getTime())
      .map((item) => {
        const isPast = (item.dateObj as Date).getTime() < today.getTime();
        let status: 'past' | 'next' | 'future' = 'future';
        if (isPast) status = 'past';
        else if (!nextMarked) { status = 'next'; nextMarked = true; }
        return { ...item, status };
      });
  }, [card.items]);

  return (
    <div className="p-5">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
          <CalendarClock className="w-4 h-4 text-indigo-400 flex-shrink-0" /> {card.title}
        </h3>
        {card.subtitle && <p className="text-[11px] text-[#a1a1aa] mt-1.5">{card.subtitle}</p>}
      </div>

      {rows.length === 0 ? (
        <div className="h-[120px] flex items-center justify-center text-xs text-[#71717a] border border-dashed border-[#27272a] rounded-xl">
          Нет событий с датой
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((e, i) => {
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
                <span className="truncate text-sm">{e.title}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-mono text-zinc-400">{(e.dateObj as Date).toLocaleDateString('ru-RU')}</span>
                  {badge}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

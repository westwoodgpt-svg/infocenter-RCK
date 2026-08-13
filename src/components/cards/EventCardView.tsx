import { CalendarClock, ShieldCheck } from 'lucide-react';
import { EventCard } from '../../types';

function parseIsoDate(iso: string): Date | null {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function pluralDays(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
}

function daysFromToday(eventDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(eventDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function counterStyle(diff: number | null) {
  if (diff === null) return { text: 'text-zinc-400', bg: 'bg-zinc-800/40', border: 'border-zinc-700/30' };
  if (diff < 0) return { text: 'text-zinc-400', bg: 'bg-zinc-800/40', border: 'border-zinc-700/30' };
  if (diff === 0) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
  if (diff <= 7) return { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
  return { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' };
}

function counterLabel(diff: number | null): string {
  if (diff === null) return 'Дата не указана';
  if (diff === 0) return 'Сегодня';
  if (diff > 0) return `Через ${diff} ${pluralDays(diff)}`;
  return `${Math.abs(diff)} ${pluralDays(diff)} назад`;
}

/** Стиль для крупного числа обратного счёта («дней прошло»): чем больше — тем увереннее зелёный. */
function elapsedStyle(elapsed: number) {
  if (elapsed < 0) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
  if (elapsed === 0) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
  return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
}

export default function EventCardView({ card }: { card: EventCard }) {
  const eventDate = card.date ? parseIsoDate(card.date) : null;
  const diff = eventDate ? daysFromToday(eventDate) : null;
  const isElapsed = card.counterMode === 'elapsed';

  if (isElapsed) {
    const elapsed = diff === null ? null : -diff;
    const style = elapsed === null ? counterStyle(null) : elapsedStyle(elapsed);
    return (
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" /> {card.title}
            </h3>
            {card.subtitle && <p className="text-[11px] text-[#a1a1aa] mt-1.5">{card.subtitle}</p>}
          </div>
        </div>
        {elapsed === null ? (
          <div className="mt-3 h-[64px] flex items-center justify-center text-xs text-[#71717a] border border-dashed border-[#27272a] rounded-xl">
            Дата не указана
          </div>
        ) : elapsed < 0 ? (
          <div className={`mt-3 px-3 py-2.5 rounded-xl border ${style.bg} ${style.border}`}>
            <p className={`text-xs font-semibold ${style.text}`}>Ещё не наступило — через {Math.abs(elapsed)} {pluralDays(elapsed)}</p>
          </div>
        ) : (
          <div className={`mt-3 flex items-baseline gap-2 px-3 py-2.5 rounded-xl border ${style.bg} ${style.border}`}>
            <span className={`text-4xl font-extrabold font-mono tabular-nums ${style.text}`}>{elapsed}</span>
            <span className="text-xs font-semibold text-zinc-300">{pluralDays(elapsed)} прошло без нарушений</span>
          </div>
        )}
        {eventDate && (
          <p className="text-[11px] text-[#71717a] mt-3">
            С {eventDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>
    );
  }

  const style = counterStyle(diff);
  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display leading-relaxed">
            <CalendarClock className="w-4 h-4 text-indigo-400 flex-shrink-0" /> {card.title}
          </h3>
          {card.subtitle && <p className="text-[11px] text-[#a1a1aa] mt-1.5">{card.subtitle}</p>}
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-md border whitespace-nowrap ${style.text} ${style.bg} ${style.border}`}>
          {counterLabel(diff)}
        </span>
      </div>
      {eventDate && (
        <p className="text-[11px] text-[#71717a] mt-3">
          {eventDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}

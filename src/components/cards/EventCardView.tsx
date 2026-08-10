import { CalendarClock } from 'lucide-react';
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

export default function EventCardView({ card }: { card: EventCard }) {
  const eventDate = card.date ? parseIsoDate(card.date) : null;
  const diff = eventDate ? daysFromToday(eventDate) : null;
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

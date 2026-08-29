import { CalendarClock, ShieldCheck } from 'lucide-react';
import { EventCard } from '../../types';
import {
  countdownLabel,
  countdownStyle,
  daysFromToday,
  elapsedStyle,
  parseIsoDate,
  pluralDays,
} from './eventCounter';

export default function EventCardView({ card }: { card: EventCard }) {
  const eventDate = card.date ? parseIsoDate(card.date) : null;
  const diff = eventDate ? daysFromToday(eventDate) : null;
  const isElapsed = card.counterMode === 'elapsed';

  if (isElapsed) {
    const elapsed = diff === null ? null : -diff;
    const style = elapsedStyle(elapsed);
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

  const style = countdownStyle(diff);
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
          {countdownLabel(diff)}
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

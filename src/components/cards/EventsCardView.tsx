import { useMemo } from 'react';
import { CalendarClock, CalendarOff, CheckCircle2, Flame, ShieldCheck } from 'lucide-react';
import { EventsCard } from '../../types';
import {
  countdownLabel,
  countdownStyle,
  CounterStyle,
  daysFromToday,
  elapsedStyle,
  parseIsoDate,
  pluralDays,
} from './eventCounter';

type RowStatus = 'past' | 'next' | 'future' | 'elapsed' | 'undated';

interface Row {
  title: string;
  dateObj: Date | null;
  /** Дней до даты: >0 впереди, 0 сегодня, <0 позади. null — даты нет. */
  diff: number | null;
  status: RowStatus;
}

export default function EventsCardView({ card }: { card: EventsCard }) {
  const rows = useMemo<Row[]>(() => {
    const dated: Row[] = [];
    const undated: Row[] = [];

    for (const item of card.items) {
      const dateObj = parseIsoDate(item.date);
      const diff = dateObj ? daysFromToday(dateObj) : null;
      // Событие без даты раньше просто исчезало из карточки — теперь остаётся
      // видимым в конце списка, чтобы дату не забыли проставить.
      if (!dateObj) {
        undated.push({ title: item.title, dateObj: null, diff: null, status: 'undated' });
        continue;
      }
      // Обратный счёт («сколько дней прошло») — такой же режим, как в одиночной
      // карточке «Событие»: это не веха в будущем, а растущий счётчик.
      if (item.counterMode === 'elapsed') {
        dated.push({ title: item.title, dateObj, diff, status: 'elapsed' });
        continue;
      }
      dated.push({ title: item.title, dateObj, diff, status: diff < 0 ? 'past' : 'future' });
    }

    dated.sort((a, b) => (a.dateObj as Date).getTime() - (b.dateObj as Date).getTime());

    // «Ближайшее» — первое ещё не наступившее событие обычного счёта.
    const nextIdx = dated.findIndex((r) => r.status === 'future');
    if (nextIdx !== -1) dated[nextIdx] = { ...dated[nextIdx], status: 'next' };

    return [...dated, ...undated];
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
          Нет событий
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((e, i) => {
            const elapsed = e.diff === null ? null : -e.diff;
            let badge;
            let rowStyle = 'text-zinc-300';
            let counter: { label: string; style: CounterStyle } | null = null;

            if (e.status === 'undated') {
              badge = (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 bg-zinc-800/40 px-2 py-0.5 rounded-md border border-zinc-700/20">
                  <CalendarOff className="w-3 h-3" /> Дата не указана
                </span>
              );
              rowStyle = 'text-zinc-500';
            } else if (e.status === 'elapsed') {
              badge = (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" /> Обратный счёт
                </span>
              );
              rowStyle = 'text-white font-medium';
              counter = {
                style: elapsedStyle(elapsed),
                label:
                  elapsed === null
                    ? '—'
                    : elapsed < 0
                    ? `через ${Math.abs(elapsed)} ${pluralDays(elapsed)}`
                    : `${elapsed} ${pluralDays(elapsed)} прошло`,
              };
            } else if (e.status === 'past') {
              badge = (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 bg-zinc-800/40 px-2 py-0.5 rounded-md border border-zinc-700/20">
                  <CheckCircle2 className="w-3 h-3" /> Завершено
                </span>
              );
              rowStyle = 'opacity-40 line-through text-zinc-500';
              counter = { style: countdownStyle(e.diff), label: countdownLabel(e.diff) };
            } else if (e.status === 'next') {
              badge = (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <Flame className="w-3 h-3" /> Ближайшее
                </span>
              );
              rowStyle = 'text-white font-medium';
              counter = { style: countdownStyle(e.diff), label: countdownLabel(e.diff) };
            } else {
              badge = (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                  Планируется
                </span>
              );
              counter = { style: countdownStyle(e.diff), label: countdownLabel(e.diff) };
            }

            return (
              <div
                key={i}
                className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2 rounded-lg border border-[#1f1f23] ${rowStyle}`}
              >
                <span className="truncate text-sm min-w-0 flex-1">{e.title || 'Без названия'}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {counter && (
                    <span
                      className={`text-[11px] font-bold font-mono tabular-nums px-2 py-0.5 rounded-md border whitespace-nowrap ${counter.style.text} ${counter.style.bg} ${counter.style.border}`}
                    >
                      {counter.label}
                    </span>
                  )}
                  {e.dateObj && <span className="text-xs font-mono text-zinc-400">{e.dateObj.toLocaleDateString('ru-RU')}</span>}
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

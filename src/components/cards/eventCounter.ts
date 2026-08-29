// Счётчик дней для карточек «Событие» и «Список событий» — общий, чтобы обе
// карточки считали и подписывали дни одинаково.

export function parseIsoDate(iso: string): Date | null {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function pluralDays(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
}

/** Сколько дней от сегодня до даты: >0 — впереди, 0 — сегодня, <0 — позади. */
export function daysFromToday(eventDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(eventDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export interface CounterStyle {
  text: string;
  bg: string;
  border: string;
}

/** Оформление счётчика «сколько осталось до события». */
export function countdownStyle(diff: number | null): CounterStyle {
  if (diff === null || diff < 0) return { text: 'text-zinc-400', bg: 'bg-zinc-800/40', border: 'border-zinc-700/30' };
  if (diff === 0) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
  if (diff <= 7) return { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
  return { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' };
}

/** Оформление обратного счёта «сколько дней прошло»: чем дольше без событий — тем зеленее. */
export function elapsedStyle(elapsed: number | null): CounterStyle {
  if (elapsed === null) return { text: 'text-zinc-400', bg: 'bg-zinc-800/40', border: 'border-zinc-700/30' };
  if (elapsed <= 0) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
  return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
}

export function countdownLabel(diff: number | null): string {
  if (diff === null) return 'Дата не указана';
  if (diff === 0) return 'Сегодня';
  if (diff > 0) return `Через ${diff} ${pluralDays(diff)}`;
  return `${Math.abs(diff)} ${pluralDays(diff)} назад`;
}

/** Подпись обратного счёта. elapsed = сколько дней прошло от даты. */
export function elapsedLabel(elapsed: number | null): string {
  if (elapsed === null) return 'Дата не указана';
  if (elapsed === 0) return 'Отсчёт с сегодня';
  if (elapsed < 0) return `Ещё не наступило — через ${Math.abs(elapsed)} ${pluralDays(elapsed)}`;
  return `${elapsed} ${pluralDays(elapsed)} без происшествий`;
}

import { TableCard } from '../../types';

/** Границы разумной ширины столбца: уже 60 px текст не читается, шире 900 px
 *  таблица перестаёт помещаться даже на широком экране. */
export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 900;
/** Сколько места отводим столбцу без заданной ширины при подсчёте минимальной
 *  ширины таблицы (сам столбец при этом остаётся резиновым). */
const AUTO_COLUMN_WIDTH = 120;

export const clampColumnWidth = (value: number): number =>
  Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(value)));

/** Ширина столбца в пикселях или null, если она не задана (авто). */
export function columnWidthAt(card: TableCard, index: number): number | null {
  const raw = card.columnWidths?.[index];
  if (raw == null) return null;
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? clampColumnWidth(num) : null;
}

export const hasColumnWidths = (card: TableCard): boolean =>
  card.headers.some((_, i) => columnWidthAt(card, i) !== null);

/** Минимальная ширина таблицы: заданные ширины должны сохраняться, а не
 *  сжиматься под узкую карточку — если не помещаются, появляется прокрутка. */
export const tableMinWidth = (card: TableCard): number =>
  card.headers.reduce((acc, _, i) => acc + (columnWidthAt(card, i) ?? AUTO_COLUMN_WIDTH), 0);

/** Ширины, выровненные по столбцам: используется при добавлении и удалении. */
export const fitColumnWidths = (
  headers: string[],
  widths?: (number | null)[]
): (number | null)[] => headers.map((_, i) => widths?.[i] ?? null);

/** Массив ширин или undefined, если все столбцы автоматические — в данных
 *  карточки не должно оставаться пустых массивов. */
export const normalizeColumnWidths = (widths: (number | null)[]): (number | null)[] | undefined =>
  widths.some((w) => w != null) ? widths : undefined;

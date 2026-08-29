import { TableCard, TableCellColor } from '../../types';

/** Порядок цветов в палитре редактора. */
export const TABLE_CELL_COLORS: TableCellColor[] = ['none', 'emerald', 'amber', 'rose', 'sky', 'violet', 'slate'];

interface CellStyle {
  /** Классы для ячейки таблицы в карточке. */
  cell: string;
  /** Заливка образца в палитре (без прозрачности — чтобы цвет читался). */
  swatch: string;
}

const STYLES: Record<TableCellColor, CellStyle> = {
  none: { cell: '', swatch: 'bg-[#161619] border-[#3f3f46]' },
  emerald: { cell: 'bg-emerald-500/15 text-emerald-200', swatch: 'bg-emerald-500 border-emerald-400' },
  amber: { cell: 'bg-amber-500/15 text-amber-200', swatch: 'bg-amber-500 border-amber-400' },
  rose: { cell: 'bg-rose-500/15 text-rose-200', swatch: 'bg-rose-500 border-rose-400' },
  sky: { cell: 'bg-sky-500/15 text-sky-200', swatch: 'bg-sky-500 border-sky-400' },
  violet: { cell: 'bg-violet-500/15 text-violet-200', swatch: 'bg-violet-500 border-violet-400' },
  slate: { cell: 'bg-zinc-500/20 text-zinc-200', swatch: 'bg-zinc-500 border-zinc-400' },
};

export function cellColorClass(color: TableCellColor | undefined): string {
  return STYLES[color || 'none'].cell;
}

export function swatchClass(color: TableCellColor): string {
  return STYLES[color].swatch;
}

/** Цвет ячейки тела таблицы; «none», если заливки нет. */
export function cellColorAt(card: TableCard, row: number, col: number): TableCellColor {
  return card.cellColors?.[row]?.[col] || 'none';
}

/** Цвет ячейки строки заголовков. */
export function headerColorAt(card: TableCard, col: number): TableCellColor {
  return card.headerColors?.[col] || 'none';
}

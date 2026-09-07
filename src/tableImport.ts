// Разбор xlsx/xls/csv для карточки «Таблица».
//
// Реальные файлы редко выглядят как «первая строка — заголовки, дальше данные»:
// в книге несколько листов, сверху шапка отчёта, ячейки объединены, даты лежат
// числами, а проценты — долями. Раньше импорт брал первый лист и первую строку
// как есть, поэтому в карточку попадали «46232» вместо «01.09.2026» и пустые
// заголовки. Здесь лист разбирается целиком и отдаётся редактору вместе с
// вариантами, из которых сотрудник выбирает нужный.
import * as XLSX from 'xlsx';
import { TableCellColor } from './types';

export interface ImportedSheet {
  name: string;
  /** Строки листа как текст (объединённые ячейки уже размножены, пустые края обрезаны). */
  rows: string[][];
  /** Заливка ячеек Excel, приведённая к палитре карточки; выровнена по rows. */
  colors: TableCellColor[][];
  /** Строка, больше всего похожая на строку заголовков (индекс в rows). */
  headerRow: number;
  /** Сколько ячеек с заливкой нашлось — по нему решаем, предлагать ли перенос цвета. */
  colored: number;
}

export interface ParsedWorkbook {
  sheets: ImportedSheet[];
}

const MAX_HEADER_SEARCH_ROWS = 15;

const pad = (n: number) => String(n).padStart(2, '0');

/** Дата в привычном виде: 01.09.2026, со временем — только если оно ненулевое. */
function formatDate(d: Date): string {
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const h = d.getHours();
  const m = d.getMinutes();
  return h === 0 && m === 0 ? date : `${date} ${pad(h)}:${pad(m)}`;
}

/** Текст ячейки так, как её показывает Excel. */
function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell) return '';
  if (cell.v instanceof Date) return formatDate(cell.v);
  // cell.w — отформатированное значение (проценты, разделители, даты). Именно
  // его видит сотрудник в Excel, поэтому берём его, а не сырое число.
  const text = cell.w != null ? String(cell.w) : cell.v == null ? '' : String(cell.v);
  // Перевод строки внутри ячейки Excel хранит как \r\n — в карточке текст
  // переносится по словам, и лишние \r рисовались бы пустыми символами.
  return text.replace(/\r\n?/g, '\n').trim();
}

// ---------------------------------------------------------------------------
// Заливка ячеек Excel → палитра карточки
// ---------------------------------------------------------------------------

/** Оттенок (0–360), насыщенность как размах каналов и светлота. */
function decompose(rgb: string): { hue: number; chroma: number; light: number } | null {
  const hex = rgb.length === 8 ? rgb.slice(2) : rgb; // ARGB → RGB
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const light = (max + min) / 2;
  if (chroma === 0) return { hue: 0, chroma, light };
  let hue: number;
  if (max === r) hue = 60 * (((g - b) / chroma) % 6);
  else if (max === g) hue = 60 * ((b - r) / chroma + 2);
  else hue = 60 * ((r - g) / chroma + 4);
  return { hue: (hue + 360) % 360, chroma, light };
}

/** Ближайший цвет палитры карточки. Белая и «бумажная» заливка — без цвета.
 *  Серость считаем по размаху каналов, а не по насыщенности: у почти белого
 *  бежевого (EEECE1) насыщенность формально высокая, а цвета в нём нет. */
export function nearestCellColor(rgb: string | undefined): TableCellColor {
  if (!rgb) return 'none';
  const c = decompose(rgb);
  if (!c) return 'none';
  if (c.light > 0.93) return 'none'; // белый фон листа
  if (c.chroma < 0.12) return c.light < 0.75 ? 'slate' : 'none'; // серый и бежевый
  if (c.hue >= 30 && c.hue < 75) return 'amber';
  if (c.hue >= 75 && c.hue < 170) return 'emerald';
  if (c.hue >= 170 && c.hue < 250) return 'sky';
  if (c.hue >= 250 && c.hue < 320) return 'violet';
  return 'rose';
}

function fillOf(cell: XLSX.CellObject | undefined): TableCellColor {
  const style = (cell as { s?: { patternType?: string; fgColor?: { rgb?: string } } } | undefined)?.s;
  if (!style || !style.patternType || style.patternType === 'none') return 'none';
  return nearestCellColor(style.fgColor?.rgb);
}

// ---------------------------------------------------------------------------
// Разбор листа
// ---------------------------------------------------------------------------

function parseSheet(name: string, sheet: XLSX.WorkSheet, fillMerged: boolean): ImportedSheet {
  const ref = sheet['!ref'];
  if (!ref) return { name, rows: [], colors: [], headerRow: 0, colored: 0 };
  const range = XLSX.utils.decode_range(ref);

  const rows: string[][] = [];
  const colors: TableCellColor[][] = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row: string[] = [];
    const rowColors: TableCellColor[] = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      row.push(cellText(cell));
      rowColors.push(fillOf(cell));
    }
    rows.push(row);
    colors.push(rowColors);
  }

  // Объединённая ячейка хранит значение только в левом верхнем углу — остальные
  // приходят пустыми. Для плоской таблицы значение размножаем на весь диапазон,
  // иначе шапка отчёта рассыпается на пустые столбцы.
  if (fillMerged) {
    for (const merge of sheet['!merges'] || []) {
      const value = rows[merge.s.r - range.s.r]?.[merge.s.c - range.s.c] ?? '';
      const color = colors[merge.s.r - range.s.r]?.[merge.s.c - range.s.c] ?? 'none';
      if (!value && color === 'none') continue;
      for (let r = merge.s.r; r <= merge.e.r; r += 1) {
        for (let c = merge.s.c; c <= merge.e.c; c += 1) {
          const ri = r - range.s.r;
          const ci = c - range.s.c;
          if (!rows[ri] || rows[ri][ci] === undefined) continue;
          if (!rows[ri][ci]) rows[ri][ci] = value;
          if (colors[ri][ci] === 'none') colors[ri][ci] = color;
        }
      }
    }
  }

  const trimmed = trimEmpty(rows, colors);
  return {
    name,
    rows: trimmed.rows,
    colors: trimmed.colors,
    headerRow: guessHeaderRow(trimmed.rows),
    colored: trimmed.colors.reduce((acc, row) => acc + row.filter((c) => c !== 'none').length, 0),
  };
}

/** Пустые строки и столбцы по краям листа в карточке не нужны. */
function trimEmpty(rows: string[][], colors: TableCellColor[][]) {
  const width = rows.reduce((acc, r) => Math.max(acc, r.length), 0);
  const rowHasData = rows.map((r) => r.some((v) => v !== ''));
  const colHasData = Array.from({ length: width }, (_, c) => rows.some((r) => (r[c] || '') !== ''));

  let top = rowHasData.indexOf(true);
  let bottom = rowHasData.lastIndexOf(true);
  let left = colHasData.indexOf(true);
  let right = colHasData.lastIndexOf(true);
  if (top === -1 || left === -1) return { rows: [], colors: [] };

  const cut = <T,>(grid: T[][], empty: T): T[][] =>
    grid.slice(top, bottom + 1).map((row) => {
      const next: T[] = [];
      for (let c = left; c <= right; c += 1) next.push(row[c] === undefined ? empty : row[c]);
      return next;
    });

  return { rows: cut(rows, ''), colors: cut(colors, 'none' as TableCellColor) };
}

/** Строка заголовков: самая заполненная из первых строк листа (раньше — лучше). */
function guessHeaderRow(rows: string[][]): number {
  const window = rows.slice(0, MAX_HEADER_SEARCH_ROWS);
  if (!window.length) return 0;
  const filled = window.map((r) => r.filter((v) => v !== '').length);
  const best = Math.max(...filled);
  if (best < 2) return 0;
  const threshold = Math.max(2, Math.round(best * 0.6));
  const idx = filled.findIndex((n) => n >= threshold);
  return idx === -1 ? 0 : idx;
}

// ---------------------------------------------------------------------------
// Точка входа
// ---------------------------------------------------------------------------

export function parseTableFile(
  data: ArrayBuffer | string,
  { isCsv, fillMerged = true }: { isCsv: boolean; fillMerged?: boolean }
): ParsedWorkbook {
  // .csv читаем как UTF-8 текст (type: 'string') — иначе SheetJS определяет
  // кодировку по сырым байтам и кириллица без BOM превращается в кракозябры.
  const wb = isCsv
    ? XLSX.read(data as string, { type: 'string' })
    : XLSX.read(data as ArrayBuffer, { type: 'array', cellDates: true, cellStyles: true });

  const sheets = wb.SheetNames.map((name) => parseSheet(name, wb.Sheets[name], fillMerged)).filter(
    (s) => s.rows.length > 0
  );
  return { sheets };
}

import { NoteColor } from '../../types';

export const NOTE_COLORS: NoteColor[] = ['yellow', 'pink', 'green', 'blue', 'violet', 'orange', 'gray'];

/** Пастельные «бумажные» стикеры — как на общем стенде: светлая заливка,
 *  чуть более плотная полоса сверху и тонкая рамка. */
export const NOTE_STYLES: Record<NoteColor, { bg: string; strip: string; border: string }> = {
  yellow: { bg: '#fffbe3', strip: '#fdf6c8', border: '#e3d64c' },
  pink: { bg: '#fde1e3', strip: '#fbd4d8', border: '#f0a3ab' },
  green: { bg: '#e6f6e3', strip: '#d5efd0', border: '#9fd49a' },
  blue: { bg: '#e2f0fb', strip: '#cfe5f7', border: '#93c4ea' },
  violet: { bg: '#efe6fb', strip: '#e2d4f7', border: '#bea3ea' },
  orange: { bg: '#ffeedd', strip: '#fde1c4', border: '#f2b67a' },
  gray: { bg: '#f2f2f4', strip: '#e5e5e9', border: '#c4c4cc' },
};

export const NOTE_TEXT_COLOR = '#3f3f46';

export const DEFAULT_NOTE_WIDTH = 300;
export const MIN_NOTE_WIDTH = 180;
export const MAX_NOTE_WIDTH = 1400;
export const MIN_NOTE_HEIGHT = 110;
export const MAX_NOTE_HEIGHT = 1400;

export const DEFAULT_COLUMN_WIDTH = 380;
export const MIN_COLUMN_WIDTH = 240;
export const MAX_COLUMN_WIDTH = 1800;

export const clamp = (v: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, v)));

/** Сегодняшняя дата в формате поля «актуально до» (по местному времени). */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

/** Перетаскивание за уголок/край: сообщаем новый размер на каждое движение
 *  и итоговый — когда кнопку отпустили. */
export function startPointerDrag(
  e: React.PointerEvent,
  onMove: (dx: number, dy: number) => void,
  onEnd: (dx: number, dy: number) => void
) {
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX;
  const startY = e.clientY;
  const move = (ev: PointerEvent) => onMove(ev.clientX - startX, ev.clientY - startY);
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    document.body.style.userSelect = '';
    onEnd(ev.clientX - startX, ev.clientY - startY);
  };
  document.body.style.userSelect = 'none';
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

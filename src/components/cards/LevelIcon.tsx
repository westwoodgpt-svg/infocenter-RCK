import { TableCard } from '../../types';

/** Уровни, которые рисуются значком: 0 — пустой кружок, 4 — закрашенный. */
export const MAX_LEVEL = 4;

/** Число уровня из текста ячейки или null, если это не уровень 0–4. */
export function parseLevel(text: string): number | null {
  const trimmed = String(text ?? '').trim();
  if (!/^[0-4]$/.test(trimmed)) return null;
  return Number(trimmed);
}

/** Включены ли значки для этого столбца. */
export const iconColumnAt = (card: TableCard, col: number): boolean => Boolean(card.iconColumns?.[col]);

export const hasIconColumns = (card: TableCard): boolean => Boolean(card.iconColumns?.some(Boolean));

// Доля круга для каждого уровня. Классическая «гарвардская» шкала: сколько
// закрашено — столько и освоено.
const WEDGE: Record<number, string | null> = {
  0: null,
  1: 'M8,8 L8,1 A7,7 0 0 1 15,8 Z',
  2: 'M8,8 L8,1 A7,7 0 0 1 8,15 Z',
  3: 'M8,8 L8,1 A7,7 0 1 1 1,8 Z',
  4: null, // закрашивается целиком
};

interface Props {
  level: number;
  /** Размер в пикселях: в карточке крупнее, в редакторе мельче. */
  size?: number;
  title?: string;
}

/** Значок-«пирог» уровня освоения компетенции. Цвет наследуется от ячейки,
 *  поэтому заливка столбца и подсветка строки продолжают работать. */
export default function LevelIcon({ level, size = 16, title }: Props) {
  const wedge = WEDGE[level];
  const label = title || `уровень ${level}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role="img"
      aria-label={label}
      className="inline-block flex-shrink-0 align-[-0.15em]"
    >
      <title>{label}</title>
      <circle cx="8" cy="8" r="7" fill={level === MAX_LEVEL ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" opacity={level === 0 ? 0.45 : 1} />
      {wedge && <path d={wedge} fill="currentColor" />}
    </svg>
  );
}

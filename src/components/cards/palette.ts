export const SERIES_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'];

export function colorFor(index: number) {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

/** Цвет ряда с учётом ручного переопределения (seriesColors), иначе — палитра по умолчанию. */
export function seriesColorFor(customColors: (string | undefined)[] | undefined, index: number) {
  return customColors?.[index] || colorFor(index);
}

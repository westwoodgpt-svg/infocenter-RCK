export const SERIES_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'];

export function colorFor(index: number) {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

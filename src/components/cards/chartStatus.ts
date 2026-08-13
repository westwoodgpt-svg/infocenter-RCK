import { AnyCard, CardIndicator, ChartCard } from '../../types';

/** Индекс первого ряда, отмеченного как линия плана (seriesAsLine), либо null. */
export function planSeriesIndex(card: ChartCard): number | null {
  if (!card.seriesAsLine) return null;
  const idx = card.seriesAsLine.findIndex(Boolean);
  return idx === -1 ? null : idx;
}

/** Есть ли хотя бы одна категория, где столбец факта отстаёт от плановой линии. */
export function isChartBelowPlan(card: ChartCard): boolean {
  if (card.chartType !== 'bar' || !card.highlightBelowPlan) return false;
  const planIdx = planSeriesIndex(card);
  if (planIdx === null) return false;
  return card.rows.some((row) => {
    const planValue = row.values[planIdx];
    if (planValue === undefined) return false;
    return card.seriesNames.some((_, i) => {
      if (i === planIdx) return false;
      const v = row.values[i];
      return v !== undefined && v < planValue;
    });
  });
}

/** Итоговый индикатор карточки с учётом автоматической подсветки отставания от плана
 *  (для графиков с включённым highlightBelowPlan индикатор принудительно становится красным). */
export function effectiveIndicator(card: AnyCard): CardIndicator | undefined {
  if (card.type === 'chart' && card.indicator?.enabled && isChartBelowPlan(card)) {
    return { enabled: true, color: 'rose' };
  }
  return card.indicator;
}

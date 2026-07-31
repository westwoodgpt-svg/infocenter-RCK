// Общие хелперы для приведения «сырых» значений полей Списка Б24 к простым
// JS-типам. Вынесены из App.tsx, чтобы ими мог пользоваться и общий
// рендерер графиков редактора (ChartCard), а не только встроенные вкладки.

export function extractPropValue(v: any): string {
  if (v === null || v === undefined) return '';

  if (Array.isArray(v)) {
    if (v.length === 0) return '';
    return extractPropValue(v[0]);
  }

  if (typeof v === 'object') {
    if ('VALUE' in v) return extractPropValue(v.VALUE);
    if ('TEXT' in v) return extractPropValue(v.TEXT);

    const keys = Object.keys(v);
    if (keys.length === 0) return '';
    return extractPropValue(v[keys[0]]);
  }

  return String(v).trim();
}

export function toNum(v: any, fallback = 0): number {
  if (v === '' || v === null || v === undefined) return fallback;
  const n = Number(extractPropValue(v));
  return isNaN(n) ? fallback : n;
}

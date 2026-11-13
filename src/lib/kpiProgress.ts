/**
 * Cuentas de un indicador con fechas: avance real contra el avance esperado por calendario, estado y proyección.
 * Código puro (sin servidor) para usarlo igual en pantalla, en el resumen y en las pruebas.
 */
export interface KpiLike { value: number; target: number | null; baseline?: number; startDate?: string; endDate?: string; direction?: 'up' | 'down'; history: { at: string; value: number }[] }
export type KpiStatus = 'done' | 'ahead' | 'on' | 'behind' | 'late' | 'none';
export interface KpiProgress {
  /** 0..100: cuánto del camino entre el arranque y la meta ya se recorrió (puede pasar de 100 si lo superó). */
  pct: number | null;
  /** 0..100: cuánto del tiempo ya pasó (null si no hay fechas). */
  timePct: number | null;
  daysLeft: number | null; daysTotal: number | null;
  status: KpiStatus;
  /** Valor al que llegaría a la fecha de fin si sigue al ritmo de hasta hoy (null si no se puede estimar). */
  projected: number | null; projectedPct: number | null;
}
const DAY = 86400000;
const day = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z');
export function kpiProgress(k: KpiLike, today: string): KpiProgress {
  const start = k.baseline ?? (k.history.length ? k.history[0].value : k.value);
  let pct: number | null = null;
  if (k.target !== null && k.target !== start) pct = Math.max(0, ((k.value - start) / (k.target - start)) * 100);
  else if (k.target !== null) pct = k.value === k.target ? 100 : 0;
  let timePct: number | null = null, daysLeft: number | null = null, daysTotal: number | null = null;
  const s = k.startDate ? day(k.startDate) : null, e = k.endDate ? day(k.endDate) : null, t = day(today);
  if (e !== null) { daysLeft = Math.round((e - t) / DAY); }
  if (s !== null && e !== null && e > s) { daysTotal = Math.round((e - s) / DAY); timePct = Math.min(100, Math.max(0, ((t - s) / (e - s)) * 100)); }
  let status: KpiStatus = 'none';
  if (pct !== null) {
    if (pct >= 100) status = 'done';
    else if (daysLeft !== null && daysLeft < 0) status = 'late';
    else if (timePct !== null) { const gap = pct - timePct; status = gap >= 10 ? 'ahead' : gap >= -10 ? 'on' : 'behind'; }
  }
  let projected: number | null = null, projectedPct: number | null = null;
  if (s !== null && e !== null && e > s && t > s && k.target !== null) {
    const elapsed = Math.min(t, e) - s, gained = k.value - start;
    projected = Math.round((start + (gained / elapsed) * (e - s)) * 100) / 100;
    projectedPct = k.target !== start ? Math.max(0, ((projected - start) / (k.target - start)) * 100) : null;
  }
  return { pct, timePct, daysLeft, daysTotal, status, projected, projectedPct };
}

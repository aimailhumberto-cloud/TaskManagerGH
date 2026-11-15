/**
 * Calibración de Jev (fase 5, etapa 5.0b): ¿acierta cuando duda? Solo lee; no cambia nada.
 * El umbral de Jev (0.6) se puso a ojo. Pero cada caso ya guarda lo que Jev dijo (obs.jev) y lo que pasó después
 * (aprobado igual, descartado, corregido, deshecho en el diario). Cruzando las dos cosas se ve:
 *   - cuántas esperas causó Jev y cuántas de ellas la persona aprobó tal cual (aprobaciones de más);
 *   - si hubo cambios con puntaje alto de Jev que luego se deshicieron (Jev dejó pasar algo malo).
 * Puro: recibe los casos y los cambios deshechos; no toca archivos.
 */
import type { CerebroRequest } from './engine';

export type Outcome = 'aplicado_solo' | 'aprobado' | 'descartado' | 'corregido' | 'abierto' | 'deshecho';
export interface Bucket { puntaje: 0 | 1 | 2 | 3; n: number; aplicado_solo: number; aprobado: number; descartado: number; corregido: number; abierto: number; deshecho: number }
export interface JevCalibration {
  /** Casos en los que Jev dio puntaje / casos donde no respondió. */
  conPuntaje: number; sinPuntaje: number;
  umbral: number;
  porPuntaje: Bucket[];
  /** Esperas que causó Jev (el motivo de la espera dice que Jev dudó o tuvo poca seguridad). */
  esperasPorJev: { total: number; aprobadas: number; descartadas: number; corregidas: number; abiertas: number };
  /** Cambios con puntaje de Jev al menos igual al umbral que después se deshicieron: lo que Jev dejó pasar. */
  deshechosConJevAlto: number;
  /** Promedio de seguridad (0–1) de Jev, por resultado; null si todavía no hay datos de seguridad. */
  seguridad: { aprobadas: number | null; descartadas: number | null };
  /** Promedio de la prueba nativa (noul) por resultado; null si todavía no hay datos. */
  noul: { aprobadas: number | null; descartadas: number | null; deshechas: number | null };
  /** Umbral sugerido (o null si no hay base para cambiarlo) y las lecturas en palabras. */
  umbralSugerido: number | null;
  lecturas: string[];
  advertencias: string[];
}

const JEV_WAIT = /(Jev no est[aá] seguro|Jev is not sure|poca seguridad|low confidence|revisi[oó]n de Jev es obligatoria|Jev.s review is mandatory)/i;
const mean = (a: number[]) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 100) / 100 : null);
const idsOf = (r: CerebroRequest) => [r.changeId, r.partial?.changeId].filter(Boolean) as string[];

/** Qué pasó al final con un caso. null si no cuenta (no pasó por una decisión: sin cambios, no entendido, fallo, consulta). */
export function outcomeOf(r: CerebroRequest, undone: Set<string>): Outcome | null {
  if (r.status === 'aplicado') { if (idsOf(r).some(id => undone.has(id))) return 'deshecho'; return r.decidedBy ? 'aprobado' : 'aplicado_solo'; }
  if (r.status === 'rechazado' || r.status === 'cancelado') return 'descartado';
  if (r.status === 'reemplazado') return 'corregido';
  if (r.status === 'pendiente' || r.status === 'pregunta') return 'abierto';
  return null;
}

/** El análisis. `undone` = ids de cambios del diario que se deshicieron. */
export function calibrate(requests: CerebroRequest[], undone: Set<string> = new Set(), threshold = 0.6): JevCalibration {
  const buckets: Bucket[] = ([0, 1, 2, 3] as const).map(p => ({ puntaje: p, n: 0, aplicado_solo: 0, aprobado: 0, descartado: 0, corregido: 0, abierto: 0, deshecho: 0 }));
  const out: JevCalibration = { conPuntaje: 0, sinPuntaje: 0, umbral: threshold, porPuntaje: buckets, esperasPorJev: { total: 0, aprobadas: 0, descartadas: 0, corregidas: 0, abiertas: 0 }, deshechosConJevAlto: 0,
    seguridad: { aprobadas: null, descartadas: null }, noul: { aprobadas: null, descartadas: null, deshechas: null }, umbralSugerido: null, lecturas: [], advertencias: [] };
  const seg = { ap: [] as number[], de: [] as number[] }, nou = { ap: [] as number[], de: [] as number[], un: [] as number[] };
  const waitsByBucket: Record<number, { aprobadas: number; resueltas: number }> = { 0: { aprobadas: 0, resueltas: 0 }, 1: { aprobadas: 0, resueltas: 0 }, 2: { aprobadas: 0, resueltas: 0 }, 3: { aprobadas: 0, resueltas: 0 } };
  for (const r of requests) {
    const j = r.obs?.jev; if (!j) continue;
    const o = outcomeOf(r, undone); if (!o) continue;
    if (typeof j.fiel !== 'number') { out.sinPuntaje++; continue; }
    out.conPuntaje++;
    const b = buckets[Math.max(0, Math.min(3, Math.round(j.fiel * 3)))]; b.n++; b[o]++;
    const porJev = JEV_WAIT.test(r.why || '') || (r.waitWhy || []).some(w => JEV_WAIT.test(w));
    if (porJev) {
      out.esperasPorJev.total++;
      if (o === 'aprobado' || o === 'deshecho') { out.esperasPorJev.aprobadas++; waitsByBucket[b.puntaje].aprobadas++; waitsByBucket[b.puntaje].resueltas++; }
      else if (o === 'descartado') { out.esperasPorJev.descartadas++; waitsByBucket[b.puntaje].resueltas++; }
      else if (o === 'corregido') { out.esperasPorJev.corregidas++; waitsByBucket[b.puntaje].resueltas++; }
      else out.esperasPorJev.abiertas++;
    }
    if (o === 'deshecho' && j.fiel >= threshold && !porJev) out.deshechosConJevAlto++;
    if (typeof j.seguridad === 'number') { if (o === 'aprobado') seg.ap.push(j.seguridad); if (o === 'descartado') seg.de.push(j.seguridad); }
    if (typeof j.noul === 'number') { if (o === 'aprobado' || o === 'aplicado_solo') nou.ap.push(j.noul); if (o === 'descartado') nou.de.push(j.noul); if (o === 'deshecho') nou.un.push(j.noul); }
  }
  out.seguridad = { aprobadas: mean(seg.ap), descartadas: mean(seg.de) };
  out.noul = { aprobadas: mean(nou.ap), descartadas: mean(nou.de), deshechas: mean(nou.un) };

  // ---- Lecturas ----
  const e = out.esperasPorJev; const resueltas = e.aprobadas + e.descartadas + e.corregidas;
  if (out.conPuntaje === 0) { out.advertencias.push('Todavía no hay casos con puntaje de Jev: no hay nada que calibrar.'); return out; }
  if (out.sinPuntaje) out.advertencias.push(`Jev no respondió en ${out.sinPuntaje} caso(s): en esos el plan siguió solo con las reglas de la app.`);
  if (resueltas < 20) out.advertencias.push(`Muestra chica: solo ${resueltas} espera(s) por Jev resueltas. Con menos de 20 no conviene cambiar el umbral.`);
  if (e.total) out.lecturas.push(`Jev causó ${e.total} espera(s): ${e.aprobadas} aprobadas tal cual, ${e.descartadas} descartadas, ${e.corregidas} corregidas, ${e.abiertas} todavía abiertas.`);
  if (resueltas >= 5) {
    const rate = e.aprobadas / resueltas;
    out.lecturas.push(`De las esperas resueltas, ${Math.round(rate * 100)} % se aprobaron tal cual${rate >= 0.8 ? ': Jev está frenando de más (aprobaciones que no hacían falta).' : rate <= 0.3 ? ': Jev está frenando con razón.' : '.'}`);
  }
  if (out.deshechosConJevAlto) out.lecturas.push(`OJO: ${out.deshechosConJevAlto} cambio(s) con puntaje de Jev igual o mayor al umbral se deshicieron después. Jev dejó pasar algo: no bajes el umbral.`);
  // Sugerencia: solo si hay muestra, ningún cambio alto se deshizo, y el escalón de puntaje 1 (el que hoy frena) se aprueba casi siempre.
  const w1 = waitsByBucket[1];
  if (resueltas >= 20 && !out.deshechosConJevAlto && w1.resueltas >= 10 && w1.aprobadas / w1.resueltas >= 0.8 && threshold > 0.3) {
    out.umbralSugerido = 0.3;
    out.lecturas.push(`Sugerencia: bajar el umbral a 0.3 (solo frena el puntaje 0): el escalón «corresponde en parte» tuvo ${w1.resueltas} esperas y ${Math.round((w1.aprobadas / w1.resueltas) * 100)} % se aprobaron tal cual.`);
  }
  if (out.seguridad.aprobadas !== null && out.seguridad.descartadas !== null) out.lecturas.push(`Seguridad media de Jev: ${out.seguridad.aprobadas} en lo aprobado y ${out.seguridad.descartadas} en lo descartado${out.seguridad.descartadas < out.seguridad.aprobadas ? ' (separa: sirve exigir una seguridad mínima).' : ' (no separa: por ahora no sirve para decidir).'}`);
  if (out.noul.aprobadas !== null && out.noul.descartadas !== null) out.lecturas.push(`Prueba nativa (noul): ${out.noul.aprobadas} en lo aprobado y ${out.noul.descartadas} en lo descartado${out.noul.descartadas < out.noul.aprobadas ? ' (separa mejor o igual que el puntaje: vale la pena evaluarla como decisión).' : ' (no separa).'}`);
  return out;
}

const pc = (x: number, n: number) => (n ? `${Math.round((x / n) * 100)} %` : '—');
/** El informe en palabras, para el script. */
export function formatCalibration(c: JevCalibration): string {
  const L: string[] = [`CALIBRACIÓN DE JEV  (umbral actual ${c.umbral})`, `Casos con puntaje: ${c.conPuntaje} · sin respuesta de Jev: ${c.sinPuntaje}`, '',
    'Puntaje | casos | solos | aprobados | descartados | corregidos | abiertos | deshechos'];
  const name = ['0 No corresponde', '1 En parte', '2 Detalle menor', '3 Exacto'];
  for (const b of c.porPuntaje) L.push(`${name[b.puntaje].padEnd(16)}| ${String(b.n).padStart(5)} | ${String(b.aplicado_solo).padStart(5)} | ${String(b.aprobado).padStart(9)} | ${String(b.descartado).padStart(11)} | ${String(b.corregido).padStart(10)} | ${String(b.abierto).padStart(8)} | ${String(b.deshecho).padStart(8)}`);
  const e = c.esperasPorJev; L.push('', `Esperas causadas por Jev: ${e.total} (aprobadas ${pc(e.aprobadas, e.aprobadas + e.descartadas + e.corregidas)} de las resueltas)`);
  if (c.lecturas.length) L.push('', 'LECTURA', ...c.lecturas.map(x => `- ${x}`));
  if (c.advertencias.length) L.push('', 'ADVERTENCIAS', ...c.advertencias.map(x => `- ${x}`));
  L.push('', c.umbralSugerido !== null ? `Umbral sugerido: ${c.umbralSugerido} (se cambia en Ajustes; lo decide HB).` : 'Umbral sugerido: ninguno (sin base para cambiarlo).');
  return L.join('\n');
}

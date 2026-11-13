/**
 * Estructura del cuerpo de una ficha (fase 1):
 *   ## Estado actual  → pocas líneas que se reescriben: lo que hoy es verdad.
 *   ## Bitácora       → entradas con fecha y fuente, la más nueva arriba; solo se agregan.
 * Así una ficha no vuelve a decir a la vez «vigente: jueves 12» y «pasó al lunes 16» sin saber cuál manda.
 */
const LOG_RE = /^##\s+Bit[aá]cora\s*$/im;
const STATE_RE = /^##\s+Estado actual\s*$/im;

export function logLine(e: { date: string; type?: string; summary: string; source?: string; by?: string }): string {
  const clean = (t: string) => String(t || '').replace(/\s+/g, ' ').trim();
  const extra = [e.source && `fuente: ${clean(e.source)}`, e.by && `registró: ${clean(e.by)}`].filter(Boolean).join('; ');
  return `- **${e.date}** · ${clean(e.type || 'nota')} · ${clean(e.summary).slice(0, 1200)}${extra ? ` _(${extra})_` : ''}`;
}

/** Agrega una entrada a la bitácora (crea la sección al final si no existe). */
export function appendLog(body: string, line: string): string {
  const b = (body || '').replace(/\s+$/, '');
  const m = LOG_RE.exec(b);
  if (!m) return `${b}\n\n## Bitácora\n\n${line}\n`;
  const at = m.index + m[0].length;
  return `${b.slice(0, at)}\n\n${line}${b.slice(at).replace(/^\s*\n/, '\n')}\n`.replace(/\n{3,}/g, '\n\n');
}

/** Reescribe la sección «Estado actual» (la crea arriba, debajo del título, si no existe). */
export function setState(body: string, text: string): string {
  const b = (body || '').replace(/\s+$/, '');
  const section = `## Estado actual\n\n${String(text).trim()}\n`;
  const m = STATE_RE.exec(b);
  if (m) {
    const rest = b.slice(m.index + m[0].length);
    const next = rest.search(/^##\s+/m);
    return `${b.slice(0, m.index)}${section}${next >= 0 ? '\n' + rest.slice(next) : ''}`.replace(/\n{3,}/g, '\n\n') + (next >= 0 ? '\n' : '');
  }
  // Sin sección: va antes del primer «## » (debajo del título y su párrafo de entrada); si no hay, al final.
  const firstH2 = b.search(/^##\s+/m);
  if (firstH2 > 0) return `${b.slice(0, firstH2).replace(/\s+$/, '')}\n\n${section}\n${b.slice(firstH2)}\n`;
  if (firstH2 < 0 && /\S/.test(b)) return `${b}\n\n${section}`;
  return `${section}\n${b}\n`;
}

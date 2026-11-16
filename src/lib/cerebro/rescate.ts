/**
 * Rescate de llamadas a herramientas escritas como texto.
 * A veces el modelo arma bien la operación pero la entrega como TEXTO (un JSON en el contenido) en vez de como llamada a una
 * herramienta. Sin rescate, el motor lo toma por una pregunta y le enseña a la persona un JSON crudo («¿ficha: person-jenna…?»).
 * Aquí se reconoce ese JSON y se convierte en la llamada que debió ser. Solo se aceptan herramientas que existen en el menú
 * y se valida igual que cualquier otra (validateOp corre después): rescatar no salta ninguna revisión.
 * Lógica pura: no lee nada ni escribe nada.
 */

export interface RescuedCall { name: string; args: Record<string, unknown> }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Saca los bloques JSON de un texto: dentro de ``` o el texto entero si ya es JSON. */
function jsonBlocks(content: string): unknown[] {
  const out: unknown[] = []; const t = String(content || '').trim(); if (!t) return out;
  const tryParse = (x: string) => { try { out.push(JSON.parse(x)); return true; } catch { return false; } };
  const fenced = [...t.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)].map(m => m[1].trim());
  if (fenced.length) { for (const f of fenced) tryParse(f); return out; }
  if (/^[[{]/.test(t)) tryParse(t);
  return out;
}

/** Dado el texto del modelo y los nombres de herramientas que existen, devuelve las llamadas que el texto contiene (o []). */
export function rescueToolCalls(content: string, toolNames: string[]): RescuedCall[] {
  const names = new Set(toolNames); const calls: RescuedCall[] = [];
  const take = (x: unknown) => {
    if (Array.isArray(x)) { for (const y of x) take(y); return; }
    if (!isObj(x)) return;
    // Forma 1: {name, arguments|args|parameters}; forma 2: {function:{name, arguments}}.
    const fn = isObj(x.function) ? x.function : x;
    const name = typeof fn.name === 'string' ? fn.name : (typeof (fn as any).tool === 'string' ? (fn as any).tool : '');
    const rawArgs = (fn as any).arguments ?? (fn as any).args ?? (fn as any).parameters;
    if (name && names.has(name)) {
      let args: unknown = rawArgs; if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = {}; } }
      if (isObj(args)) calls.push({ name, args }); return;
    }
    // Forma 3: los argumentos pelados de una anotación: {ficha, resumen}. Es la única que se reconoce sin nombre.
    if (names.has('registrar_novedad') && typeof x.ficha === 'string' && typeof x.resumen === 'string' && !('name' in x)) calls.push({ name: 'registrar_novedad', args: x });
  };
  for (const b of jsonBlocks(content)) take(b);
  return calls.slice(0, 20);
}

/**
 * Entrada tolerante del Cerebro: recibe lo que mande un agente (JSON torcido, texto plano, formulario,
 * acciones con otro nombre, campos con otro nombre) y lo deja en la forma que el motor entiende.
 * Puro: no toca archivos. Cada arreglo queda anotado para decírselo al agente.
 */
export type Body = Record<string, unknown>;
export interface Intake { body: Body; arreglos: string[]; recibi: string[] }

const ACTION_ALIAS: Record<string, string> = {
  ask: 'pedir', request: 'pedir', pedido: 'pedir', solicitar: 'pedir', solicitud: 'pedir', crear: 'pedir', create: 'pedir', update: 'pedir',
  registrar: 'pedir', register: 'pedir', save: 'pedir', guardar: 'pedir', write: 'pedir', add: 'pedir', agregar: 'pedir', send: 'pedir', enviar: 'pedir', submit: 'pedir',
  query: 'consultar', consulta: 'consultar', question: 'consultar', search: 'consultar', buscar: 'consultar', preguntar: 'consultar', lookup: 'consultar', get: 'consultar',
  reply: 'responder', answer: 'responder', respond: 'responder', contestar: 'responder', respuesta: 'responder',
  approve: 'aprobar', aprobacion: 'aprobar', reject: 'rechazar', deny: 'rechazar', rechazo: 'rechazar',
  status: 'estado', caso: 'estado', case: 'estado', cases: 'casos', list: 'casos', listar: 'casos', resumen: 'manana', morning: 'manana', summary: 'manana', mañana: 'manana', cancel: 'cancelar', read: 'leer',
};
const FIELD_ALIAS: Record<string, string[]> = {
  text: ['pedido', 'message', 'mensaje', 'request', 'prompt', 'content', 'contenido', 'instruction', 'instruccion', 'instrucción', 'texto', 'input', 'order', 'orden', 'body'],
  q: ['question', 'pregunta', 'query', 'consulta'],
  md: ['expediente', 'markdown', 'case_file', 'casefile', 'dossier', 'archivo_md', 'file_md'],
  id: ['caso', 'case', 'caseId', 'case_id', 'caseid'],
  dryRun: ['dry_run', 'dryrun', 'ensayo', 'preview'],
};
const WRAPPERS = ['input', 'args', 'arguments', 'params', 'parameters', 'data', 'payload', 'body', 'request'];
const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s-]+/g, '_');
const isObj = (v: unknown): v is Body => !!v && typeof v === 'object' && !Array.isArray(v);

/** Lee el cuerpo crudo como sea que venga. */
export function parseBody(raw: string, contentType = ''): { body: Body; arreglos: string[] } {
  const arreglos: string[] = []; const s = (raw || '').trim();
  if (!s) return { body: {}, arreglos };
  const tryJson = (x: string): unknown => { try { return JSON.parse(x); } catch { return undefined; } };
  let v = tryJson(s);
  if (typeof v === 'string') { const again = tryJson(v); if (isObj(again)) { v = again; arreglos.push('El cuerpo venía como texto con JSON adentro; lo abrí.'); } }
  if (isObj(v)) return { body: v, arreglos };
  if (/x-www-form-urlencoded/i.test(contentType) || (/^[\w.\-\[\]]+=/.test(s) && !/\s/.test(s.split('&')[0]))) {
    const o: Body = {}; new URLSearchParams(s).forEach((val, k) => { o[k] = val; });
    if (Object.keys(o).length) { arreglos.push('El cuerpo venía como formulario; lo convertí.'); return { body: o, arreglos }; }
  }
  // JSON con comillas simples / comas finales / texto alrededor
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) {
    const cut = s.slice(a, b + 1);
    const fixed = tryJson(cut) ?? tryJson(cut.replace(/,\s*([}\]])/g, '$1')) ?? tryJson(cut.replace(/'/g, '"').replace(/,\s*([}\]])/g, '$1'));
    if (isObj(fixed)) { arreglos.push('El JSON venía con errores de forma; lo arreglé.'); return { body: fixed, arreglos }; }
  }
  arreglos.push('El cuerpo no era JSON; lo tomé como el texto del pedido.');
  return { body: { text: s }, arreglos };
}

const str = (v: unknown) => (typeof v === 'string' ? v : Array.isArray(v) ? v.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n') : v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Deja el cuerpo en la forma del motor: acción conocida, campos con su nombre, texto como texto. */
export function normalizeBody(input: Body, opts: { hasQuestionPending?: boolean } = {}): Intake {
  const arreglos: string[] = []; let body: Body = { ...input };
  // 1) desenvolver (arguments puede ser un JSON en texto)
  for (let i = 0; i < 2; i++) {
    for (const w of WRAPPERS) {
      let inner = body[w]; if (typeof inner === 'string' && /^\s*\{/.test(inner)) { try { inner = JSON.parse(inner); } catch { /* sigue */ } }
      if (isObj(inner) && (w !== 'body' && w !== 'request' || !('text' in body || 'action' in body))) {
        const { [w]: _drop, ...rest } = body; void _drop; body = { ...rest, ...inner }; arreglos.push(`Los datos venían dentro de «${w}»; los saqué.`); break;
      }
    }
  }
  const recibi = Object.keys(body);
  // 2) campos con otro nombre
  for (const [canon, alts] of Object.entries(FIELD_ALIAS)) {
    if (body[canon] != null && body[canon] !== '') continue;
    const hit = Object.keys(body).find(k => alts.some(a => norm(a) === norm(k)) && body[k] != null && body[k] !== '');
    if (hit) { body[canon] = body[hit]; arreglos.push(`Leí «${hit}» como «${canon}».`); }
  }
  for (const k of ['text', 'q', 'md'] as const) if (body[k] != null && typeof body[k] !== 'string') { body[k] = str(body[k]); arreglos.push(`«${k}» no era texto; lo convertí.`); }
  // 3) acción
  const raw = typeof body.action === 'string' ? body.action : '';
  const n = norm(raw);
  const known = new Set(['pedir', 'leer', 'consultar', 'responder', 'aprobar', 'rechazar', 'estado', 'casos', 'cancelar', 'revisado', 'chat', 'chat_reset', 'banco', 'ajustes', 'probar', 'manana']);
  if (raw && !known.has(n)) {
    const al = ACTION_ALIAS[n];
    if (al) { body.action = al; arreglos.push(`La acción «${raw}» no existe; la leí como «${al}».`); }
    else if (str(body.text) || str(body.q)) { body.action = str(body.q) && !str(body.text) ? 'consultar' : 'pedir'; arreglos.push(`La acción «${raw}» no existe; por lo que traías la leí como «${body.action}».`); }
  } else if (raw) body.action = n;
  if (!body.action) {
    const hasId = typeof body.id === 'string' && body.id;
    const a = hasId && str(body.text) && opts.hasQuestionPending !== false ? 'responder' : str(body.q) && !str(body.text) ? 'consultar' : str(body.text) ? 'pedir' : '';
    if (a) { body.action = a; arreglos.push(`No traías acción; por lo que mandaste la leí como «${a}».`); }
  }
  // responder sin respuesta pero con md/q → no inventar
  return { body, arreglos, recibi };
}

/** ¿Lo que llegó como «consultar» es en realidad un pedido para guardar? */
export function consultIsRequest(body: Body, quick: 'pedido' | 'consulta' | 'saludo' | string): boolean {
  const q = str(body.q || body.text).trim();
  if (str(body.md).trim()) return true;
  if (!q) return false;
  if (/\?\s*$/.test(q) || /^¿/.test(q)) return false;
  return quick === 'pedido';
}

/** Quita llaves y secretos de lo que se guarda en la caja negra. */
export function redact(v: unknown, depth = 0): unknown {
  if (depth > 5) return '…';
  if (typeof v === 'string') return v.length > 1500 ? v.slice(0, 1500) + `… (+${v.length - 1500})` : v;
  if (Array.isArray(v)) return v.slice(0, 20).map(x => redact(x, depth + 1));
  if (isObj(v)) { const o: Body = {}; for (const [k, x] of Object.entries(v)) o[k] = /key|token|secret|password|authorization|clave/i.test(k) ? '«oculto»' : redact(x, depth + 1); return o; }
  return v;
}

/**
 * Conectar un agente de IA al cerebro de una persona: los textos que se copian y la prueba de conexión.
 * Lógica pura (sin React): la pantalla «Mi agente» la usa y las pruebas la ejercitan sin navegador.
 * Todo parte de lo que el Cerebro hace hoy: dos verbos (pedir y consultar); el Cerebro es quien escribe.
 */

export type ConnectLang = 'es' | 'en';
export type ConnectKind = 'ok' | 'sin_llave' | 'llave' | 'red' | 'otro';
export interface ConnectResult { kind: ConnectKind; status?: number; abiertos?: number }

export const KEY_FORMAT = /^tmk_[0-9a-f]{8}_[0-9a-f]{64}$/;
/** Quita espacios y comillas que se cuelan al copiar. */
export const cleanKey = (v: string) => String(v || '').trim().replace(/^["'`]+|["'`]+$/g, '').trim();
export const looksLikeKey = (v: string) => KEY_FORMAT.test(cleanKey(v));

const strip = (base: string) => base.replace(/\/+$/, '');

/** El texto que se pega en cualquier agente (Claude, un GPT, otro): dónde está el cerebro, con qué llave y qué puede hacer. */
export function pasteToAgent(base: string, lang: ConnectLang = 'es'): string {
  const b = strip(base);
  return lang === 'en'
    ? [
      `My brain lives at ${b}.`,
      'Authenticate every call with the header  Authorization: Bearer <my key>.',
      `Before you start, read the guide:  GET ${b}/api/agent/cerebro?guia=1`,
      'You can only ASK and LOOK THINGS UP; the Brain is the one that writes to my notes:',
      `- Ask (make something happen):  POST ${b}/api/agent/cerebro  {"action":"pedir","text":"what I want, in my own words"}`,
      `- Look up:  GET ${b}/api/agent/cerebro?q=<question>   (q=pendientes shows what is open; q=anoche shows last night)`,
      'Use my words as I said them, with full names and full dates. One topic per request. If the Brain asks a question, answer it with another "pedir". Tell me the short answer (caso.paraPersona).',
    ].join('\n')
    : [
      `Mi cerebro está en ${b}.`,
      'En cada llamada usa el encabezado  Authorization: Bearer <mi llave>.',
      `Antes de empezar, lee la guía:  GET ${b}/api/agent/cerebro?guia=1`,
      'Solo puedes PEDIR y CONSULTAR; el Cerebro es quien escribe en mis fichas:',
      `- Pedir (que algo pase):  POST ${b}/api/agent/cerebro  {"action":"pedir","text":"lo que quiero, con mis palabras"}`,
      `- Consultar:  GET ${b}/api/agent/cerebro?q=<pregunta>   (q=pendientes muestra lo abierto; q=anoche, lo de anoche)`,
      'Usa mis palabras tal cual, con nombres y fechas completos. Un tema por pedido. Si el Cerebro te hace una pregunta, contéstala con otro «pedir». Dime la respuesta corta (caso.paraPersona).',
    ].join('\n');
}

/** Los pasos para un GPT de ChatGPT con «Acciones». Los nombres de los botones de ChatGPT pueden cambiar. */
export const GPT_STEPS_ES = [
  'En ChatGPT, crea un GPT nuevo y abre la pestaña «Configurar».',
  'Baja a «Acciones» y pulsa «Crear nueva acción».',
  'En «Autenticación» elige «Clave de API», tipo «Bearer», y pega tu llave.',
  'En «Esquema» pega el esquema de abajo.',
  'En «Instrucciones» del GPT pega las instrucciones de abajo.',
  'Guarda y prueba con «¿Qué hay pendiente?».',
];

/** Prueba la conexión como la haría el agente: SOLO con la llave (sin la sesión del navegador), consultando lo abierto. */
export async function testConnection(base: string, key: string, f: typeof fetch = fetch): Promise<ConnectResult> {
  const k = cleanKey(key);
  if (!k) return { kind: 'sin_llave' };
  let res: Response;
  try {
    res = await f(`${strip(base)}/api/agent/cerebro?q=${encodeURIComponent('pendientes')}`, { method: 'GET', credentials: 'omit', cache: 'no-store', headers: { authorization: `Bearer ${k}` } } as RequestInit);
  } catch { return { kind: 'red' }; }
  if (res.status === 401 || res.status === 403) return { kind: 'llave', status: res.status };
  if (!res.ok) return { kind: 'otro', status: res.status };
  let j: any = null; try { j = await res.json(); } catch {}
  if (!j || j.ok === false) return { kind: 'otro', status: res.status };
  return { kind: 'ok', status: res.status, abiertos: Array.isArray(j.abiertos) ? j.abiertos.length : 0 };
}

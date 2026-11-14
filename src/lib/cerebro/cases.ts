/**
 * Casos del Cerebro: todo pedido es un caso que se abre, se conversa y se cierra con un acta.
 * Aquí solo se calcula el estado y el acta a partir del pedido guardado; no se escribe nada.
 */
import type { CerebroRequest } from './engine';
import { tr } from '../reqLang';

export type CaseState = 'espera_respuesta' | 'espera_aprobacion' | 'cerrado';
export type CloseType = 'completo' | 'parcial' | 'sin_cambios';
export interface Caso {
  id: string; estado: CaseState; cerrado: boolean; tipo?: CloseType; abiertoEl: string; cerradoEl?: string;
  pedido: string; guardado: string[]; esperando: string[]; noGuardado: string[]; porConfirmar: string[];
  pregunta?: string; motivo?: string; deshacer?: string; decididoPor?: string; reemplazadoPor?: string;
  /** El acta en palabras, lista para leer. */
  texto: string;
  /** Qué puede hacer ahora quien pidió. */
  ahora: string;
}

export const isClosed = (r: Pick<CerebroRequest, 'status'>) => r.status !== 'pregunta' && r.status !== 'pendiente';
const list = (a: string[]) => a.map((x, i) => `${i + 1}. ${x}`).join(' ');

export function caseOf(r: CerebroRequest, opts: { canApprove?: boolean } = {}): Caso {
  const estado: CaseState = r.status === 'pregunta' ? 'espera_respuesta' : r.status === 'pendiente' ? 'espera_aprobacion' : 'cerrado';
  const cerrado = estado === 'cerrado';
  const porConfirmar = [...(r.obs?.fuertes || []), ...(r.obs?.avisos || []), ...(r.obs?.falta || [])];
  const guardado = r.status === 'aplicado' ? (r.results?.length ? r.results : r.plan) : [];
  const esperando = r.status === 'pendiente' ? r.plan : [];
  const noGuardado = [...(r.report?.noHice || []),
    ...(r.status === 'rechazado' ? [tr('Se rechazó: no se guardó nada.', 'It was rejected: nothing was saved.')] : []),
    ...(r.status === 'reemplazado' ? [tr(`Lo reemplazó el caso ${r.replacedBy || ''}: de este no se guardó nada.`, `Case ${r.replacedBy || ''} replaced it: nothing from this one was saved.`)] : []),
    ...(r.status === 'fallo' || r.status === 'no_entendido' ? [r.message || tr('No se pudo hacer.', 'It could not be done.')] : [])];
  const tipo: CloseType | undefined = !cerrado ? undefined : r.status === 'aplicado' ? (porConfirmar.length || r.report?.noHice?.length ? 'parcial' : 'completo') : r.status === 'respuesta' ? 'completo' : 'sin_cambios';
  const tipoWord = tipo === 'completo' ? tr('completo', 'complete') : tipo === 'parcial' ? tr('parcial', 'partial') : tr('sin cambios', 'no changes');
  const lastQ = r.dialog?.length ? r.dialog[r.dialog.length - 1] : undefined;
  const pregunta = r.status === 'pregunta' ? (lastQ && !lastQ.a ? lastQ.q : r.message) : undefined;

  let texto: string, ahora: string;
  if (cerrado) {
    texto = tr(`CASO ${r.id} CERRADO (${tipoWord}). `, `CASE ${r.id} CLOSED (${tipoWord}). `)
      + tr(`Guardado: ${guardado.length ? list(guardado) : 'nada'}. `, `Saved: ${guardado.length ? list(guardado) : 'nothing'}. `)
      + (noGuardado.length ? tr(`No guardado: ${list(noGuardado)}. `, `Not saved: ${list(noGuardado)}. `) : '')
      + (porConfirmar.length ? tr(`Por confirmar: ${list(porConfirmar)}. `, `To confirm: ${list(porConfirmar)}. `) : '')
      + (r.changeId ? tr(`Se puede deshacer (cambio ${r.changeId}). `, `It can be undone (change ${r.changeId}). `) : '')
      + tr('No tienes que hacer nada más con este caso.', 'You do not have to do anything else with this case.');
    ahora = tr("Nada: el caso está cerrado. Para cambiar algo, abre un caso nuevo con POST {action:'pedir', text}.", "Nothing: the case is closed. To change something, open a new case with POST {action:'pedir', text}.");
  } else if (estado === 'espera_respuesta') {
    texto = tr(`CASO ${r.id} ABIERTO: espera tu respuesta. Todavía NO se guardó nada. Pregunta: ${pregunta || ''}`, `CASE ${r.id} OPEN: waiting for your answer. NOTHING has been saved yet. Question: ${pregunta || ''}`);
    ahora = tr(`Contesta con POST {action:'responder', id:'${r.id}', text}. Si no tienes el dato, dilo («no lo tengo») o pregúntale a tu persona.`, `Answer with POST {action:'responder', id:'${r.id}', text}. If you do not have the data, say so (“I do not have it”) or ask your person.`);
  } else {
    texto = tr(`CASO ${r.id} ABIERTO: espera aprobación. Todavía NO se guardó nada. ${r.replaces ? `Reemplaza al caso ${r.replaces}, que quedó cerrado. ` : ''}Propuesta: ${list(esperando)}. Motivo de la espera: ${r.why || ''}`, `CASE ${r.id} OPEN: waiting for approval. NOTHING has been saved yet. ${r.replaces ? `It replaces case ${r.replaces}, now closed. ` : ''}Proposal: ${list(esperando)}. Why it waits: ${r.why || ''}`);
    ahora = opts.canApprove
      ? tr(`Muéstrale la propuesta a tu persona. Si la aprueba, pásalo con POST {action:'aprobar', id:'${r.id}'}; si no, {action:'rechazar', id:'${r.id}'}. Para corregirla: {action:'pedir', text, reemplaza:'${r.id}'}.`, `Show the proposal to your person. If they approve, pass it on with POST {action:'aprobar', id:'${r.id}'}; if not, {action:'rechazar', id:'${r.id}'}. To correct it: {action:'pedir', text, reemplaza:'${r.id}'}.`)
      : tr(`Tu llave no puede aprobar: la persona lo aprueba en la app (Pedir → Por aprobar). Para corregirla: {action:'pedir', text, reemplaza:'${r.id}'}.`, `Your key cannot approve: the person approves it in the app (Pedir → To approve). To correct it: {action:'pedir', text, reemplaza:'${r.id}'}.`);
  }
  return {
    id: r.id, estado, cerrado, ...(tipo ? { tipo } : {}), abiertoEl: r.at, ...(r.closedAt ? { cerradoEl: r.closedAt } : {}),
    pedido: r.text.slice(0, 200), guardado, esperando, noGuardado, porConfirmar,
    ...(pregunta ? { pregunta } : {}), ...(r.status === 'pendiente' && r.why ? { motivo: r.why } : {}), ...(r.changeId ? { deshacer: r.changeId } : {}),
    ...(r.decidedBy ? { decididoPor: `${r.decidedBy}${r.decidedVia ? ` (${r.decidedVia})` : ''}` } : {}), ...(r.replacedBy ? { reemplazadoPor: r.replacedBy } : {}),
    texto, ahora,
  };
}
/** Una línea por caso, para «tus casos abiertos» y las novedades. */
export const caseLine = (r: CerebroRequest) => ({ id: r.id, estado: caseOf(r).estado, tipo: caseOf(r).tipo, desde: r.at, pedido: r.text.slice(0, 120), ...(r.status === 'pregunta' ? { pregunta: caseOf(r).pregunta } : {}) });

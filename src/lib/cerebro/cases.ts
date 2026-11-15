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
  /** Dos niveles: esto es lo corto para la persona (hasta 4 líneas, sin números de caso ni nombres técnicos); `texto` es el detalle del registro. */
  paraPersona: string;
}

export const isClosed = (r: Pick<CerebroRequest, 'status'>) => r.status !== 'pregunta' && r.status !== 'pendiente';
const list = (a: string[]) => a.map((x, i) => `${i + 1}. ${x}`).join(' ');

export function caseOf(r: CerebroRequest, opts: { canApprove?: boolean } = {}): Caso {
  const estado: CaseState = r.status === 'pregunta' ? 'espera_respuesta' : r.status === 'pendiente' ? 'espera_aprobacion' : 'cerrado';
  const cerrado = estado === 'cerrado';
  const porConfirmar = [...(r.obs?.fuertes || []), ...(r.obs?.avisos || []), ...(r.obs?.falta || [])];
  const guardado = r.status === 'aplicado' ? (r.results?.length ? r.results : r.plan) : (r.partial?.saved || []);
  const esperando = r.status === 'pendiente' ? r.plan : [];
  const noGuardado = [...(r.report?.noHice || []),
    ...(r.status === 'cancelado' ? [tr(`Se canceló: ${r.cancelReason || 'sin motivo'}. ${r.partial ? 'Lo que esperaba no se guardó.' : 'No se guardó nada.'}`, `It was cancelled: ${r.cancelReason || 'no reason'}. ${r.partial ? 'What was waiting was not saved.' : 'Nothing was saved.'}`)] : []),
    ...(r.status === 'rechazado' ? [r.partial ? tr('Se rechazó lo que esperaba: no se guardó.', 'What was waiting was rejected: not saved.') : tr('Se rechazó: no se guardó nada.', 'It was rejected: nothing was saved.')] : []),
    ...(r.status === 'reemplazado' ? [tr(`Lo reemplazó el caso ${r.replacedBy || ''}: de este no se guardó nada.`, `Case ${r.replacedBy || ''} replaced it: nothing from this one was saved.`)] : []),
    ...(r.status === 'sin_cambios' && !r.report?.noHice?.length ? [r.message || tr('No se guardó nada.', 'Nothing was saved.')] : []),
    ...(r.status === 'fallo' || r.status === 'no_entendido' ? [r.message || tr('No se pudo hacer.', 'It could not be done.')] : [])];
  const tipo: CloseType | undefined = !cerrado ? undefined : r.partial?.saved?.length && r.status !== 'aplicado' ? 'parcial' : r.status === 'aplicado' ? (porConfirmar.length || r.report?.noHice?.length ? 'parcial' : 'completo') : r.status === 'respuesta' ? 'completo' : 'sin_cambios';
  const tipoWord = tipo === 'completo' ? tr('completo', 'complete') : tipo === 'parcial' ? tr('parcial', 'partial') : tr('sin cambios', 'no changes');
  const lastQ = r.dialog?.length ? r.dialog[r.dialog.length - 1] : undefined;
  const pregunta = r.status === 'pregunta' ? (lastQ && !lastQ.a ? lastQ.q : r.esperaPersona && r.faltan?.length ? r.faltan.join(' ') : r.message) : undefined;

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
    texto = r.esperaPersona
      ? tr(`CASO ${r.id} ABIERTO: espera a que consultes con tu persona. Todavía NO se guardó nada. Cuando te responda, contesta aquí. Pregunta: ${pregunta || ''}`, `CASE ${r.id} OPEN: waiting for you to check with your person. NOTHING has been saved yet. When they answer, reply here. Question: ${pregunta || ''}`)
      : tr(`CASO ${r.id} ABIERTO: espera tu respuesta. Todavía NO se guardó nada. Pregunta: ${pregunta || ''}`, `CASE ${r.id} OPEN: waiting for your answer. NOTHING has been saved yet. Question: ${pregunta || ''}`);
    ahora = tr(`Contesta con POST {action:'responder', id:'${r.id}', text}. Para cada punto: el dato, «no lo tengo», o «se lo pregunto a mi persona» (el caso espera). Solo hay una ronda: después sigo con lo seguro.`, `Answer with POST {action:'responder', id:'${r.id}', text}. For each point: the data, “I do not have it”, or “I will ask my person” (the case waits). There is only one round: after it I go on with what is certain.`);
  } else {
    const saved = r.partial?.saved?.length ? tr(`Ya se guardó lo seguro: ${list(r.partial.saved)}. ${r.partial.changeId ? `Se puede deshacer (cambio ${r.partial.changeId}). ` : ''}Lo demás espera. `, `The safe part is already saved: ${list(r.partial.saved)}. ${r.partial.changeId ? `It can be undone (change ${r.partial.changeId}). ` : ''}The rest waits. `) : '';
    texto = saved + tr(`CASO ${r.id} ABIERTO: espera aprobación. ${r.partial ? 'Lo demás todavía NO se guardó.' : 'Todavía NO se guardó nada.'} ${r.replaces ? `Reemplaza al caso ${r.replaces}, que quedó cerrado. ` : ''}Propuesta: ${list(esperando)}. Motivo de la espera: ${r.why || ''}`, `CASE ${r.id} OPEN: waiting for approval. ${r.partial ? 'The rest has NOT been saved yet.' : 'NOTHING has been saved yet.'} ${r.replaces ? `It replaces case ${r.replaces}, now closed. ` : ''}Proposal: ${list(esperando)}. Why it waits: ${r.why || ''}`);
    ahora = r.confirm?.phrase && opts.canApprove
      ? (r.confirm.first
        ? tr(`BORRAR pide doble confirmación y ya llegó la primera. Falta la segunda: tu persona debe decir exactamente «${r.confirm.phrase}». Pásalo con POST {action:'aprobar', id:'${r.id}', text:'<sus palabras>'}. Para cancelar: {action:'rechazar', id:'${r.id}'}.`, `DELETING needs double confirmation and the first one arrived. The second is missing: your person must say exactly “${r.confirm.phrase}”. Pass it with POST {action:'aprobar', id:'${r.id}', text:'<their words>'}. To cancel: {action:'rechazar', id:'${r.id}'}.`)
        : tr(`BORRAR pide doble confirmación de tu persona. Primera: muéstrale qué se borra y, si acepta, POST {action:'aprobar', id:'${r.id}'}. Segunda: debe decir exactamente «${r.confirm.phrase}» y lo pasas con {action:'aprobar', id:'${r.id}', text:'<sus palabras>'}. Para cancelar: {action:'rechazar', id:'${r.id}'}.`, `DELETING needs your person’s double confirmation. First: show them what gets deleted and, if they accept, POST {action:'aprobar', id:'${r.id}'}. Second: they must say exactly “${r.confirm.phrase}” and you pass it with {action:'aprobar', id:'${r.id}', text:'<their words>'}. To cancel: {action:'rechazar', id:'${r.id}'}.`))
      : opts.canApprove
      ? tr(`Muéstrale la propuesta a tu persona. Si la aprueba, pásalo con POST {action:'aprobar', id:'${r.id}', text:'<sus palabras>'}; si no, {action:'rechazar', id:'${r.id}'}. Para corregirla: {action:'pedir', text, reemplaza:'${r.id}'}.`, `Show the proposal to your person. If they approve, pass it on with POST {action:'aprobar', id:'${r.id}', text:'<their words>'}; if not, {action:'rechazar', id:'${r.id}'}. To correct it: {action:'pedir', text, reemplaza:'${r.id}'}.`)
      : tr(`Tu llave no puede aprobar: la persona lo aprueba en la app (Pedir → Por aprobar). Para corregirla: {action:'pedir', text, reemplaza:'${r.id}'}.`, `Your key cannot approve: the person approves it in the app (Pedir → To approve). To correct it: {action:'pedir', text, reemplaza:'${r.id}'}.`);
  }
  return {
    id: r.id, estado, cerrado, ...(tipo ? { tipo } : {}), abiertoEl: r.at, ...(r.closedAt ? { cerradoEl: r.closedAt } : {}),
    pedido: r.text.slice(0, 200), guardado, esperando, noGuardado, porConfirmar,
    ...(pregunta ? { pregunta } : {}), ...(r.status === 'pendiente' && r.why ? { motivo: r.why } : {}), ...(r.changeId ? { deshacer: r.changeId } : {}),
    ...(r.decidedBy ? { decididoPor: `${r.decidedBy}${r.decidedVia ? ` (${r.decidedVia})` : ''}${r.approvalWords ? ` — «${r.approvalWords}»` : ''}` } : {}), ...(r.replacedBy ? { reemplazadoPor: r.replacedBy } : {}),
    texto, ahora,
    paraPersona: paraPersona({ estado, guardado, esperando, noGuardado, porConfirmar, pregunta, why: r.why, deshacer: !!(r.changeId || r.partial?.changeId), parcial: !!r.partial?.saved?.length }),
  };
}

/** Quita lo que la persona no necesita ver: números de caso, rutas de archivo e ids internos. */
export const limpio = (x: string, max = 110): string => {
  let t = String(x || '')
    .replace(/\b(?:ped|chg)-[\w-]+/gi, '')
    .replace(/\S+\.md\b/g, '')
    .replace(/\b[a-z]+(?:-[a-z0-9]+)*-\d[a-z0-9-]*\b/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
  if (t.length > max) t = t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
  return t;
};
const some = (a: string[], n = 3) => {
  const c = a.map(x => limpio(x)).filter(Boolean);
  return c.length > n ? [...c.slice(0, n), tr(`y ${c.length - n} más`, `and ${c.length - n} more`)].join('; ') : c.join('; ');
};
interface ShortIn { estado: CaseState; guardado: string[]; esperando: string[]; noGuardado: string[]; porConfirmar: string[]; pregunta?: string; why?: string; deshacer: boolean; parcial: boolean }
/** La respuesta corta para la persona: qué pasó, qué falta y si se puede deshacer. Nunca más de 4 líneas. */
export function paraPersona(c: ShortIn): string {
  const L: string[] = [];
  if (c.estado === 'espera_respuesta') {
    L.push(tr('Todavía no guardé nada: me falta un dato.', 'I have not saved anything yet: I am missing one thing.'));
    if (c.pregunta) L.push(limpio(c.pregunta, 160));
  } else if (c.estado === 'espera_aprobacion') {
    if (c.parcial && c.guardado.length) L.push(tr(`Ya guardé: ${some(c.guardado)}.`, `Already saved: ${some(c.guardado)}.`));
    L.push(tr(`Falta tu visto bueno para: ${some(c.esperando, 2)}.`, `Waiting for your approval: ${some(c.esperando, 2)}.`));
    if (c.why) L.push(tr(`Motivo: ${limpio(c.why, 140)}`, `Why: ${limpio(c.why, 140)}`));
  } else {
    if (c.guardado.length) L.push(tr(`Guardado: ${some(c.guardado)}.`, `Saved: ${some(c.guardado)}.`));
    else L.push(c.noGuardado.length ? tr(`No se guardó nada: ${some(c.noGuardado, 2)}.`, `Nothing was saved: ${some(c.noGuardado, 2)}.`) : tr('No se guardó nada.', 'Nothing was saved.'));
    if (c.noGuardado.length && c.guardado.length) L.push(tr(`No se guardó: ${some(c.noGuardado, 2)}.`, `Not saved: ${some(c.noGuardado, 2)}.`));
    if (c.porConfirmar.length) L.push(tr(`Por confirmar: ${some(c.porConfirmar, 2)}.`, `To confirm: ${some(c.porConfirmar, 2)}.`));
    if (c.deshacer && c.guardado.length) L.push(tr('Se puede deshacer.', 'It can be undone.'));
  }
  return L.slice(0, 4).join('\n');
}
/** Una línea por caso, para «tus casos abiertos» y las novedades. */
export const caseLine = (r: CerebroRequest) => ({ id: r.id, estado: caseOf(r).estado, tipo: caseOf(r).tipo, desde: r.at, pedido: r.text.slice(0, 120), ...(r.status === 'pregunta' ? { pregunta: caseOf(r).pregunta } : {}) });

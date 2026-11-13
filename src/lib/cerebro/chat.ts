/**
 * Chat con el Cerebro: un solo hilo por persona. Cada mensaje se reparte entre lo que ya existe:
 *   consulta → consultar (solo lee, respuesta corta)    pedido → pedir (plan, aprobación, deshacer)
 *   charla   → respuesta breve sin tocar nada            respuesta a una pregunta del Cerebro → responder
 * El chat no escribe por ningún camino propio: todo cambio pasa por el mismo tubo de siempre.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { atomicWriteFile } from '../vaultFiles';
import { cerebroDir, loadSettings } from './settings';
import { consultar, pedir, responder, listRequests, type CerebroRequest } from './engine';
import { chat as llm, llmConfigured } from './ollama';
import { tr, replyLang, type Lang } from '../reqLang';

export interface ChatMsg { id: string; at: string; role: 'user' | 'brain'; text: string; kind?: 'answer' | 'talk' | 'request' | 'error'; requestId?: string; sources?: string[]; lang?: Lang; model?: string }
export const MAX_THREAD = 50, MAX_TEXT = 60000;
export type Intent = 'consulta' | 'pedido' | 'charla';

const safe = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 60) || 'persona';
const fileOf = (vault: string, who: string) => path.join(cerebroDir(vault), `chat-${safe(who)}.json`);
export function loadChat(vault: string, who: string): ChatMsg[] { try { const d = JSON.parse(fs.readFileSync(fileOf(vault, who), 'utf8')); return Array.isArray(d) ? d : []; } catch { return []; } }
function saveChat(vault: string, who: string, msgs: ChatMsg[]) { fs.mkdirSync(cerebroDir(vault), { recursive: true }); atomicWriteFile(fileOf(vault, who), JSON.stringify(msgs.slice(-MAX_THREAD), null, 1)); }
export function resetChat(vault: string, who: string) { try { fs.rmSync(fileOf(vault, who)); } catch { /* ya estaba vacío */ } }
const msg = (role: ChatMsg['role'], text: string, extra: Partial<ChatMsg> = {}): ChatMsg => ({ id: crypto.randomUUID().slice(0, 8), at: new Date().toISOString(), role, text, ...extra });

const GREET = /^(hola|buenas|buenos días|buen día|buenas tardes|buenas noches|gracias|muchas gracias|ok|okay|vale|listo|perfecto|genial|dale|hi|hello|hey|thanks|thank you|good morning|good evening|great|cool|got it)[\s!.,¡]*$/i;
const VERBS = 'muévelo|anótalo|agéndalo|créalo|cámbialo|bórralo|márcalo|cancélalo|regístralo|pásalo|actualízalo|complétalo|reprogramalo|anota|anotar|apunta|agenda|agendar|programa|crea|crear|registra|registrar|mueve|mover|pasa|pasar|cambia|cambiar|actualiza|actualizar|completa|completar|reprograma|reprogramar|borra|borrar|elimina|conecta|conectar|desconecta|añade|agrega|agregar|marca|marcar|cancela|cancelar|recuérdame|recuerda|guarda|guardar|pon|pone|corrige|corregir|asigna|schedule|add|create|note|log|record|move|change|update|complete|reschedule|delete|remove|connect|set|mark|cancel|remind|save|fix|assign|put|book|track';
const LEAD = '(?:por favor|porfa|please|puedes|podrías|podrias|puede|quiero que|necesito que|can you|could you|would you|i want you to|i need you to)\\s+';
const PEDIDO = new RegExp(`^(?:${LEAD})*(?:${VERBS})\\b`, 'i');
const CONSULTA = /^(?:¿|\?)|\?\s*$|^(?:qué|que|cómo|como|cuándo|cuando|cuál|cual|cuáles|quién|quien|dónde|donde|cuánto|cuanto|cuántos|dime|dame|muéstrame|muestrame|resume|resumen|háblame|hablame|explica|busca|what|how|when|which|who|where|why|tell me|show me|summari[sz]e|status|list|give me|find)\b/i;

/** Qué quiere el mensaje. Primero reglas claras (rápido y sin costo); si dudamos y hay modelo, él decide. */
export function quickIntent(text: string): Intent | null {
  const t = text.trim();
  if (GREET.test(t)) return 'charla';
  const head = t.split(/\s+/).slice(0, 7).join(' ');
  if (t.length > 220 || t.split('\n').length > 3) return 'pedido'; // un correo o nota pegada
  if (PEDIDO.test(head)) return 'pedido';
  if (CONSULTA.test(t)) return 'consulta';
  return null;
}
export async function intentOf(text: string, vault: string): Promise<Intent> {
  const t = text.trim();
  const quick = quickIntent(t); if (quick) return quick;
  if (llmConfigured()) {
    try {
      const r = await llm(loadSettings(vault).models.rapido, [
        { role: 'system', content: 'INTENT: classify the message to a work assistant. Reply with ONE word: consulta (asks for information), pedido (asks to create/change/schedule/record something) or charla (greeting or small talk).' },
        { role: 'user', content: t.slice(0, 400) }], undefined, 20_000);
      const w = r.content.toLowerCase();
      if (w.includes('pedido')) return 'pedido'; if (w.includes('charla')) return 'charla'; if (w.includes('consulta')) return 'consulta';
    } catch { /* se sigue por defecto */ }
  }
  return /\b\d{1,2}[:h]\d{2}\b|\b(mañana|hoy|lunes|martes|miércoles|jueves|viernes|tomorrow|today|monday|tuesday|wednesday|thursday|friday)\b/i.test(t) ? 'pedido' : 'consulta';
}

const historyOf = (thread: ChatMsg[], n = 6) => thread.slice(-n).map(m => `${m.role === 'user' ? tr('Tú', 'You') : tr('Cerebro', 'Brain')}: ${m.text.replace(/\s+/g, ' ').slice(0, 220)}`).join('\n');
const reqOf = (id?: string, vault?: string): CerebroRequest | undefined => (id && vault ? listRequests(vault).find(r => r.id === id) : undefined);

export interface ChatTurn { ok: boolean; status: number; error?: string; added: ChatMsg[]; request?: CerebroRequest; intent?: Intent }

/** Un mensaje de la persona → la respuesta del Cerebro. Guarda los dos en el hilo. */
export async function chatTurn(vault: string, who: string, text: string, opts: { mode?: 'leer'; deep?: boolean } = {}): Promise<ChatTurn> {
  const t = text.trim();
  if (t.length < 2) return { ok: false, status: 400, error: tr('Escribe algo.', 'Write something.'), added: [] };
  if (t.length > MAX_TEXT) return { ok: false, status: 413, error: tr('El mensaje es demasiado largo (máximo 60 000 caracteres). Divídelo.', 'The message is too long (60,000 characters maximum). Split it.'), added: [] };
  const lang = replyLang();
  const thread = loadChat(vault, who);
  const mine = msg('user', t, { lang });
  const last = thread[thread.length - 1];
  const waiting = last?.role === 'brain' && last.kind === 'request' ? reqOf(last.requestId, vault) : undefined;
  let out: ChatMsg; let request: CerebroRequest | undefined; let intent: Intent;
  try {
    // Si el Cerebro había preguntado algo, el mensaje es la respuesta, salvo que claramente sea otra cosa (una pregunta nueva, un saludo, otro pedido).
    if (waiting?.status === 'pregunta' && !opts.mode && quickIntent(t) === null) {
      intent = 'pedido';
      const r = await responder(waiting.id, t);
      if (!r.ok) { out = msg('brain', r.error, { kind: 'error', lang }); }
      else { request = r as CerebroRequest; out = msg('brain', r.message || '', { kind: 'request', requestId: r.id, lang, model: r.model }); }
    } else {
      intent = opts.mode === 'leer' ? 'pedido' : await intentOf(t, vault);
      if (intent === 'pedido') {
        const r = await pedir({ text: t, deep: opts.deep === true, kind: opts.mode === 'leer' ? 'leer' : 'pedir' });
        request = r; out = msg('brain', r.message || '', { kind: 'request', requestId: r.id, lang, model: r.model });
      } else if (intent === 'charla') {
        out = msg('brain', tr('Aquí estoy. Pregúntame algo del cerebro o pídeme un cambio.', 'I am here. Ask me something about the brain or ask for a change.'), { kind: 'talk', lang });
      } else {
        const prevUser = [...thread].reverse().find(m => m.role === 'user')?.text || '';
        // Seguimiento («¿y el de Panamá?»): se busca con la pregunta anterior; una pregunta con tema propio se busca sola.
        const shortFollowUp = prevUser && (t.split(/\s+/).length < 4 || /^(¿?y|and|also|además|entonces|then)\b/i.test(t));
        const r = await consultar(t, 'breve', { history: historyOf(thread), short: true, searchQ: shortFollowUp ? `${prevUser.slice(0, 150)} ${t}` : t });
        out = r.ok
          ? msg('brain', r.answer, { kind: 'answer', lang, model: r.writtenBy === 'app' ? undefined : r.writtenBy, sources: ((r as any).dossier?.sources || []).slice(0, 5).map((x: { title: string }) => x.title) })
          : msg('brain', tr('No encontré fichas sobre eso. Dime el nombre de la empresa o de la persona y lo busco.', 'I found no notes about that. Give me the company or person name and I will look.'), { kind: 'talk', lang });
      }
    }
  } catch (e: any) {
    out = msg('brain', tr('No pude responder ahora. Intenta de nuevo.', 'I could not answer right now. Try again.'), { kind: 'error', lang }); intent = 'consulta';
  }
  saveChat(vault, who, [...thread, mine, out]);
  return { ok: out.kind !== 'error', status: out.kind === 'error' ? 502 : 200, added: [mine, out], request, intent };
}
export const chatRequests = (vault: string, thread: ChatMsg[]): Record<string, CerebroRequest> => {
  const ids = new Set(thread.filter(m => m.requestId).map(m => m.requestId as string)); const out: Record<string, CerebroRequest> = {};
  for (const r of listRequests(vault)) if (ids.has(r.id)) out[r.id] = r; return out;
};

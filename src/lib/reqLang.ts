/**
 * Idioma de lo que el servidor devuelve y escribe (español / inglés), sin librerías ni llamadas extra.
 *  - idioma de RESPUESTA (replyLang): el del mensaje de quien pide; lo que se le devuelve va en ese idioma.
 *  - idioma de TRABAJO (workLang): el del cerebro; los textos fijos que la app escribe DENTRO de las fichas
 *    (títulos de reuniones, bitácora, notas del diario) salen en ese idioma para que una ficha no quede mezclada.
 * Se fija por pedido con withLang(); fuera de eso todo sigue en español, como antes.
 */
import { AsyncLocalStorage } from 'async_hooks';

export type Lang = 'es' | 'en';
interface Ctx { reply: Lang; work: Lang }
const als = new AsyncLocalStorage<Ctx>();

export const withLang = <T>(reply: Lang, work: Lang, fn: () => T): T => als.run({ reply, work }, fn);
export const replyLang = (): Lang => als.getStore()?.reply ?? 'es';
export const workLang = (): Lang => als.getStore()?.work ?? 'es';
/** Texto en el idioma de la respuesta. */
export const tr = (es: string, en: string): string => (replyLang() === 'en' ? en : es);
/** Texto en el idioma de trabajo del cerebro (lo que queda escrito en las fichas). */
export const tw = (es: string, en: string): string => (workLang() === 'en' ? en : es);
export const asLang = (v: unknown): Lang | null => (v === 'en' || v === 'es' ? v : null);
export const localeOf = (l: Lang) => (l === 'en' ? 'en-US' : 'es-PA');

// Palabras corrientes de cada idioma (sin las que valen en los dos: a, no, me, he, e, mi…).
const ES = new Set('el la los las un una unos unas del al y o en con por para que se su sus tu tus es son está están fue ser hoy mañana pasado lunes martes miércoles miercoles jueves viernes sábado sabado domingo reunión reunion agenda tarea tareas crea crear anota anotar agrega agregar cambia mueve mover pasó paso quiero necesito favor hay sí como más pero ya muy cuando donde dónde quién quien este esta ese esa nos te le lo les nuestro nuestra llamada correo enviar envía envia hacer haz dile avísale avisale recuérdame recuerdame también tambien sobre entre desde hasta mismo misma todos todas algo nada'.split(/\s+/));
const EN = new Set('the an of to and or in on at with for from by is are was were be been will would should could can please my our your his her their it this that these those i we you she they schedule meeting call add create note move change monday tuesday wednesday thursday friday saturday sunday today tomorrow tonight next last about not yes have has had do does did what who when where which how need want send email task tasks also then than there here just only into over after before'.split(/\s+/));

/** Idioma de un texto: cuenta palabras corrientes de cada idioma. Si empata, manda `hint`. */
export function detectLang(text: string, hint: Lang = 'es'): Lang {
  const s = String(text || '').slice(0, 4000).toLowerCase();
  let es = 0, en = 0;
  for (const w of s.split(/[^a-záéíóúüñ']+/)) { if (!w) continue; if (ES.has(w)) es++; if (EN.has(w)) en++; }
  es += (s.match(/[¿¡ñ]/g) || []).length * 2 + (s.match(/[áéíóú]/g) || []).length * 0.5;
  return en > es ? 'en' : es > en ? 'es' : hint;
}

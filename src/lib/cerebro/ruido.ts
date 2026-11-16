/**
 * Ruido de un correo reenviado o pegado: firmas de aparato («Enviado desde mi iPhone») y avisos legales de pie de correo.
 * Con ellos dentro, el modelo a veces los copia a la ficha («el mensaje fue enviado desde su iPhone e incluye el aviso legal»).
 * Se quitan ANTES de dárselo al modelo; el original se guarda tal cual en el expediente y en la caja negra.
 * Conservador: solo líneas con forma de firma de aparato y párrafos que EMPIEZAN como aviso legal. No toca el pedido de la persona
 * (solo el expediente y los correos para leer), ni la cadena citada (a veces trae el contexto que hace falta).
 */

const DEVICE = /^\s*(enviado desde mi (iphone|ipad|android|m[oó]vil|celular|samsung|tel[eé]fono|dispositivo)|enviado desde (outlook|gmail|yahoo)|sent from my (iphone|ipad|android|mobile|phone|samsung|device)|sent from (outlook|gmail|yahoo)|get outlook for (ios|android)|obtener outlook para (ios|android))\b.*$/i;
const LEGAL = /^\s*(aviso legal|aviso de confidencialidad|nota de confidencialidad|confidencialidad|disclaimer|legal notice|confidentiality notice|este (mensaje|correo|e-?mail)\b.{0,40}\bconfidencial|this (message|e-?mail|email)\b.{0,40}\b(confidential|privileged)|the information (contained )?in this (message|e-?mail|email)|if you are not the intended recipient|si usted no es el destinatario)/i;

export interface Cleaned { text: string; quitado: number }

/** Quita las firmas de aparato y los avisos legales. Devuelve el texto limpio y cuántos caracteres quitó. */
export function cleanNoise(input: string): Cleaned {
  const src = String(input || ''); if (!src) return { text: '', quitado: 0 };
  const lines = src.split(/\r?\n/); const out: string[] = []; let skipping = false;
  for (const line of lines) {
    // Un aviso legal ocupa un párrafo: se salta hasta la primera línea en blanco.
    if (skipping) { if (!line.trim()) skipping = false; else continue; }
    // El texto citado («> …») no se toca: es la cadena anterior, que a veces trae el contexto.
    if (/^\s*>/.test(line)) { out.push(line); continue; }
    if (DEVICE.test(line)) continue;
    if (LEGAL.test(line)) { skipping = true; continue; }
    out.push(line);
  }
  const text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text, quitado: Math.max(0, src.trim().length - text.length) };
}

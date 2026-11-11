import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import YAML from 'yaml';

/**
 * Helpers de escritura segura para el vault de Markdown.
 * - Lectura ESTRICTA: si el YAML de un archivo no se puede leer, no se reescribe (antes se perdía el encabezado).
 * - Serialización con la librería YAML (nunca concatenando strings).
 * - Escritura atómica (archivo temporal + rename).
 */

const FRONTMATTER_RE = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export type StrictNote =
  | { ok: true; frontmatter: Record<string, any>; body: string; hasFrontmatter: boolean }
  | { ok: false; error: string };

export function parseNoteStrict(content: string): StrictNote {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    // Sin bloque de frontmatter: solo es válido si el archivo no intenta abrir uno.
    if (/^﻿?---\s*(\r?\n|$)/.test(content)) {
      return { ok: false, error: 'El encabezado (frontmatter) está abierto pero no se cierra con ---' };
    }
    return { ok: true, frontmatter: {}, body: content, hasFrontmatter: false };
  }
  try {
    const parsed = YAML.parse(match[1]);
    if (parsed !== null && parsed !== undefined && (typeof parsed !== 'object' || Array.isArray(parsed))) {
      return { ok: false, error: 'El encabezado YAML no es un objeto' };
    }
    return { ok: true, frontmatter: (parsed as Record<string, any>) || {}, body: match[2] ?? '', hasFrontmatter: true };
  } catch (err: any) {
    return { ok: false, error: `YAML inválido: ${String(err?.message || err).split('\n')[0]}` };
  }
}

export function serializeNote(frontmatter: Record<string, any>, body: string): string {
  const yaml = YAML.stringify(frontmatter, { lineWidth: 0 }).trim();
  return `---\n${yaml}\n---\n\n${(body || '').replace(/^\s+/, '').replace(/\s+$/, '')}\n`;
}

/** Escribe en un temporal del mismo directorio y renombra: o queda el archivo completo o queda el anterior. */
export function atomicWriteFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

/** Lee un archivo del vault y lo interpreta de forma estricta. */
export function readNoteStrict(filePath: string): (StrictNote & { raw: string }) | { ok: false; error: string; raw: '' } {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err: any) {
    return { ok: false, error: `No se pudo leer el archivo: ${err?.message || err}`, raw: '' };
  }
  return { ...parseNoteStrict(raw), raw } as any;
}

/**
 * Reescribe una nota aplicando `mutate` sobre su frontmatter.
 * Aborta sin tocar el disco si el YAML no se puede leer o si el archivo cambió mientras se procesaba.
 */
export function updateNoteFile(
  filePath: string,
  mutate: (fm: Record<string, any>, body: string) => { body?: string } | void,
): { ok: true; content: string } | { ok: false; error: string } {
  const note = readNoteStrict(filePath);
  if (!note.ok) return { ok: false, error: `${path.basename(filePath)}: ${note.error}. No se modificó el archivo.` };

  const fm = note.frontmatter;
  const result = mutate(fm, note.body);
  const newBody = result && typeof result.body === 'string' ? result.body : note.body;
  const content = serializeNote(fm, newBody);

  // Comprobación de versión: si otro proceso cambió el archivo entre la lectura y la escritura, no pisarlo.
  let current: string;
  try { current = fs.readFileSync(filePath, 'utf-8'); } catch { current = ''; }
  if (current !== note.raw) {
    return { ok: false, error: `${path.basename(filePath)} cambió mientras se procesaba. Reintenta.` };
  }

  atomicWriteFile(filePath, content);

  const verify = parseNoteStrict(fs.readFileSync(filePath, 'utf-8'));
  if (!verify.ok) {
    // Restaurar lo anterior: nunca dejar un archivo ilegible.
    atomicWriteFile(filePath, note.raw);
    return { ok: false, error: `La verificación tras escribir falló (${verify.error}). Se restauró el archivo original.` };
  }
  return { ok: true, content };
}

/** Escribe una nota nueva (o completa) validando que el resultado se pueda volver a leer. */
export function writeNoteFile(filePath: string, frontmatter: Record<string, any>, body: string): { ok: true; content: string } | { ok: false; error: string } {
  const content = serializeNote(frontmatter, body);
  const check = parseNoteStrict(content);
  if (!check.ok) return { ok: false, error: check.error };
  atomicWriteFile(filePath, content);
  return { ok: true, content };
}

export const MAX_RECENT_ACTIONS = 50;

export function pushRecentAction(fm: Record<string, any>, action: Record<string, any>): void {
  if (!Array.isArray(fm.recent_actions)) fm.recent_actions = [];
  fm.recent_actions.unshift(action);
  if (fm.recent_actions.length > MAX_RECENT_ACTIONS) fm.recent_actions.length = MAX_RECENT_ACTIONS;
}

let wmCounter = 0;
/** ID único para notas de memoria de trabajo (fecha + hora + contador + aleatorio). */
export function uniqueWorkingMemoryId(dateStr: string, timeStr = ''): string {
  wmCounter = (wmCounter + 1) % 1000;
  const t = (timeStr || '').replace(/[^0-9]/g, '').slice(0, 6) || Date.now().toString().slice(-6);
  const rnd = crypto.randomBytes(4).toString('hex');
  return `wm-${dateStr.replace(/-/g, '')}-${t}-${rnd}`;
}

/**
 * Observaciones y bandeja «Por revisar» (fase 3b, parte D).
 * La app revisa con reglas exactas lo que se puede contar y comparar (duplicados, choques de agenda, datos que
 * faltan, cambios a fichas verificadas). Jev aporta el juicio (¿el plan refleja el pedido?, ¿contradice la ficha?).
 * Nada de aquí bloquea por sí solo: los avisos «fuertes» mandan el pedido a aprobación; el resto queda por revisar.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getUnifiedBrainTasks, getVaultPath, loadBrainGraph, type BrainNode } from '../smjBrainService';
import { listEvents } from '../agenda';
import { displayTitle, norm, words } from '../brainLens';
import { cerebroDir } from './settings';
import { createdIdOf, linked, eventTitle, type Op } from './ops';

export interface Observations {
  /** Lo que el modelo dijo que supuso. */
  supuso: string[];
  /** Avisos que mandan el pedido a aprobación (posible duplicado, cambia un dato verificado). */
  fuertes: string[];
  /** Avisos que no bloquean (choque de agenda, posible contradicción). */
  avisos: string[];
  /** Datos que faltan en las fichas tocadas. */
  falta: string[];
  jev?: { fiel: number | null; coherente?: number | null };
}
export interface ReviewItem { id: string; at: string; requestId?: string; kind: 'falta' | 'aviso'; text: string; nodeId?: string; closedAt?: string; closedBy?: string }

const overlap = (a: string, b: string) => { const A = new Set(words(a)), B = new Set(words(b)); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.min(A.size, B.size); };
const nodesById = () => new Map((loadBrainGraph().allNodes || []).map(n => [n.id, n] as [string, BrainNode]));

/** Revisión exacta del plan ANTES de aplicar. */
export function inspectPlan(ops: Op[], supuso: string[] = []): Observations {
  const o: Observations = { supuso: supuso.slice(0, 8), fuertes: [], avisos: [], falta: [] };
  const nodes = nodesById(); const vault = getVaultPath();
  const open = getUnifiedBrainTasks().tasks.filter(t => !t.isCompleted);
  const events = listEvents(vault);
  for (const op of ops) {
    const a = op.args || {};
    if (op.name === 'crear_tarea') {
      const twin = open.find(t => overlap(t.title, String(a.titulo)) >= 0.75 && words(a.titulo).length >= 3);
      if (twin) o.fuertes.push(`La tarea «${String(a.titulo).slice(0, 80)}» se parece a una que ya existe: «${twin.title.slice(0, 80)}»${twin.sourceNodeId && twin.sourceNodeId !== a.ficha ? ` (en ${twin.sourceNodeId})` : ''}. ¿Es la misma?`);
    }
    if (op.name === 'crear_ficha') {
      const name = norm(a.nombre);
      const twin = [...nodes.values()].find(n => n.type === a.tipo && (overlap(displayTitle(n.title), String(a.nombre)) >= 0.99 || (words(a.nombre).length >= 2 && norm(displayTitle(n.title)).includes(name))));
      if (twin) o.fuertes.push(`«${a.nombre}» se parece a una ficha que ya existe: ${displayTitle(twin.title)} (${twin.id}). ¿Es la misma?`);
      const c = a.campos || {};
      if (a.tipo === 'person') {
        if (!c.email_primary && !c.phone_mobile) o.falta.push(`${a.nombre}: sin correo ni teléfono.`);
        if (!(Array.isArray(a.conectar_con) && a.conectar_con.length)) o.falta.push(`${a.nombre}: sin conectar a una empresa.`);
      } else if (!(Array.isArray(a.conectar_con) && a.conectar_con.length)) o.falta.push(`${a.nombre}: sin conectar a un mercado o marca.`);
    }
    if (op.name === 'actualizar_campos') {
      const n = nodes.get(String(a.ficha)); const fm = n?.frontmatter || {};
      const changed = Object.entries(a.campos || {}).filter(([k, v]) => fm[k] !== undefined && fm[k] !== null && fm[k] !== '' && String(fm[k]) !== String(v));
      if (changed.length && fm.verification_status === 'verified') o.fuertes.push(`Cambia datos de una ficha VERIFICADA (${displayTitle(n!.title)}): ${changed.map(([k, v]) => `${k}: «${String(fm[k]).slice(0, 40)}» → «${String(v).slice(0, 40)}»`).join('; ')}.`);
      else if (changed.length) o.avisos.push(`${displayTitle(n!.title)}: se reemplaza ${changed.map(([k]) => `${k} (antes «${String(fm[k]).slice(0, 40)}»)`).join(', ')}.`);
    }
    if (op.name === 'agendar' && a.hora) {
      const title = eventTitle(a);
      const clash = events.find(e => e.date === a.fecha && e.time === a.hora && norm(e.title) !== norm(title) && e.repeat === 'none');
      if (clash) o.avisos.push(`El ${a.fecha} a las ${a.hora} ya tienes «${clash.title}».`);
    }
  }
  // Lo que falta en las fichas de personas que el plan usa.
  const used = new Set(ops.flatMap(op => [op.args?.ficha, ...linked(op.name === 'agendar' ? op.args : {})]).filter(Boolean).map(String));
  const made = new Set(ops.map(createdIdOf).filter(Boolean) as string[]);
  for (const id of used) {
    if (made.has(id)) continue; const n = nodes.get(id); if (!n || n.type !== 'person') continue; const fm = n.frontmatter || {};
    if (!fm.email_primary && !fm.phone_mobile && !fm.whatsapp) o.falta.push(`${displayTitle(n.title)}: sin correo ni teléfono.`);
  }
  o.fuertes = [...new Set(o.fuertes)].slice(0, 10); o.avisos = [...new Set(o.avisos)].slice(0, 10); o.falta = [...new Set(o.falta)].slice(0, 12);
  return o;
}

/** Texto corto de cómo estaban las fichas que el plan va a tocar (para que Jev compare después). */
export function snapshotBefore(ops: Op[]): string {
  const nodes = nodesById(); const ids = [...new Set(ops.filter(o => o.name === 'registrar_novedad' || o.name === 'actualizar_campos').map(o => String(o.args?.ficha)))].slice(0, 4);
  return ids.map(id => { const n = nodes.get(id); if (!n) return ''; const fm = n.frontmatter || {}; const state = (String(n.body || '').match(/## Estado actual\s+([\s\S]*?)(?=\n## |$)/)?.[1] || '').trim().slice(0, 500);
    return `FICHA ${displayTitle(n.title)}: ${state || '(sin estado actual)'}${fm.next_followup_date ? ` · próximo paso ${String(fm.next_followup_date).slice(0, 10)}: ${fm.next_followup_action || ''}` : ''}`; }).filter(Boolean).join('\n');
}

// ---------- Bandeja «Por revisar» ----------
const file = (v: string) => path.join(cerebroDir(v), 'review.json');
export function listReview(vaultPath: string): ReviewItem[] { try { const d = JSON.parse(fs.readFileSync(file(vaultPath), 'utf8')); return Array.isArray(d) ? d : []; } catch { return []; } }
function save(vaultPath: string, items: ReviewItem[]) {
  const open = items.filter(i => !i.closedAt), closed = items.filter(i => i.closedAt).slice(0, 200);
  fs.mkdirSync(cerebroDir(vaultPath), { recursive: true }); const tmp = file(vaultPath) + '.tmp'; fs.writeFileSync(tmp, JSON.stringify([...open.slice(0, 300), ...closed])); fs.renameSync(tmp, file(vaultPath));
}
/** Después de aplicar: lo que falta y los avisos pasan a «Por revisar» (sin repetir los que ya están abiertos). */
export function fileObservations(vaultPath: string, requestId: string, o: Observations): number {
  const items = listReview(vaultPath); const have = new Set(items.filter(i => !i.closedAt).map(i => i.text)); let n = 0;
  const add = (kind: ReviewItem['kind'], text: string) => { if (have.has(text)) return; have.add(text); items.unshift({ id: `rev-${crypto.randomBytes(4).toString('hex')}`, at: new Date().toISOString(), requestId, kind, text }); n++; };
  for (const t of [...o.fuertes, ...o.avisos]) add('aviso', t);
  for (const t of o.falta) add('falta', t);
  if (n) save(vaultPath, items);
  return n;
}
export function closeReview(vaultPath: string, id: string, by: string): boolean {
  const items = listReview(vaultPath); const it = items.find(i => i.id === id && !i.closedAt); if (!it) return false;
  it.closedAt = new Date().toISOString(); it.closedBy = by; save(vaultPath, items); return true;
}

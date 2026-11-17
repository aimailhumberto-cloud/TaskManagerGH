/**
 * Actividad de cada cerebro para el administrador: quién entró, qué hizo el agente de cada persona y qué cambió.
 * Solo lectura. Lee lo que el sistema YA registra: llamadas de agentes (activity.jsonl), intentos bloqueados, diario de cambios,
 * casos del Cerebro y llaves de agente. No registra ni lee el contenido de las fichas.
 * Lo que NO se registra (y por eso no aparece): qué pantallas abrió una persona, solo cuándo entró por última vez.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getSleepDir } from '../dotsSleep';
import { readJournal } from '../journal';
import { listRequests } from './engine';

const DAY = 86_400_000;
export interface Evento { at: string; quien: string; tipo: 'agente' | 'persona' | 'bloqueado' | 'pedido'; texto: string }
export interface ResumenCerebro {
  existe: boolean;
  /** Llamadas de agentes en el periodo (sin las bloqueadas) y cuántas se bloquearon. */
  llamadas: number; bloqueadas: number; ultimaLlamada: string | null;
  /** Pedidos al Cerebro (casos abiertos) y cambios guardados en el diario, en el periodo. */
  pedidos: number; cambios: number; ultimoCambio: string | null;
  eventos: Evento[];
}

const readLines = (file: string): Record<string, any>[] => {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as Record<string, any>[]; } catch { return []; }
};
const door = (e: Record<string, any>) => `${String(e.path || '').replace('/api/agent/', '')}${e.action ? ` · ${e.action}` : ''}`;
const iso = (n: number) => new Date(n).toISOString();

/** Lo que pasó en una bóveda en los últimos `dias` días. `vault` null o inexistente = sin cerebro todavía. */
export function resumenCerebro(vault: string | null, nombre: string, dias = 7, now = Date.now(), maxEventos = 40): ResumenCerebro {
  const vacio: ResumenCerebro = { existe: false, llamadas: 0, bloqueadas: 0, ultimaLlamada: null, pedidos: 0, cambios: 0, ultimoCambio: null, eventos: [] };
  if (!vault || !fs.existsSync(vault)) return vacio;
  const since = now - dias * DAY; const eventos: Evento[] = [];
  const act = readLines(path.join(getSleepDir(vault), 'activity.jsonl')).filter(e => Date.parse(e.at) >= since);
  const ok = act.filter(e => !e.blocked), bloq = act.filter(e => e.blocked);
  for (const e of act) eventos.push({ at: e.at, quien: e.blocked ? `${nombre} (agente)` : `${nombre} (agente)`, tipo: e.blocked ? 'bloqueado' : 'agente', texto: `${e.blocked ? 'Bloqueado: ' : ''}${door(e)} → ${e.status}` });
  let cambios = 0, ultimoCambio: string | null = null;
  try {
    for (const j of readJournal(vault, { since: iso(since), limit: 2000 })) {
      if (j.undoOf || !j.at || Date.parse(j.at) < since) continue; cambios++; if (!ultimoCambio || j.at > ultimoCambio) ultimoCambio = j.at;
      const porAgente = /llave|agente/i.test(String(j.via || '')) || /agente/i.test(String(j.actor || ''));
      eventos.push({ at: j.at, quien: porAgente ? `${nombre} (agente)` : String(j.actor || nombre), tipo: porAgente ? 'agente' : 'persona', texto: `Cambio: ${String(j.summary || '').replace(/\s+/g, ' ').slice(0, 110)}` });
    }
  } catch { /* sin diario */ }
  let pedidos = 0;
  try { for (const r of listRequests(vault)) if (Date.parse(r.at) >= since) { pedidos++; eventos.push({ at: r.at, quien: `${nombre} (${/llave|agente/i.test(String(r.via || '')) ? 'agente' : 'persona'})`, tipo: 'pedido', texto: `Pedido al Cerebro: ${String(r.text || '').replace(/\s+/g, ' ').slice(0, 90)}` }); } } catch { /* sin casos */ }
  eventos.sort((a, b) => b.at.localeCompare(a.at));
  return { existe: true, llamadas: ok.length, bloqueadas: bloq.length, ultimaLlamada: ok.length ? ok.map(e => e.at as string).sort().pop()! : null, pedidos, cambios, ultimoCambio, eventos: eventos.slice(0, maxEventos) };
}

export interface FilaPersona {
  id: string; nombre: string; correo: string; rol: string; activa: boolean; ultimoIngreso: string | null;
  llaves: { id: string; nombre: string; alcance: string; ultimoUso: string | null; revocada: boolean }[];
  cerebro: Omit<ResumenCerebro, 'eventos'>;
  /** Una frase para el administrador: ¿ya entró?, ¿ya conectó su agente?, ¿lo usa? */
  estado: 'sin_entrar' | 'sin_agente' | 'agente_sin_usar' | 'activo' | 'inactiva';
}
export function estadoDe(f: Pick<FilaPersona, 'activa' | 'ultimoIngreso' | 'llaves'> & { cerebro: { llamadas: number; pedidos: number; cambios: number } }): FilaPersona['estado'] {
  if (!f.activa) return 'inactiva';
  if (!f.ultimoIngreso) return 'sin_entrar';
  const vivas = f.llaves.filter(k => !k.revocada);
  if (!vivas.length) return 'sin_agente';
  if (!vivas.some(k => k.ultimoUso) && f.cerebro.llamadas === 0) return 'agente_sin_usar';
  return 'activo';
}

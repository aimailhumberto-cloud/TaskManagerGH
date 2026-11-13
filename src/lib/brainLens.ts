/**
 * Ojos del cerebro (fase 2): todo lo que un agente necesita para leer rápido y con contexto, sin IA.
 *   compactMap   → mapa liviano: una línea por ficha (id, nombre, tipo, padre, país, fecha, conexiones).
 *   searchBrain  → buscador por palabras (sin acentos, con sinónimos de países), con extracto.
 *   nodeContext  → una ficha con su entorno: quién la menciona, a quién apunta, tareas, agenda, cambios.
 *   dossier      → el expediente: respuesta, contactos, último contacto, próximos pasos, agenda, cambios,
 *                  cifras, archivos, «puede interesarte» y «lo que falta». Cada dato dice de qué ficha sale.
 * Todo sale del cerebro vivo; nada se inventa. En la fase 3 el Cerebro (IA) redacta encima de esto.
 */
import * as path from 'path';
import { loadBrainGraph, getBrainNodeDetail, getUnifiedBrainTasks, getVaultPath, getPanamaDate, getVaultVersion, type BrainNode } from './smjBrainService';
import { readJournal, type JournalEntry } from './journal';
import { addDays, listEvents, mergedAgenda } from './agenda';
import { listKpis } from './kpis';
import { tr, replyLang } from './reqLang';

// ---------- Texto ----------
export const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const STOP = new Set('a al ante como con de del desde el en entre es esta este la las lo los para por que se sin sobre su sus un una uno y o the of and for in on to with from at by is are this that its'.split(' '));
const SYN: Record<string, string[]> = {
  belice: ['belize'], belize: ['belice'], eeuu: ['united', 'states'], usa: ['united', 'states'], us: ['united', 'states'], estados: ['united', 'states'], unidos: ['united', 'states'],
  trinidad: ['trinidad'], canada: ['canada'], panama: ['panama'], jamaica: ['jamaica'], distribuidor: ['distributor'], marca: ['brand'], mercado: ['market'], persona: ['person'], cliente: ['customer'],
};
export const words = (s: unknown) => norm(s).split(/[^a-z0-9]+/).filter(w => w.length >= 2 && !STOP.has(w));
const PREFIX = /^(distributor|distribuidor|brand|marca|market|mercado|person|persona|dept|department|departamento|customer|cliente|working memory|routine|project|proyecto|core|role|channel|canal|organization|group|line|product line)\s*[:\-–·]\s*/i;
export const displayTitle = (t: unknown) => String(t || '').replace(PREFIX, '').trim();
const TYPE_EN: Record<string, [string, string]> = { distributor: ['distributor', 'distributors'], brand: ['brand', 'brands'], market: ['market', 'markets'], customer: ['customer', 'customers'], person: ['person', 'people'], organization: ['organization', 'organizations'], department: ['department', 'departments'] };
const TYPE_ES: Record<string, [string, string]> = { distributor: ['distribuidor', 'distribuidores'], brand: ['marca', 'marcas'], market: ['mercado', 'mercados'], customer: ['cliente', 'clientes'], person: ['persona', 'personas'], organization: ['organización', 'organizaciones'], project: ['proyecto', 'proyectos'], department: ['departamento', 'departamentos'], product_line: ['línea', 'líneas'], channel: ['canal', 'canales'], routine: ['rutina', 'rutinas'], core: ['casa matriz', 'casa matriz'], group: ['grupo', 'grupos'] };
const TYPE_WORDS: Record<string, string> = { distribuidor: 'distributor', distribuidores: 'distributor', distributor: 'distributor', distributors: 'distributor', cliente: 'customer', clientes: 'customer', customer: 'customer', marca: 'brand', marcas: 'brand', proyecto: 'project', proyectos: 'project', canal: 'channel', canales: 'channel', mercado: 'market', mercados: 'market', contacto: 'person', contactos: 'person', persona: 'person', personas: 'person', gente: 'person', equipo: 'person' };
const GENERIC_DOMAINS = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com', 'smjaleel.com', 'smjaleel.net']);
const COUNTRY_WORDS = new Set('panama belice belize canada usa eeuu estados unidos united states trinidad tobago jamaica barbados guyana suriname costa rica salvador lucia mexico guatemala honduras nicaragua'.split(' '));
const CATALOG = new Set(['product_variant', 'flavor', 'packaging', 'catalog_listing']);
/** Prioridad al elegir qué ficha nombra una palabra (la marca antes que sus 200 variantes). */
const TYPE_RANK: Record<string, number> = { brand: 10, market: 9, distributor: 9, customer: 8, person: 8, organization: 7, core: 7, group: 6, department: 6, project: 6, routine: 5, channel: 5, client_group: 5, country: 5, product_line: 4, site: 3, working_memory: 2, consolidation_session: 1 };
const PARENT_RELS = ['belongs_to_line', 'belongs_to_brand', 'belongs_to_market', 'operates_in_market', 'belongs_to', 'part_of', 'channel_of', 'reports_to', 'parent_company', 'market'];
const DROP = /^(visual_|icon_|source_file_sha256|person_evidence_audit|observed_on|availability_snapshot|.*_raw$|.*_sha256$|.*_asset_id$|.*_local_file$|.*_source_url$)/;

// ---------- Índice (se rehace solo si cambió la bóveda) ----------
interface Edge { id: string; rel: string }
interface Idx { version: string; nodes: BrainNode[]; byId: Map<string, BrainNode>; out: Map<string, Edge[]>; inn: Map<string, Edge[]>; title: Map<string, Set<string>>; tags: Map<string, Set<string>>; body: Map<string, string> }
const g = globalThis as unknown as { __lensIdx?: Map<string, Idx> };
const cache = (g.__lensIdx ??= new Map());

function index(): Idx {
  const key = path.resolve(getVaultPath()), version = getVaultVersion();
  const hit = cache.get(key); if (hit && hit.version === version) return hit;
  const graph = loadBrainGraph(); const nodes = (graph.allNodes || graph.nodes) as BrainNode[];
  const byId = new Map(nodes.map(n => [n.id, n]));
  const out = new Map<string, Edge[]>(), inn = new Map<string, Edge[]>();
  for (const l of graph.links) {
    if (!byId.has(l.source) || !byId.has(l.target) || l.source === l.target) continue;
    (out.get(l.source) || out.set(l.source, []).get(l.source)!).push({ id: l.target, rel: l.relationType });
    (inn.get(l.target) || inn.set(l.target, []).get(l.target)!).push({ id: l.source, rel: l.relationType });
  }
  const title = new Map<string, Set<string>>(), tags = new Map<string, Set<string>>(), body = new Map<string, string>();
  for (const n of nodes) {
    const fm = n.frontmatter || {};
    title.set(n.id, new Set(words([n.title, n.id.replace(/-/g, ' '), fm.short_name, fm.company_name, fm.legal_name, ...(Array.isArray(fm.aliases) ? fm.aliases : [])].join(' '))));
    tags.set(n.id, new Set(words([n.type, n.country, fm.market, fm.based_in_city, fm.job_title, fm.organization, ...(Array.isArray(fm.tags) ? fm.tags : [])].join(' '))));
    body.set(n.id, norm(n.body).slice(0, 6000));
  }
  const idx = { version, nodes, byId, out, inn, title, tags, body };
  if (cache.size > 12) cache.clear();
  cache.set(key, idx); return idx;
}

const rel = (n: BrainNode) => path.relative(getVaultPath(), n.filePath).split(path.sep).join('/');
const updated = (n: BrainNode) => String(n.frontmatter?.updated_at || n.frontmatter?.last_updated_at || '') || null;
const verif = (n: BrainNode) => String(n.frontmatter?.verification_status || n.status || '') || null;
const ref = (n: BrainNode) => ({ id: n.id, title: displayTitle(n.title), type: n.type });
const neighbours = (ix: Idx, id: string) => [...(ix.out.get(id) || []).map(e => ({ ...e, dir: 'out' as const })), ...(ix.inn.get(id) || []).map(e => ({ ...e, dir: 'in' as const }))];
const relLabel = (r: string) => r.replace(/_/g, ' ');

function parentOf(ix: Idx, n: BrainNode): string | null {
  const outs = ix.out.get(n.id) || [];
  for (const r of PARENT_RELS) { const e = outs.find(x => x.rel === r); if (e) return e.id; }
  return n.market_id && ix.byId.has(n.market_id) ? n.market_id : null;
}

// ---------- Mapa compacto ----------
export function compactMap(opts: { type?: string; catalog?: boolean } = {}) {
  const ix = index();
  const types = opts.type ? new Set(opts.type.split(',').map(s => s.trim())) : null;
  const list = ix.nodes.filter(n => (!types || types.has(n.type)) && (opts.catalog !== false || !CATALOG.has(n.type)));
  const counts: Record<string, number> = {}; for (const n of ix.nodes) counts[n.type] = (counts[n.type] || 0) + 1;
  return {
    version: ix.version, total: ix.nodes.length, shown: list.length, countsByType: counts,
    columns: ['id', 'nombre', 'tipo', 'padre', 'país', 'actualizada', 'conexiones'],
    nodes: list.map(n => [n.id, displayTitle(n.title), n.type, parentOf(ix, n), n.country || null, updated(n)?.slice(0, 10) || null, (ix.out.get(n.id)?.length || 0) + (ix.inn.get(n.id)?.length || 0)]),
  };
}

// ---------- Buscador ----------
export interface Hit { id: string; title: string; type: string; score: number; path: string; updated: string | null; verification: string | null; snippet: string }
export function searchBrain(q: string, opts: { type?: string; limit?: number; catalog?: boolean } = {}): Hit[] {
  const ix = index();
  const base = words(q); if (!base.length) return [];
  const groups = base.map(w => [w, ...(SYN[w] || [])]);
  const phrase = norm(q).trim();
  const types = opts.type ? new Set(opts.type.split(',')) : null;
  const hits: Hit[] = [];
  for (const n of ix.nodes) {
    if (types && !types.has(n.type)) continue;
    if (opts.catalog === false && CATALOG.has(n.type)) continue;
    const t = ix.title.get(n.id)!, tg = ix.tags.get(n.id)!, b = ix.body.get(n.id)!;
    let score = 0, matched = 0;
    for (const grp of groups) {
      let best = 0;
      for (const w of grp) {
        if (t.has(w)) best = Math.max(best, 10);
        else if ([...t].some(x => x.startsWith(w) && w.length >= 3)) best = Math.max(best, 6);
        else if (tg.has(w)) best = Math.max(best, 3);
        else if (w.length >= 3 && b.includes(w)) best = Math.max(best, 1);
      }
      if (best) { matched++; score += best; }
    }
    if (!matched) continue;
    if (phrase.length >= 4 && norm(displayTitle(n.title)).includes(phrase)) score += 15;
    score = score * Math.pow(matched / groups.length, 2) + (TYPE_RANK[n.type] || 0) * 0.1;
    hits.push({ id: n.id, title: displayTitle(n.title), type: n.type, score: Math.round(score * 10) / 10, path: rel(n), updated: updated(n), verification: verif(n), snippet: snippet(n.body, base) });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, opts.limit || 20);
}
function snippet(body: string, ws: string[]): string {
  const lines = String(body || '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const line = lines.find(l => ws.some(w => norm(l).includes(w))) || lines[0] || '';
  return line.replace(/\s+/g, ' ').slice(0, 220);
}

// ---------- Ficha con su entorno ----------
export function cleanFrontmatter(fm: Record<string, any>) {
  return Object.fromEntries(Object.entries(fm || {}).filter(([k]) => !DROP.test(k)));
}
export function nodeContext(id: string) {
  const ix = index();
  const detail = getBrainNodeDetail(id); if (!detail) return null;
  const n = ix.byId.get(detail.id)!;
  const group = (edges: Edge[]) => [...edges.reduce((m, e) => m.set(e.id, [...(m.get(e.id) || []), relLabel(e.rel)]), new Map<string, string[]>())].map(([id, rels]) => ({ ...ref(ix.byId.get(id)!), relation: [...new Set(rels)].join(', ') }));
  const today = getPanamaDate().dateStr;
  const tasks = getUnifiedBrainTasks().tasks.filter(t => t.sourceNodeId === n.id && !t.isCompleted).map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate || null, priority: t.priority, overdue: t.isOverdue }));
  const kw = keywordsOf(n);
  const agenda = upcoming(today, 60).filter(o => kw.some(k => norm(`${o.title} ${o.notes || ''} ${o.location || ''}`).includes(k)));
  const changes = journalFor(new Set([rel(n)]), 30, 20);
  const memory = (ix.inn.get(n.id) || []).map(e => ix.byId.get(e.id)!).filter(m => m.type === 'working_memory' && !['consolidated', 'archived'].includes(String(m.status))).map(m => ({ ...ref(m), status: m.status, capturedAt: m.frontmatter?.captured_at || null }));
  return {
    node: { id: n.id, title: n.title, displayTitle: displayTitle(n.title), type: n.type, path: (detail as any).filePath, hash: (detail as any).hash, updated: updated(n), verification: verif(n), parent: parentOf(ix, n), frontmatter: cleanFrontmatter(n.frontmatter), body: n.body },
    pointsTo: group(ix.out.get(n.id) || []),
    mentionedBy: group((ix.inn.get(n.id) || []).filter(e => !CATALOG.has(ix.byId.get(e.id)!.type))),
    mentionedByCatalog: (ix.inn.get(n.id) || []).filter(e => CATALOG.has(ix.byId.get(e.id)!.type)).length,
    openTasks: tasks, agenda, recentChanges: changes, openMemory: memory,
  };
}

// ---------- Ayudas del expediente ----------
function keywordsOf(n: BrainNode): string[] {
  const fm = n.frontmatter || {};
  return [displayTitle(n.title), fm.short_name, fm.company_name].map(v => norm(v).trim()).filter(v => v.length >= 4).filter((v, i, a) => a.indexOf(v) === i);
}
function upcoming(today: string, days: number) {
  return mergedAgenda(listEvents(getVaultPath()), [], today, addDays(today, days)).filter(o => o.layer === 'reuniones' || o.layer === 'viajes')
    .map(o => { const ev = listEvents(getVaultPath()).find(e => e.id === o.eventId); return { date: o.date, time: o.time || null, kind: o.kind, title: o.title, location: o.location || null, notes: ev?.notes || null, source: o.source }; });
}
function journalFor(paths: Set<string>, days: number, limit: number) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  return readJournal(getVaultPath(), { since, limit: 500 }).filter((e: JournalEntry) => !e.undoneAt && e.files.some(f => paths.has(f.path)))
    .slice(0, limit).map(e => ({ at: e.at, by: e.actor || null, summary: e.summary, changeId: e.id }));
}
const asArray = (v: unknown): string[] => Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? [v] : [];

/** Qué fichas nombra la pregunta: cada palabra apunta a la ficha más importante cuyo nombre la contiene. */
export function resolveEntities(q: string): BrainNode[] {
  const ix = index(); const found: BrainNode[] = [];
  const ws = words(q).filter(w => !TYPE_WORDS[w]); const used = new Set<number>();
  // Primero frases de 2-3 palabras (Morgan Williams, Caribbean Cool), luego palabras sueltas.
  for (const size of [3, 2, 1]) for (let i = 0; i + size <= ws.length; i++) {
    if ([...Array(size).keys()].some(k => used.has(i + k))) continue;
    const grp = ws.slice(i, i + size); const alts = size === 1 ? [grp[0], ...(SYN[grp[0]] || [])] : grp;
    // Una frase de varias palabras cuenta solo si aparece seguida en el nombre (Morgan Williams, Caribbean Cool).
    const cands = ix.nodes.filter(n => size === 1 ? alts.some(w => ix.title.get(n.id)!.has(w)) : words(displayTitle(n.title)).join(' ').includes(grp.join(' ')) && (TYPE_RANK[n.type] || 0) >= 3);
    if (!cands.length) continue;
    if (size === 1 && cands.length > 40 && !cands.some(n => (TYPE_RANK[n.type] || 0) >= 8)) continue; // palabra demasiado común
    // Un país nombra a su mercado (no al distribuidor que lleva el país en el nombre).
    const isCountry = size === 1 && COUNTRY_WORDS.has(grp[0]);
    const rank = (n: BrainNode) => (isCountry && n.type === 'market' ? 100 : 0) + (TYPE_RANK[n.type] || 0);
    const best = cands.sort((a, b) => rank(b) - rank(a) || deg(ix, b.id) - deg(ix, a.id))[0];
    if (!found.includes(best)) found.push(best);
    for (let k = 0; k < size; k++) used.add(i + k);
  }
  return found.slice(0, 4);
}
const deg = (ix: Idx, id: string) => (ix.out.get(id)?.length || 0) + (ix.inn.get(id)?.length || 0);

// ---------- Expediente ----------
export type DossierSize = 'breve' | 'normal' | 'completo';
export function dossier(input: { q?: string; nodeIds?: string[]; size?: DossierSize }) {
  const ix = index(); const size = input.size || 'normal';
  const L = size === 'breve' ? { contacts: 3, steps: 4, agenda: 3, changes: 0, interest: 3, actions: 2 } : size === 'completo' ? { contacts: 20, steps: 25, agenda: 15, changes: 25, interest: 10, actions: 8 } : { contacts: 8, steps: 10, agenda: 8, changes: 10, interest: 6, actions: 4 };
  const { dateStr, timeStr } = getPanamaDate();
  let matched = (input.nodeIds || []).map(id => ix.byId.get(id) || ix.nodes.find(n => n.id.toLowerCase() === id.toLowerCase())).filter(Boolean) as BrainNode[];
  if (!matched.length && input.q) matched = resolveEntities(input.q);
  if (!matched.length && input.q) matched = searchBrain(input.q, { limit: 3, catalog: false }).map(h => ix.byId.get(h.id)!).filter(Boolean);
  if (!matched.length) return { ok: false as const, error: tr('No encontré fichas que coincidan con la pregunta.', 'I found no notes that match the question.'), suggestions: input.q ? searchBrain(input.q, { limit: 5 }).map(h => ({ id: h.id, title: h.title, type: h.type })) : [] };

  // Lo que une a las fichas nombradas: con «Busta en Canadá», los distribuidores conectados a las dos.
  const mids = new Set(matched.map(n => n.id));
  let core: BrainNode[] = [];
  if (matched.length >= 2) {
    const tally = new Map<string, number>();
    for (const m of matched) for (const id of new Set(neighbours(ix, m.id).map(e => e.id))) if (!mids.has(id)) tally.set(id, (tally.get(id) || 0) + 1);
    const need = matched.length;
    core = [...tally].filter(([id, c]) => c >= need && !CATALOG.has(ix.byId.get(id)!.type) && !['working_memory', 'person', 'consolidation_session'].includes(ix.byId.get(id)!.type)).map(([id]) => ix.byId.get(id)!)
      .sort((a, b) => (TYPE_RANK[b.type] || 0) - (TYPE_RANK[a.type] || 0) || deg(ix, b.id) - deg(ix, a.id)).slice(0, 6);
  }
  const wanted = new Set(words(input.q || '').map(w => TYPE_WORDS[w]).filter(Boolean));
  if (wanted.size && !wanted.has('person')) {
    const typed = core.length ? core.filter(n => wanted.has(n.type)) : [];
    core = typed.length ? typed : [...new Map(matched.flatMap(m => neighbours(ix, m.id)).map(e => ix.byId.get(e.id)!).filter(n => wanted.has(n.type) && !mids.has(n.id)).map(n => [n.id, n])).values()].slice(0, 8);
  }
  const primary = core.length ? core : matched;
  const focus = [...new Map([...matched, ...core].map(n => [n.id, n])).values()];
  const fids = new Set(focus.map(n => n.id));
  const src = (n: BrainNode) => ({ from: n.id, verification: verif(n) });

  // Contactos: los de la ficha (direct_contacts) y las personas conectadas, primero las del núcleo.
  const contacts: any[] = []; const seen = new Set<string>();
  const personCard = (p: BrainNode, extra: Record<string, unknown> = {}) => { const fm = p.frontmatter || {}; return { name: displayTitle(p.title), role: fm.job_title || null, of: fm.organization || null, email: fm.email_primary || null, phone: fm.phone_mobile || fm.phone_office_ext || null, whatsapp: fm.whatsapp || null, ...extra, ...src(p) }; };
  for (const p of matched.filter(m => m.type === 'person')) { seen.add(p.id); contacts.push(personCard(p, { relation: 'es la persona buscada' })); }
  for (const n of primary.concat(matched)) {
    const dc = n.frontmatter?.direct_contacts;
    if (dc && typeof dc === 'object' && !Array.isArray(dc) && (dc.email || dc.phone || dc.whatsapp)) {
      const k = `dc:${n.id}`; if (!seen.has(k)) { seen.add(k); contacts.push({ name: dc.name || dc.contact_name || `Contacto general de ${displayTitle(n.title)}`, role: dc.role || null, of: displayTitle(n.title), email: dc.email || null, phone: dc.phone || null, whatsapp: dc.whatsapp || null, ...src(n) }); }
    }
    for (const e of neighbours(ix, n.id)) {
      const p = ix.byId.get(e.id)!; if (p.type !== 'person' || seen.has(p.id)) continue; seen.add(p.id);
      contacts.push(personCard(p, { of: p.frontmatter?.organization || displayTitle(n.title), relation: `${relLabel(e.rel)} · ${displayTitle(n.title)}` }));
    }
  }
  // Personas de la misma empresa por el dominio del correo (jenna@morganwilliams.ca ↔ Morgan Williams), aunque nadie las haya conectado.
  const domainOf = (e: unknown) => { const m = /@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(String(e || '').trim()); return m ? m[1].toLowerCase() : ''; };
  const unlinked: string[] = [];
  for (const n of primary) {
    const fm = n.frontmatter || {}; const dc = fm.direct_contacts && typeof fm.direct_contacts === 'object' ? fm.direct_contacts : {};
    const doms = new Set([dc.email, fm.email_orders, fm.email_accounting, fm.email_primary].map(domainOf).filter(d => d && !GENERIC_DOMAINS.has(d)));
    if (!doms.size) continue;
    for (const p of ix.nodes) {
      if (p.type !== 'person' || !doms.has(domainOf(p.frontmatter?.email_primary))) continue;
      const linked = neighbours(ix, n.id).some(e => e.id === p.id);
      if (!linked) unlinked.push(tr(`${displayTitle(p.title)} tiene correo de ${displayTitle(n.title)} pero su ficha no está conectada a ella.`, `${displayTitle(p.title)} has an email from ${displayTitle(n.title)} but their note is not connected to it.`));
      const card = personCard(p, { relation: `correo de ${displayTitle(n.title)}`, of: p.frontmatter?.organization || displayTitle(n.title) });
      const general = contacts.findIndex(c => c.from === n.id && String(c.name).startsWith('Contacto general') && c.email && String(c.email).toLowerCase() === String(p.frontmatter?.email_primary || '').toLowerCase());
      if (general >= 0) {
        const dup = contacts.findIndex(c => c.from === p.id); if (dup >= 0 && dup !== general) contacts.splice(dup, 1);
        contacts.splice(contacts.findIndex(c => c.from === n.id && String(c.name).startsWith('Contacto general')), 1, card);
      } else if (!seen.has(p.id)) contacts.splice(Math.min(1, contacts.length), 0, card);
      seen.add(p.id);
    }
  }
  for (const n of primary) {
    const keys = keywordsOf(n).map(k => k.replace(/\s*\(.*\)$/, '')).filter(k => k.length >= 4);
    for (const p of ix.nodes) if (p.type === 'person' && !seen.has(p.id) && keys.some(k => norm(p.frontmatter?.organization).includes(k))) { seen.add(p.id); contacts.splice(1, 0, personCard(p, { relation: tr(`trabaja en ${displayTitle(n.title)}`, `works at ${displayTitle(n.title)}`) })); }
  }
  const lastContact: any[] = [];
  for (const n of focus) {
    const fm = n.frontmatter || {};
    if (fm.last_email_date || fm.last_email_subject) lastContact.push({ kind: 'correo', date: String(fm.last_email_date || '').slice(0, 10) || null, subject: fm.last_email_subject || null, sender: fm.last_email_sender || null, node: displayTitle(n.title), ...src(n) });
    for (const a of (Array.isArray(fm.recent_actions) ? fm.recent_actions : []).slice(0, L.actions)) lastContact.push({ kind: a.type || 'nota', date: String(a.date || '').slice(0, 10) || null, summary: a.summary || null, node: displayTitle(n.title), ...src(n) });
  }
  lastContact.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const tasks = getUnifiedBrainTasks();
  const steps = [
    ...focus.filter(n => n.frontmatter?.next_followup_date || n.frontmatter?.next_followup_action).filter(n => n.frontmatter?.next_followup_completed !== true)
      .map(n => ({ kind: 'seguimiento', date: n.frontmatter.next_followup_date || null, title: n.frontmatter.next_followup_action || 'Seguimiento', node: displayTitle(n.title), ...src(n) })),
    ...tasks.tasks.filter(t => !t.isCompleted && fids.has(t.sourceNodeId) && !t.id.startsWith('fu-'))
      .map(t => ({ kind: 'tarea', date: t.dueDate || null, title: t.title, taskId: t.id, overdue: t.isOverdue, node: displayTitle(ix.byId.get(t.sourceNodeId)?.title), from: t.sourceNodeId, verification: null })),
  ].sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999'))).slice(0, L.steps);
  const kws = focus.flatMap(keywordsOf);
  const agenda = upcoming(dateStr, 45).filter(o => kws.some(k => norm(`${o.title} ${o.notes || ''} ${o.location || ''}`).includes(k))).slice(0, L.agenda);
  const changes = L.changes ? journalFor(new Set(focus.map(rel)), 14, L.changes) : [];
  const figures: any[] = [];
  for (const d of tasks.distributors) { const n = focus.find(f => norm(displayTitle(f.title)) === norm(d.name) || norm(f.frontmatter?.company_name) === norm(d.name) || norm(f.frontmatter?.short_name) === norm(d.name)); if (n) figures.push({ name: `Cuota ${displayTitle(n.title)}`, target: d.targetCasesYear ?? null, actual: d.actualCasesYTD ?? null, compliance: typeof d.complianceRate === 'number' ? d.complianceRate : null, status: d.status, ...src(n) }); }
  for (const k of listKpis(getVaultPath())) if (kws.some(w => norm(k.name).includes(w))) figures.push({ name: k.name, value: k.value, unit: k.unit, target: k.target, period: k.period, updatedAt: k.updatedAt, from: 'kpis', verification: null });
  const files = focus.map(n => ({ node: displayTitle(n.title), path: rel(n), images: [...asArray(n.frontmatter?.avatar_image), ...asArray(n.frontmatter?.visual_logo_url), ...asArray(n.frontmatter?.gallery_photos)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6), from: n.id }));

  // Puede interesarte: lo conectado al núcleo que no se pidió, con el porqué.
  const cand = new Map<string, { n: BrainNode; score: number; why: string[] }>();
  for (const f of focus) for (const e of neighbours(ix, f.id)) {
    const n = ix.byId.get(e.id)!; if (fids.has(n.id) || CATALOG.has(n.type) || n.type === 'person' || n.type === 'consolidation_session') continue;
    const c = cand.get(n.id) || { n, score: 0, why: [] }; c.score += 2; if (c.why.length < 2) c.why.push(`${relLabel(e.rel)} · ${displayTitle(f.title)}`); cand.set(n.id, c);
  }
  for (const c of cand.values()) {
    const fu = c.n.frontmatter?.next_followup_date; if (fu && fu <= addDays(dateStr, 14) && c.n.frontmatter?.next_followup_completed !== true) { c.score += 2; c.why.unshift(`seguimiento el ${fu}`); }
    const open = tasks.tasks.filter(t => t.sourceNodeId === c.n.id && !t.isCompleted).length; if (open) { c.score += 1; c.why.push(`${open} tarea${open > 1 ? 's' : ''} abierta${open > 1 ? 's' : ''}`); }
    const u = updated(c.n); if (u && Date.now() - Date.parse(u) < 7 * 86400_000) { c.score += 1; c.why.push('cambió esta semana'); }
    if (['project', 'customer', 'routine'].includes(c.n.type)) c.score += 1;
  }
  const mayInterest = [...cand.values()].sort((a, b) => b.score - a.score || deg(ix, b.n.id) - deg(ix, a.n.id)).slice(0, L.interest).map(c => ({ ...ref(c.n), why: c.why.slice(0, 2).join('; ') }));

  const missing: string[] = [];
  if (!contacts.some(c => c.email || c.phone || c.whatsapp)) missing.push(tr('No hay un contacto con correo o teléfono en estas fichas.', 'There is no contact with an email or phone in these notes.'));
  if (!lastContact.length) missing.push(tr('No hay registro de último contacto (correo o reunión).', 'There is no record of a last contact (email or meeting).'));
  if (!steps.length) missing.push(tr('No hay próximo paso ni tareas abiertas.', 'There is no next step or open task.'));
  for (const n of primary.filter(p => p.type === 'distributor')) if (!figures.some(f => f.from === n.id && (f.target || f.actual))) missing.push(tr(`La cuota de ${displayTitle(n.title)} no está cargada.`, `The quota for ${displayTitle(n.title)} is not loaded.`));
  for (const n of focus) if (!verif(n) || /pending|unverif/.test(String(verif(n)))) missing.push(tr(`${displayTitle(n.title)} no está verificada.`, `${displayTitle(n.title)} is not verified.`));
  missing.push(...unlinked);

  const ask = matched.map(n => displayTitle(n.title)).join(' + ');
  const cut = (t: unknown, n = 140) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const groupTxt = Object.entries(core.reduce((m: Record<string, string[]>, n) => { (m[n.type] ||= []).push(displayTitle(n.title)); return m; }, {}))
    .map(([t, names]) => { const T = replyLang() === 'en' ? TYPE_EN : TYPE_ES; return `${names.join(tr(' y ', ' and '))} (${T[t] ? (names.length > 1 ? T[t][1] : T[t][0]) : t})`; }).join('; ');
  const main = contacts.find(c => c.email || c.phone);
  const answer = [
    core.length ? `${ask}: ${groupTxt}.` : `${ask} (${(replyLang() === 'en' ? TYPE_EN : TYPE_ES)[matched[0].type]?.[0] || matched[0].type}).`,
    main ? `${tr('Contacto principal', 'Main contact')}: ${main.name}${main.role ? `, ${main.role}` : ''}${main.email ? ` (${main.email})` : ''}.` : '',
    lastContact[0] ? `${tr('Último registro', 'Last record')}: ${lastContact[0].date || tr('s/f', 'n/d')} · ${cut(lastContact[0].subject || lastContact[0].summary || lastContact[0].kind)}` : '',
    steps[0] ? `${tr('Próximo paso', 'Next step')}: ${steps[0].date || tr('sin fecha', 'no date')} · ${cut(steps[0].title, 100)}${(steps[0] as any).overdue || (steps[0].date && steps[0].date < dateStr) ? tr(' (vencido)', ' (overdue)') : ''}` : '',
  ].filter(Boolean).join(' ');

  return {
    ok: true as const, size, question: input.q || null,
    answer,
    matched: matched.map(n => ({ ...ref(n), path: rel(n) })),
    core: core.map(n => ({ ...ref(n), path: rel(n) })),
    sources: focus.map(n => ({ ...ref(n), path: rel(n), updated: updated(n), verification: verif(n) })),
    contacts: contacts.slice(0, L.contacts), lastContact: lastContact.slice(0, L.contacts), nextSteps: steps, agenda, changes, figures,
    files: size === 'breve' ? [] : files, mayInterest, missing: [...new Set(missing)],
    dataAsOf: { iso: new Date().toISOString(), panama: `${dateStr} ${timeStr}`, vaultVersion: ix.version },
    howToGoDeeper: 'GET /api/agent/brain?node=<id>&context=1 para una ficha con su entorno; GET /api/agent/search?q= para buscar más.',
  };
}

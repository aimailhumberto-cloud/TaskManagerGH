import { NextRequest, NextResponse } from 'next/server';
import { withBrain, listBrains, companyBrainExists, COMPANY_BRAIN_ID, PRIMARY_BRAIN_ID } from '@/lib/brains';
import { currentBrain } from '@/lib/brainContext';
import { getUnifiedBrainTasks, loadBrainGraph, getPanamaDate } from '@/lib/smjBrainService';
import { applyDecisions, loadDecisions, loadLatestReport } from '@/lib/dotsSleep';
import { loadAutonomy, recentActivity } from '@/lib/autonomy';
import { recentAppliedAll } from '@/lib/sleepApply';
import { querySharedNodes } from '@/lib/sharing';
import { getAccount, listAccounts, TOP_ROLES, canManageUsers } from '@/lib/localAccounts';
import { listKpis, loadPrefs, savePrefs } from '@/lib/kpis';
import { computeGrowth, recordGrowth } from '@/lib/brainGrowth';
import { addDays, dayLoads, listEvents, mergedAgenda } from '@/lib/agenda';
export const dynamic = 'force-dynamic';

/** Todo lo que necesita el tablero inicial, del cerebro de quien entra. Solo lectura. */
/** De dónde sale cada bloque del tablero y cómo lo mantiene un agente. Se sirve con ?guide=1. */
const GUIDE = {
  nota: 'Casi todo el tablero se calcula solo del cerebro: basta con mantener el cerebro al día. Solo los indicadores, las cuotas y las ciudades se cargan a propósito. No inventes cifras: si no tienes el dato, pregúntale a la persona.',
  primero: [
    "Registrar una novedad: POST /api/agent/brain {action:'record', nodeId, summary, source?, followup?, lastEmail?, state?, event?, task?} — ficha, agenda y tarea en una llamada; devuelve receipt.",
    'Qué cambió: GET /api/agent/changes?since=AAAA-MM-DD. Deshacer: POST /api/agent/changes {action:\'undo\', changeId}.',
    'Brief de la mañana: GET /api/agent/brief?since=AAAA-MM-DD — se arma solo con esos datos.',
    'Reescribir un archivo existente exige ifMatch (el hash de la lectura). Reintentos: encabezado Idempotency-Key.',
  ],
  bloques: [
    { bloque: 'Tareas vencidas, Para hoy, Mis tareas de hoy, Agenda de la semana, Mis tareas abiertas', origen: 'Tareas y seguimientos con fecha del cerebro', como: "POST /api/agent/tasks {action:'create'|'complete'|'reschedule'}; seguimientos con POST /api/agent/brain {action:'update_dossier', nodeId, nextFollowupDate, nextFollowupAction}" },
    { bloque: 'Fichas en mi cerebro, De qué está hecho mi cerebro, Fichas por país, Mis marcas', origen: 'Fichas del cerebro (tipo, país, enlaces)', como: "POST /api/agent/brain {action:'remember_working'} para capturar; {action:'upsert_node'} para crear o corregir fichas" },
    { bloque: 'Calidad de las fichas', origen: 'Campo completeness_score de cada ficha', como: "Completa los datos de la ficha con upsert_node y actualiza su completeness_score" },
    { bloque: 'Qué tan confiable es lo que sé', origen: 'Campo verification_status de cada ficha', como: 'Solo se marca verificado cuando hay una fuente confirmada; cita la fuente en la ficha' },
    { bloque: 'Salud', origen: 'Informe nocturno (enlaces rotos, fichas sin conexión) y memoria de trabajo', como: 'Corrige enlaces y conecta fichas; consolida la memoria de trabajo' },
    { bloque: 'Cómo crece mi cerebro', origen: 'Foto diaria de cifras, fechas de creación de las fichas (created_at, captured_at), consolidaciones (promoted_at), cambios aplicados e informes nocturnos', como: 'No se carga a mano. Para que la curva sea fiel, pon created_at en cada ficha nueva' },
    { bloque: 'Mis indicadores', origen: 'Lista de indicadores del cerebro', como: "POST /api/agent/kpis {action:'set', name, value, unit?, target?, period?, note?}" },
    { bloque: 'Cuotas de distribuidores', origen: 'Campos target_cases_year y actual_cases_ytd de la ficha de cada distribuidor', como: "POST /api/agent/kpis {action:'set_quota', nodeId, targetCasesYear?, actualCasesYtd?, note?}" },
    { bloque: 'Agenda (calendario fusionado) y Agenda de la semana', origen: 'Eventos de la agenda (reuniones, viajes) más tareas y seguimientos con fecha', como: "POST /api/agent/agenda {action:'set', kind:'reunion'|'viaje'|'evento', title, date, time?, endTime?, endDate?, location?, repeat?:'none'|'daily'|'weekly'|'monthly'|'yearly', weekdays?:[0=domingo..6], until?}. Para lo que venga de Outlook usa source:'outlook' y externalId: así no se duplica al volver a cargarlo. GET /api/agent/agenda?from=&to= devuelve el calendario fusionado." },
    { bloque: 'Lo que hicieron Jev y mi agente', origen: 'Registro automático de cambios y de escrituras con llave', como: 'No se carga a mano' },
    { bloque: 'Clima y ciudades', origen: 'Ubicación del navegador y ciudades guardadas', como: "POST /api/agent/dashboard {action:'places', home:{name,lat,lon}, hq:{name,lat,lon}}" },
    { bloque: 'Compañía y compartido', origen: 'Cerebro de la compañía y fichas que otros comparten', como: "POST /api/agent/shared {action:'set_visibility', nodeId, visibility, sharedWith?}" },
  ],
};

async function _GET(req: NextRequest) {
  if (new URL(req.url).searchParams.get('guide') === '1') return NextResponse.json({ ok: true, guide: GUIDE });
  const ctx = currentBrain();
  if (!ctx) return NextResponse.json({ ok: false, error: 'Sin cerebro.' }, { status: 401 });
  const own = ctx.ownBrainId || ctx.brainId;
  const me = ctx.actor && ctx.actor.startsWith('local-') ? getAccount(ctx.actor) : null;
  const role = ctx.role || me?.role || '';
  const { dateStr } = getPanamaDate();
  const t = getUnifiedBrainTasks();
  const open = t.tasks.filter(x => !x.isCompleted);
  const lite = (x: (typeof open)[number]) => ({ id: x.id, title: x.title, dueDate: x.dueDate || null, priority: x.priority, isOverdue: x.isOverdue, isToday: x.isToday, source: x.sourceNodeTitle || '' });
  const byDate = (a: { dueDate?: string }, b: { dueDate?: string }) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
  const g = loadBrainGraph();
  const nodes = g.allNodes || g.nodes;
  const report = loadLatestReport(ctx.vaultPath);
  const view = report ? applyDecisions(report, loadDecisions(ctx.vaultPath), new Date()) : null;
  const pending = view ? view.proposals.filter((p: any) => !p.decision) : [];
  let shared: ReturnType<typeof querySharedNodes> = [];
  try { shared = querySharedNodes(own, '', 5); } catch {}
  // Indicadores calculados del cerebro (gráficas del tablero)
  const typeCounts: Record<string, number> = {}; const countryCounts: Record<string, number> = {};
  let verified = 0, pendingVer = 0, scored = 0, scoreSum = 0;
  const COUNTRY: Record<string, string> = { belize: 'Belice', us: 'Estados Unidos', 'united states': 'Estados Unidos', usa: 'Estados Unidos', ca: 'Canadá', canada: 'Canadá', panama: 'Panamá', 'trinidad & tobago': 'Trinidad y Tobago', 'trinidad and tobago': 'Trinidad y Tobago' };
  for (const n of nodes) {
    typeCounts[n.type || 'otro'] = (typeCounts[n.type || 'otro'] || 0) + 1;
    const c = String(n.country || n.frontmatter?.based_in_country || n.frontmatter?.country_name || '').trim();
    if (c && c.toLowerCase() !== 'global') { const k = COUNTRY[c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')] || c; countryCounts[k] = (countryCounts[k] || 0) + 1; }
    const v = String(n.frontmatter?.verification_status || '').toLowerCase(), st = String(n.status || '').toLowerCase();
    if (v.includes('confirm') || v === 'verified' || st === 'verified') verified++; else if (v.includes('pending') || v.includes('unverif') || st.includes('pending')) pendingVer++;
    if (typeof n.completeness_score === 'number') { scored++; scoreSum += n.completeness_score; }
  }
  const top = (m: Record<string, number>, k: number) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, k).map(([name, value]) => ({ name, value }));
  // La semana y la agenda salen del calendario fusionado: reuniones, viajes, tareas y seguimientos.
  const merged = mergedAgenda(listEvents(ctx.vaultPath), t.tasks as any, dateStr, addDays(dateStr, 13));
  const loads = dayLoads(merged, dateStr, addDays(dateStr, 6));
  const week = Array.from({ length: 7 }, (_, i) => { const dt = addDays(dateStr, i); return { date: dt, count: loads[dt]?.total || 0 }; });
  const brands = nodes.filter(n => n.type === 'brand').map(b => { const name = b.title.replace(/^Brand:\s*/i, '').trim(); const key = name.toLowerCase(); return { name, slug: key.replace(/[^a-z0-9]/g, ''), count: nodes.filter(n => n.id !== b.id && (n.title.toLowerCase().includes(key) || n.links.some(l => l.toLowerCase().includes(key)))).length }; });
  recordGrowth(ctx.vaultPath, nodes, g.links.length, dateStr); // foto diaria de cifras
  const growth = computeGrowth(ctx.vaultPath, nodes, g.links.length, dateStr);
  const viewingOther = ctx.brainId !== own;
  const viewingName = ctx.brainId === COMPANY_BRAIN_ID ? 'la compañía' : ctx.brainId === PRIMARY_BRAIN_ID ? 'HB' : getAccount(ctx.brainId)?.name || ctx.brainId;
  return NextResponse.json({
    ok: true, today: dateStr,
    nav: { tasks: open.filter(x => x.isOverdue || x.isToday).length, meetings: merged.filter(o => o.date === dateStr && (o.layer === 'reuniones' || o.layer === 'viajes')).length, notes: nodes.length },
    me: { name: me?.name || 'HB', role, isPrimary: own === PRIMARY_BRAIN_ID, canManage: canManageUsers(role), isTop: TOP_ROLES.includes(role) },
    brain: { id: ctx.brainId, viewingOther, viewingName, readOnly: !!ctx.readOnly, isEmpty: nodes.length <= 1 && open.length === 0 },
    counts: { overdue: open.filter(x => x.isOverdue).length, today: open.filter(x => x.isToday && !x.isOverdue).length, open: open.length, completed: t.tasks.length - open.length },
    tasksToday: open.filter(x => x.isOverdue || x.isToday).sort(byDate).slice(0, 6).map(lite),
    agenda: merged.slice(0, 6).map(o => ({ id: o.id, title: o.title, dueDate: o.date, priority: 'Medium', isOverdue: !!o.overdue, isToday: o.date === dateStr, source: o.detail || '', time: o.time || null, layer: o.layer })),
    log: {
      autonomy: ctx.primary ? loadAutonomy(ctx.vaultPath).mode : null,
      applied: recentAppliedAll(ctx.vaultPath, 6).filter(a => !a.undoneAt),
      activity: recentActivity(ctx.vaultPath, 6),
      pending: pending.length,
      pendingKinds: pending.reduce((m: Record<string, number>, p: any) => { m[p.kind] = (m[p.kind] || 0) + 1; return m; }, {}),
    },
    health: { nodes: nodes.length, links: g.links.length, brokenLinks: report?.counts?.enlace_roto || 0, isolated: (report?.proposals.find(p => p.kind === 'nodo_aislado')?.nodeIds.length) || 0, working: nodes.filter(n => n.memory_tier === 'working').length },
    shared: { withMe: shared.map(s => ({ title: s.title, owner: s.owner, type: s.type })), companyExists: companyBrainExists() },
    charts: { types: top(typeCounts, 12), countries: top(countryCounts, 6), verification: { verified, pending: pendingVer, other: Math.max(0, nodes.length - verified - pendingVer) }, quality: scored ? Math.round(scoreSum / scored) : null, scored, week, brands,
      tasks: { overdue: open.filter(x => x.isOverdue).length, today: open.filter(x => x.isToday && !x.isOverdue).length, later: open.filter(x => !x.isOverdue && !x.isToday && x.dueDate).length, undated: open.filter(x => !x.dueDate).length } },
    distributors: t.distributors.slice(0, 8).map(x => ({ name: x.name, country: x.country, status: x.status, compliance: typeof x.complianceRate === 'number' ? x.complianceRate : null, target: x.targetCasesYear ?? null, actual: x.actualCasesYTD ?? null })),
    growth,
    kpis: listKpis(ctx.vaultPath),
    places: loadPrefs(ctx.vaultPath),
    people: TOP_ROLES.includes(role) ? { accounts: listAccounts().map(a => ({ name: a.name, role: a.role, isActive: a.isActive, lastLoginAt: a.lastLoginAt || null })), brains: listBrains().length } : null,
  });
}
/** Guarda las ciudades del tablero (casa y sede) de este cerebro. */
async function _POST(req: NextRequest) {
  const ctx = currentBrain();
  if (!ctx) return NextResponse.json({ ok: false, error: 'Sin cerebro.' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b?.action !== 'places') return NextResponse.json({ ok: false, error: "action debe ser 'places'." }, { status: 400 });
  return NextResponse.json({ ok: true, places: savePrefs(ctx.vaultPath, { home: b.home, hq: b.hq }) });
}
export const GET = withBrain(_GET);
export const POST = withBrain(_POST);

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
export const dynamic = 'force-dynamic';

/** Todo lo que necesita el tablero inicial, del cerebro de quien entra. Solo lectura. */
async function _GET(_req: NextRequest) {
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
  const week = Array.from({ length: 7 }, (_, i) => { const dt = new Date(Date.parse(dateStr + 'T12:00:00Z') + i * 86400000).toISOString().slice(0, 10); return { date: dt, count: open.filter(x => (x.dueDate || '').slice(0, 10) === dt).length }; });
  const brands = nodes.filter(n => n.type === 'brand').map(b => { const name = b.title.replace(/^Brand:\s*/i, '').trim(); const key = name.toLowerCase(); return { name, slug: key.replace(/[^a-z0-9]/g, ''), count: nodes.filter(n => n.id !== b.id && (n.title.toLowerCase().includes(key) || n.links.some(l => l.toLowerCase().includes(key)))).length }; });
  const viewingOther = ctx.brainId !== own;
  const viewingName = ctx.brainId === COMPANY_BRAIN_ID ? 'la compañía' : ctx.brainId === PRIMARY_BRAIN_ID ? 'HB' : getAccount(ctx.brainId)?.name || ctx.brainId;
  return NextResponse.json({
    ok: true, today: dateStr,
    me: { name: me?.name || 'HB', role, isPrimary: own === PRIMARY_BRAIN_ID, canManage: canManageUsers(role), isTop: TOP_ROLES.includes(role) },
    brain: { id: ctx.brainId, viewingOther, viewingName, readOnly: !!ctx.readOnly, isEmpty: nodes.length <= 1 && open.length === 0 },
    counts: { overdue: open.filter(x => x.isOverdue).length, today: open.filter(x => x.isToday && !x.isOverdue).length, open: open.length, completed: t.tasks.length - open.length },
    tasksToday: open.filter(x => x.isOverdue || x.isToday).sort(byDate).slice(0, 6).map(lite),
    agenda: open.filter(x => x.dueDate && !x.isOverdue).sort(byDate).slice(0, 6).map(lite),
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

import { NextRequest, NextResponse } from 'next/server';
import { withBrain, listBrains, companyBrainExists, COMPANY_BRAIN_ID, PRIMARY_BRAIN_ID } from '@/lib/brains';
import { currentBrain } from '@/lib/brainContext';
import { getUnifiedBrainTasks, loadBrainGraph, getPanamaDate } from '@/lib/smjBrainService';
import { applyDecisions, loadDecisions, loadLatestReport } from '@/lib/dotsSleep';
import { loadAutonomy, recentActivity } from '@/lib/autonomy';
import { recentAppliedAll } from '@/lib/sleepApply';
import { querySharedNodes } from '@/lib/sharing';
import { getAccount, listAccounts, TOP_ROLES, canManageUsers } from '@/lib/localAccounts';
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
    people: TOP_ROLES.includes(role) ? { accounts: listAccounts().map(a => ({ name: a.name, role: a.role, isActive: a.isActive, lastLoginAt: a.lastLoginAt || null })), brains: listBrains().length } : null,
  });
}
export const GET = withBrain(_GET);

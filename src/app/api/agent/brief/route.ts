import { NextRequest, NextResponse } from 'next/server';
import { withBrain } from '@/lib/brains';
import { currentBrain } from '@/lib/brainContext';
import { getUnifiedBrainTasks, loadBrainGraph, getPanamaDate, getVaultVersion } from '@/lib/smjBrainService';
import { readJournal, untrackedSince, parseSince } from '@/lib/journal';
import { addDays, listEvents, mergedAgenda } from '@/lib/agenda';
import { listKpis } from '@/lib/kpis';
import { applyDecisions, loadDecisions, loadLatestReport } from '@/lib/dotsSleep';
import { tr } from '@/lib/reqLang';
export const dynamic = 'force-dynamic';

/**
 * Paquete del brief de la mañana: todo lo que hace falta, leído en vivo del cerebro, con la hora de los datos.
 * GET ?since=AAAA-MM-DD|ISO (novedades desde; por defecto 24 h) &days=7 (agenda hacia delante).
 * Regla para quien lo usa: el brief se arma SOLO con esto; si algo no está aquí, no se afirma.
 */
async function _GET(req: NextRequest) {
  const ctx = currentBrain(); if (!ctx) return NextResponse.json({ ok: false, error: tr('Sin cerebro.', 'No brain.') }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const since = parseSince(sp.get('since'));
  const days = Math.min(30, Math.max(1, Number(sp.get('days')) || 7));
  const { dateStr, timeStr } = getPanamaDate();
  const t = getUnifiedBrainTasks();
  const open = t.tasks.filter(x => !x.isCompleted);
  const lite = (x: (typeof open)[number]) => ({ id: x.id, title: x.title, dueDate: x.dueDate || null, priority: x.priority, source: x.sourceNodeTitle || '', sourceNodeId: x.sourceNodeId, country: x.country });
  const byDate = (a: { dueDate?: string }, b: { dueDate?: string }) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
  const agenda = mergedAgenda(listEvents(ctx.vaultPath), t.tasks as any, dateStr, addDays(dateStr, days - 1)).filter(o => o.layer === 'reuniones' || o.layer === 'viajes')
    .map(o => ({ date: o.date, time: o.time || null, endTime: o.endTime || null, kind: o.kind, title: o.title, location: o.location || null, source: o.source }));
  const entries = readJournal(ctx.vaultPath, { since, limit: 200 });
  const g = loadBrainGraph(); const nodes = g.allNodes || g.nodes;
  const working = nodes.filter(n => n.memory_tier === 'working' && !['consolidated', 'archived'].includes(String(n.status)))
    .map(n => ({ id: n.id, title: n.title, status: n.status, capturedAt: n.frontmatter?.captured_at || null }));
  const report = loadLatestReport(ctx.vaultPath);
  const pending = report ? applyDecisions(report, loadDecisions(ctx.vaultPath), new Date()).proposals.filter((p: any) => !p.decision).length : 0;
  const untracked = untrackedSince(ctx.vaultPath, since, entries);
  return NextResponse.json({
    ok: true,
    dataAsOf: { iso: new Date().toISOString(), panama: `${dateStr} ${timeStr}`, vaultVersion: getVaultVersion() },
    rule: 'Arma el brief solo con estos datos. Si algo no aparece aquí, no lo afirmes. Cita la hora de los datos.',
    today: dateStr,
    tasks: {
      overdue: open.filter(x => x.isOverdue).sort(byDate).map(lite),
      today: open.filter(x => x.isToday && !x.isOverdue).map(lite),
      next48h: open.filter(x => x.isNext48h && !x.isToday && !x.isOverdue).sort(byDate).map(lite),
      undatedCount: open.filter(x => !x.dueDate).length,
    },
    followups: open.filter(x => x.id.startsWith('fu-') && x.dueDate && x.dueDate <= addDays(dateStr, days)).sort(byDate).map(lite),
    agenda,
    changes: { since, count: entries.length, items: entries.map(e => ({ at: e.at, by: e.actor, summary: e.summary, undone: !!e.undoneAt })) },
    untrackedChanges: untracked.length ? { count: untracked.length, files: untracked.slice(0, 20), note: tr('Archivos que cambiaron sin pasar por la app (Obsidian o sincronización): revísalos antes de afirmar algo sobre ellos.', 'Files that changed without going through the app (Obsidian or sync): check them before stating anything about them.') } : null,
    workingMemory: working,
    kpis: listKpis(ctx.vaultPath).map(k => ({ name: k.name, value: k.value, unit: k.unit, target: k.target, period: k.period, updatedAt: k.updatedAt })),
    distributors: t.distributors.map(d => ({ name: d.name, country: d.country, status: d.status, compliance: d.complianceRate ?? null, nextFollowupDate: d.nextFollowupDate || null, nextFollowupAction: d.nextFollowupAction || null, lastContactDate: d.lastContactDate || null })),
    pendingProposals: pending,
  });
}
export const GET = withBrain(_GET);

import { NextRequest, NextResponse } from 'next/server';
import { withBrain } from '@/lib/brains';
import { canWriteFully, currentBrain } from '@/lib/brainContext';
import { loadBrainGraph } from '@/lib/smjBrainService';
import { displayTitle } from '@/lib/brainLens';
import { AgendaError, addDays, dayLoads, deleteEvent, listEvents, mergedAgenda, upsertEvent } from '@/lib/agenda';
import { getUnifiedBrainTasks, getPanamaDate } from '@/lib/smjBrainService';
import { actorLabel } from '@/lib/actor';
import { tr } from '@/lib/reqLang';
export const dynamic = 'force-dynamic';

/**
 * Agenda fusionada del cerebro (reuniones, viajes, tareas y seguimientos).
 * GET ?from=AAAA-MM-DD&to=AAAA-MM-DD → ocurrencias y carga por día (por defecto, de hoy a 45 días).
 * POST {action:'set', kind:'reunion'|'viaje'|'evento', title, date, time?, endTime?, endDate?, location?, notes?,
 *       repeat?:'none'|'daily'|'weekly'|'monthly'|'yearly', weekdays?:[0..6], until?, id?, source?, externalId?} → crea o cambia.
 * POST {action:'delete', id, date?} → borra el evento; con date, cancela solo esa repetición.
 */
async function _GET(req: NextRequest) {
  const ctx = currentBrain(); if (!ctx) return NextResponse.json({ ok: false, error: tr('Sin cerebro.', 'No brain.') }, { status: 401 });
  const sp = new URL(req.url).searchParams; const today = getPanamaDate().dateStr;
  const ok = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = ok(sp.get('from')) || today; let to = ok(sp.get('to')) || addDays(from, 45);
  if (to < from) to = from; if (addDays(from, 400) < to) to = addDays(from, 400);
  const events = listEvents(ctx.vaultPath);
  const occ = mergedAgenda(events, getUnifiedBrainTasks().tasks as any, from, to);
  // Con quién es cada evento: nombre, tipo y cargo de las fichas enlazadas.
  const wanted = new Set(occ.flatMap(o => o.nodeIds || []));
  if (wanted.size) {
    const byId = new Map((loadBrainGraph().allNodes || []).filter(n => wanted.has(n.id)).map(n => [n.id, { id: n.id, title: displayTitle(n.title), type: n.type, role: n.frontmatter?.job_title || n.frontmatter?.organization || undefined }]));
    for (const o of occ) if (o.nodeIds) o.links = o.nodeIds.map(id => byId.get(id)).filter(Boolean) as typeof o.links;
  }
  return NextResponse.json({ ok: true, today, from, to, occurrences: occ, loads: dayLoads(occ, from, to), events: sp.get('events') === '1' ? events : undefined, readOnly: !!ctx.readOnly });
}
async function _POST(req: NextRequest) {
  const ctx = currentBrain(); if (!ctx) return NextResponse.json({ ok: false, error: tr('Sin cerebro.', 'No brain.') }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    if (b?.action === 'set') return NextResponse.json({ ok: true, event: upsertEvent(ctx.vaultPath, b, actorLabel()) }, { status: 201 });
    if (b?.action === 'delete') {
      if (!canWriteFully()) return NextResponse.json({ ok: false, error: tr('Esta llave no puede borrar eventos.', 'This key cannot delete events.') }, { status: 403 });
      return NextResponse.json({ ok: deleteEvent(ctx.vaultPath, String(b.id || ''), typeof b.date === 'string' ? b.date : undefined) });
    }
    return NextResponse.json({ ok: false, error: tr("action debe ser 'set' o 'delete'.", 'action must be \'set\' or \'delete\'.') }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof AgendaError ? e.message : tr('No se pudo guardar el evento.', 'Could not save the event.') }, { status: e instanceof AgendaError ? e.status : 500 });
  }
}
export const GET = withBrain(_GET);
export const POST = withBrain(_POST);

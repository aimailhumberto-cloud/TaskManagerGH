import { NextRequest, NextResponse } from 'next/server';
import { withBrain } from '@/lib/brains';
import { canWriteFully, currentBrain } from '@/lib/brainContext';
import { readJournal, undoChange, untrackedSince, parseSince } from '@/lib/journal';
import { getAccount } from '@/lib/localAccounts';
import { tr } from '@/lib/reqLang';
export const dynamic = 'force-dynamic';

/**
 * Diario de cambios del cerebro.
 * GET ?since=AAAA-MM-DD|ISO&limit= → qué cambió (quién, cuándo, por dónde, qué fichas y campos) + archivos que cambiaron sin pasar por la app.
 * POST {action:'undo', changeId} → devuelve esos archivos a como estaban, si nadie los tocó después.
 */
async function _GET(req: NextRequest) {
  const ctx = currentBrain(); if (!ctx) return NextResponse.json({ ok: false, error: tr('Sin cerebro.', 'No brain.') }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const since = parseSince(sp.get('since'));
  const limit = Math.min(500, Math.max(1, Number(sp.get('limit')) || 100));
  const entries = readJournal(ctx.vaultPath, { since, limit });
  return NextResponse.json({ ok: true, since, until: new Date().toISOString(), count: entries.length, entries, untracked: untrackedSince(ctx.vaultPath, since, entries) });
}
async function _POST(req: NextRequest) {
  const ctx = currentBrain(); if (!ctx) return NextResponse.json({ ok: false, error: tr('Sin cerebro.', 'No brain.') }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b?.action !== 'undo') return NextResponse.json({ ok: false, error: tr("action debe ser 'undo'.", 'action must be \'undo\'.') }, { status: 400 });
  if (!canWriteFully()) return NextResponse.json({ ok: false, error: tr('Esta llave no puede deshacer cambios.', 'This key cannot undo changes.') }, { status: 403 });
  const who = ctx.actor?.startsWith('local-') ? getAccount(ctx.actor)?.name || ctx.actor : ctx.actor || 'agente';
  const r = await undoChange(ctx.vaultPath, String(b.changeId || ''), { actor: who, via: ctx.via });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error, changedSince: r.changedSince }, { status: r.status });
  return NextResponse.json({ ok: true, undone: r.entry.id, message: tr(`Se deshizo: ${r.entry.summary}`, `Undone: ${r.entry.summary}`), undoChangeId: r.undo?.id || null });
}
export const GET = withBrain(_GET);
export const POST = withBrain(_POST);

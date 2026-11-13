import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/accountGuard';
import { getAccount } from '@/lib/localAccounts';
import { brainIdForAccount, ensureBrain, logBrainAccess, PRIMARY_BRAIN_ID } from '@/lib/brains';
import { runInBrain } from '@/lib/brainContext';
import { createBrainTask, getPrimaryVaultPath } from '@/lib/smjBrainService';
import { ensureDailySnapshot } from '@/lib/vaultBackup';
import { tr, withReqLang } from '@/lib/reqLang';
export const dynamic = 'force-dynamic';

/**
 * Un Owner, Admin o Gerente asigna una tarea a otra persona. La tarea se crea en el cerebro del destinatario.
 * Quien asigna NO lee ese cerebro: solo deja la tarea. Las menciones a otros cerebros son etiquetas con el nombre.
 */
async function _POST(request: NextRequest) {
  const g = await requireManager(request); if (!g.ok) return g.res;
  const b = await request.json().catch(() => ({}));
  const title = typeof b?.title === 'string' ? b.title.trim().slice(0, 200) : '';
  if (!title) return NextResponse.json({ error: tr('La tarea necesita un título.', 'The task needs a title.') }, { status: 400 });
  const target = typeof b?.toAccountId === 'string' ? getAccount(b.toAccountId) : null;
  if (!target?.isActive) return NextResponse.json({ error: tr('Esa persona no existe o está desactivada.', 'That person does not exist or is deactivated.') }, { status: 404 });
  const dueDate = typeof b?.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate) ? b.dueDate : undefined;
  const priority = ['High', 'Medium', 'Low'].includes(b?.priority) ? b.priority : 'Medium';
  const actor = getAccount(g.actor.id);
  const actorName = actor?.name || g.actor.email;
  const mentions: string[] = (Array.isArray(b?.mentions) ? b.mentions : []).map((id: unknown) => (typeof id === 'string' ? getAccount(id) : null)).filter((a: any) => a?.isActive).map((a: any) => a.name).slice(0, 10);
  const note = typeof b?.description === 'string' ? b.description.slice(0, 2000) : '';
  const description = [`Asignada por ${actorName}.`, mentions.length ? `Menciona los cerebros de: ${mentions.join(', ')}.` : '', note].filter(Boolean).join('\n\n');

  const brainId = brainIdForAccount(target);
  const vaultPath = brainId === PRIMARY_BRAIN_ID ? getPrimaryVaultPath() : ensureBrain(brainId, target.name);
  if (!vaultPath) return NextResponse.json({ error: tr('Cerebro no disponible.', 'Brain not available.') }, { status: 500 });
  logBrainAccess({ actor: g.actor.id, role: g.actor.role, brainId, path: '/api/admin/assign-task', method: 'ASSIGN' });
  const result = runInBrain({ brainId, vaultPath, primary: brainId === PRIMARY_BRAIN_ID, actor: g.actor.id, via: 'asignacion' }, () => {
    ensureDailySnapshot(vaultPath);
    return createBrainTask({ title, dueDate, priority, description, assignedBy: actorName, mentions });
  });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json({ ok: true, to: target.name, message: tr(`Tarea asignada a ${target.name}.`, `Task assigned to ${target.name}.`) }, { status: 201 });
}

export const POST = withReqLang(_POST);

import { NextRequest } from 'next/server';
import { decryptSession } from '@/lib/session';
import { getAccount, isLocalId } from '@/lib/localAccounts';

/** Quién usa los store checks. Solo personas con sesión (no agentes). Owner, Admin y Gerente pueden editar las visitas de todos. */
export interface Who { id: string; name: string; canWrite: boolean; manager: boolean }
export function who(request: NextRequest): Who | null {
  const s = decryptSession(request.cookies.get('hermes_session')?.value || '');
  if (!s) return null;
  if (isLocalId(s.userId)) {
    const acc = getAccount(s.userId);
    if (!acc?.isActive) return null;
    return { id: acc.id, name: acc.name, canWrite: acc.role !== 'Solo lectura', manager: ['Owner', 'Admin', 'Gerente'].includes(acc.role) };
  }
  return { id: s.userId, name: s.email || s.userId, canWrite: !/lectura|read/i.test(s.role || ''), manager: /owner|admin|gerente/i.test(s.role || '') };
}
export const canEdit = (w: Who, by: { id: string }) => w.canWrite && (w.manager || by.id === w.id);

import { NextRequest, NextResponse } from 'next/server';
import { requireManager, accountErrorResponse } from '@/lib/accountGuard';
import { updateAccount } from '@/lib/localAccounts';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireManager(request); if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const b = await request.json();
    const acc = updateAccount(id, { isActive: typeof b?.isActive === 'boolean' ? b.isActive : undefined, role: b?.role, name: b?.name, newPassword: b?.newPassword }, { id: g.actor.id, role: g.actor.role });
    return NextResponse.json({ account: acc });
  } catch (e) { return accountErrorResponse(e); }
}

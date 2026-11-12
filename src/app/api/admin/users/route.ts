import { NextRequest, NextResponse } from 'next/server';
import { requireManager, accountErrorResponse } from '@/lib/accountGuard';
import { listAccounts, createAccount, TOP_ROLES, AccountError, ROLES } from '@/lib/localAccounts';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const g = await requireManager(request); if (!g.ok) return g.res;
  return NextResponse.json({ accounts: listAccounts(), roles: ROLES, you: g.actor });
}
export async function POST(request: NextRequest) {
  const g = await requireManager(request); if (!g.ok) return g.res;
  try {
    const b = await request.json();
    if (!TOP_ROLES.includes(g.actor.role) && TOP_ROLES.includes(b?.role)) throw new AccountError('Solo un Admin u Owner puede crear cuentas Admin u Owner.', 403);
    const acc = createAccount({ email: b?.email, name: b?.name, role: b?.role, password: b?.password, createdBy: g.actor.id, mustChange: true });
    return NextResponse.json({ account: acc }, { status: 201 });
  } catch (e) { return accountErrorResponse(e); }
}

import { NextRequest, NextResponse } from 'next/server';
import { createAccount, hasManager, setupTokenValid, AccountError } from '@/lib/localAccounts';
import { sameRequestOrigin } from '@/lib/auth';
export const dynamic = 'force-dynamic';
const tries = { count: 0, until: 0 };

/** Crea el primer administrador. Solo si SETUP_TOKEN está en Render y aún no hay ninguno. */
export async function GET() {
  return NextResponse.json({ available: !!process.env.SETUP_TOKEN && (process.env.SETUP_TOKEN || '').length >= 16 && !hasManager() });
}
export async function POST(request: NextRequest) {
  if (!sameRequestOrigin(request)) return NextResponse.json({ error: 'Origen de la solicitud no permitido.' }, { status: 403 });
  const now = Date.now();
  if (tries.until > now && tries.count >= 5) return NextResponse.json({ error: 'Demasiados intentos. Reintenta en unos minutos.' }, { status: 429 });
  tries.count = tries.until > now ? tries.count + 1 : 1; tries.until = tries.until > now ? tries.until : now + 600000;
  try {
    if (hasManager()) return NextResponse.json({ error: 'La configuración inicial ya se hizo.' }, { status: 409 });
    const b = await request.json();
    if (!setupTokenValid(b?.token)) return NextResponse.json({ error: 'Código de configuración incorrecto o no configurado en el servidor.' }, { status: 403 });
    const acc = createAccount({ email: b.email, name: b.name, role: 'Owner', password: b.password, createdBy: 'setup' });
    tries.count = 0;
    return NextResponse.json({ account: acc }, { status: 201 });
  } catch (e) {
    if (e instanceof AccountError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No se pudo completar la configuración.' }, { status: 500 });
  }
}

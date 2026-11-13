import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbService from '@/services/dbService';
import { encryptSession } from '@/lib/session';
import { authenticateLocal } from '@/lib/localAccounts';
import { brainIdForAccount } from '@/lib/brains';
import { tr, withReqLang } from '@/lib/reqLang';
const attempts = new Map<string, { count: number; until: number }>();

async function _POST(request: NextRequest) {
  try {
    // Límite por cuenta: 8 intentos fallidos en 15 minutos bloquean ESE correo, no a los demás.
    // Además un tope global alto, por si alguien prueba muchos correos distintos.
    const now = Date.now();
    const hit = (k: string, max: number, windowMs: number) => {
      const bkt = attempts.get(k);
      if (bkt && bkt.until > now && bkt.count >= max) return false;
      attempts.set(k, bkt && bkt.until > now ? { ...bkt, count: bkt.count + 1 } : { count: 1, until: now + windowMs });
      return true;
    };
    if (attempts.size > 5000) for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
    if (!hit('global', 200, 300000)) return NextResponse.json({ error: tr('Demasiados intentos. Reintenta más tarde.', 'Too many attempts. Try again later.') }, { status: 429 });
    const { email, password } = await request.json();

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || email.length > 320 || password.length > 1024) {
      return NextResponse.json(
        { error: tr('Escribe el correo y la contraseña.', 'Email and password are required') },
        { status: 400 }
      );
    }
    const key = `cuenta:${email.trim().toLowerCase()}`;
    if (!hit(key, 8, 900000)) return NextResponse.json({ error: tr('Demasiados intentos con esta cuenta. Reintenta en 15 minutos o pide que te restablezcan la clave.', 'Too many attempts with this account. Try again in 15 minutes or ask for a password reset.') }, { status: 429 });

    // 0. Cuentas propias de la app (creadas desde «Usuarios»)
    const local = authenticateLocal(email, password);
    if (local) {
      const token = encryptSession({ userId: local.id, personId: local.id, email: local.email, role: local.role, brain: brainIdForAccount(local), createdAt: new Date().toISOString() });
      (await cookies()).set('hermes_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'lax' });
      attempts.delete(key);
      return NextResponse.json({ success: true, user: { id: local.id, email: local.email, name: local.name, role: local.role, mustChange: local.mustChange } });
    }

    // 1. Fetch user by email
    const user = await dbService.authenticateUser(email,password);
    if (!user) {
      return NextResponse.json(
        { error: tr('Correo o contraseña incorrectos.', 'Invalid email or password') },
        { status: 401 }
      );
    }

    // 2. Validate user status
    if (!user.isActive) {
      return NextResponse.json(
        { error: tr('Esta cuenta está inactiva. Habla con administración.', 'This user account is inactive. Please contact administration.') },
        { status: 403 }
      );
    }

    // 3. Verify password hash
    // Credentials are verified against their own source, never copied to the workspace.

    // 4. Fetch person details for session metadata
    const people = await dbService.getPeople();
    const person = people.find(p => p.id === user.personId);
    if (!person) {
      return NextResponse.json(
        { error: 'User profile association not found' },
        { status: 500 }
      );
    }

    // 5. Encrypt session
    const token = encryptSession({
      userId: user.id,
      personId: person.id,
      email: user.email,
      role: person.role,
      companyId: person.companyId,
      createdAt: new Date().toISOString(),
    });

    // 6. Set HTTP-Only Cookie
    (await cookies()).set('hermes_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      sameSite: 'lax',
    });

    attempts.delete(key);
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: person.name,
        role: person.role,
        avatar: person.avatar,
        companyId: person.companyId
      }
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: tr('No se pudo iniciar sesión.', 'Could not sign in.') },
      { status: 500 }
    );
  }
}

export const POST = withReqLang(_POST);

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbService from '@/services/dbService';
import { hashPassword } from '@/services/dbService';
import { encryptSession } from '@/lib/session';
const attempts = new Map<string, { count: number; until: number }>();

export async function POST(request: NextRequest) {
  try {
    // Next 15 removed request.ip. Keep the shared self-hosted bucket;
    // unverified forwarded headers must not let a client evade the limit.
    const key = 'local';
    const now = Date.now();
    const bucket = attempts.get(key);
    if (bucket && bucket.until > now && bucket.count >= 10) return NextResponse.json({ error: 'Demasiados intentos. Reintenta más tarde.' }, { status: 429 });
    attempts.set(key, bucket && bucket.until > now ? { ...bucket, count: bucket.count + 1 } : { count: 1, until: now + 300000 });
    const { email, password } = await request.json();

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || email.length > 320 || password.length > 1024) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // 1. Fetch user by email
    const user = await dbService.getUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 2. Validate user status
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'This user account is inactive. Please contact administration.' },
        { status: 403 }
      );
    }

    // 3. Verify password hash
    const inputHash = hashPassword(password, user.salt);
    if (inputHash !== user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

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
      { error: 'No se pudo iniciar sesión.' },
      { status: 500 }
    );
  }
}

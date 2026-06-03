import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbService from '@/services/dbService';
import { hashPassword } from '@/services/dbService';
import { encryptSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
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
    cookies().set('hermes_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
      sameSite: 'lax',
    });

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
    console.error('Error logging in:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbService from '@/services/dbService';
import { decryptSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('hermes_session');

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json(
        { error: 'Not authenticated', authenticated: false },
        { status: 401 }
      );
    }

    // 1. Decrypt session token
    const sessionData = decryptSession(sessionCookie.value);
    if (!sessionData) {
      return NextResponse.json(
        { error: 'Invalid session token', authenticated: false },
        { status: 401 }
      );
    }

    // 2. Fetch fresh user & person details from local DB
    const user = await dbService.getUserById(sessionData.userId);
    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'User is inactive or deleted', authenticated: false },
        { status: 401 }
      );
    }

    const people = await dbService.getPeople();
    const person = people.find(p => p.id === user.personId);
    if (!person) {
      return NextResponse.json(
        { error: 'Linked user profile not found', authenticated: false },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: person.name,
        role: person.role,
        avatar: person.avatar,
        companyId: person.companyId,
        personId: person.id
      }
    });

  } catch (err: any) {
    console.error('Error fetching current session:', err);
    return NextResponse.json(
      { error: 'Internal server error', authenticated: false },
      { status: 500 }
    );
  }
}

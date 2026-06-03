import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const users = await dbService.getUsers();
    // Return credentials details but scrub passwordHash and salt for security!
    const sanitizedUsers = users.map(u => ({
      id: u.id,
      personId: u.personId,
      email: u.email,
      isActive: u.isActive
    }));
    return NextResponse.json(sanitizedUsers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    
    if (!body.personId || !body.email || !body.passwordPlain) {
      return NextResponse.json(
        { error: 'personId, email, and passwordPlain are required' },
        { status: 400 }
      );
    }

    const newUser = await dbService.createUser({
      personId: body.personId,
      email: body.email.trim(),
      passwordPlain: body.passwordPlain,
      isActive: body.isActive !== undefined ? body.isActive : true
    });

    // Return sanitized result
    return NextResponse.json({
      id: newUser.id,
      personId: newUser.personId,
      email: newUser.email,
      isActive: newUser.isActive
    }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

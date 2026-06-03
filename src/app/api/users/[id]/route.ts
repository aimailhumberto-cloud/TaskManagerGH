import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = params;

  try {
    const body = await request.json();
    
    const updatedUser = await dbService.updateUser(id, {
      personId: body.personId,
      email: body.email ? body.email.trim() : undefined,
      passwordPlain: body.passwordPlain || undefined,
      isActive: body.isActive !== undefined ? body.isActive : undefined
    });

    return NextResponse.json({
      id: updatedUser.id,
      personId: updatedUser.personId,
      email: updatedUser.email,
      isActive: updatedUser.isActive
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = params;

  try {
    const success = await dbService.deleteUser(id);
    if (!success) {
      return NextResponse.json({ error: 'User credential record not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'User credentials deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

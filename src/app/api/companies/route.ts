import { workspaceDTO } from '@/lib/publicWorkspace';
import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const companies = workspaceDTO(await dbService.readData(),auth.session!).companies;
    return NextResponse.json(companies);
  } catch (error: any) {
    return NextResponse.json({ error: 'Datos no disponibles; reintenta sin modificar la base.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const newCompany = await dbService.createCompany({
      name: body.name.trim()
    });

    return NextResponse.json(newCompany, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Datos no disponibles; reintenta sin modificar la base.' }, { status: 503 });
  }
}

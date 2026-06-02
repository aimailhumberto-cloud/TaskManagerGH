import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = validateApiKey(req);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const smtpConfig = await dbService.getSMTPConfig();
    return NextResponse.json({ smtpConfig });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = validateApiKey(req);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { host, port } = body;

    if (!host || !port || isNaN(Number(port))) {
      return NextResponse.json({ error: 'SMTP Host and Port are mandatory' }, { status: 400 });
    }

    const current = await dbService.getSMTPConfig();
    const updated = {
      ...current,
      host,
      port: Number(port),
    };

    await dbService.updateSMTPConfig(updated);
    return NextResponse.json({ success: true, smtpConfig: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { readWhatsAppStatus } from '@/lib/whatsappStatus';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: { 'Cache-Control': 'no-store' } });
  if (auth.session?.role !== 'Admin') return NextResponse.json({ error: 'Panel reservado al administrador.' }, { status: 403 });
  return NextResponse.json(await readWhatsAppStatus(process.env.TASKMANAGER_LOCAL_ONLY === '1' ? process.env.TASKMANAGER_WHATSAPP_DIRECTORY : undefined), { headers: { 'Cache-Control': 'no-store' } });
}

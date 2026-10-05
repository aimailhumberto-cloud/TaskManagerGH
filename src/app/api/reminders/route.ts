import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { dbService } from '@/services/dbService';
import { reminderCommand } from '@/services/planningService';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try { const data = await dbService.readData(); return NextResponse.json({ reminders: (data.reminders || []).filter(r => r.ownerId === auth.session!.personId) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'No se pudieron leer los avisos. Reintenta; se conservan los datos.' }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try { return NextResponse.json({ reminders: await reminderCommand(auth.session!, await request.json()) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar.' }, { status: 400 }); }
}

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { dbService } from '@/services/dbService';
import { belongsTo } from '@/lib/personalTasks';
import { taskCalendar } from '@/lib/planning';
import { calendarConnection, synchronizeCalendar } from '@/services/googleCalendarService';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const data = await dbService.readData();
    if (request.nextUrl.searchParams.get('format') === 'ics') return new NextResponse(taskCalendar(data.tasks.filter(t => belongsTo(t, auth.session!.personId))), { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="taskmanager-plan.ics"', 'Cache-Control': 'no-store' } });
    if (auth.session!.personId !== 'local-humberto') return NextResponse.json({ error: 'Calendario reservado al espacio de Humberto.' }, { status: 403 });
    const connection = await calendarConnection();
    return NextResponse.json({ mode: connection.appAuthorized ? 'oauth-readonly' : 'snapshot-only', ...connection, snapshot: data.calendarSnapshot || null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Calendario no disponible; se conserva la lectura anterior.' }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try { return NextResponse.json({ snapshot: await synchronizeCalendar(auth.session!.personId), appAuthorized: true, mode: 'oauth-readonly' }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'No se completó la lectura; se conserva la agenda anterior.' }, { status: 503 }); }
}

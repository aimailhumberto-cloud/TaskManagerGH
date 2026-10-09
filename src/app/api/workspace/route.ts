import { responsiblePeople } from '@/lib/workspaceLayers';
import { dailyWork } from '@/lib/stepWork';
import { belongsTo, validDate, localDay } from '@/lib/personalTasks';
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { dbService } from '@/services/dbService';
import { applyWorkspaceCommand } from '@/services/workspaceService';
import { WorkspaceError } from '@/lib/projects';
import { workspaceDTO, publicValue } from '@/lib/publicWorkspace';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const data = await dbService.readData();
    const day = request.nextUrl.searchParams.get('day') || localDay(new Date(), 'America/Panama');
    if (!validDate(day)) return NextResponse.json({ error: 'Día de trabajo inválido.' }, { status: 400 });
    const view=workspaceDTO(data,auth.session!);
    const dayWork = dailyWork(view.tasks.filter(t => (belongsTo(t, auth.session!.personId) || view.managedLegacyTaskIds.includes(t.id)) && !view.projects.some(p => p.id === t.projectId && p.state === 'Cancelled')), day);
    return NextResponse.json({ day, dayWork, observedAt: new Date().toISOString(), localOnly: process.env.TASKMANAGER_LOCAL_ONLY === '1', ...view, people: responsiblePeople(view) },{headers:{'Cache-Control':'private, no-store'}});
  } catch { return NextResponse.json({ error: 'Datos no disponibles; se conserva la base existente.' }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await request.json();
    const result = await applyWorkspaceCommand(auth.session!, body);
    return NextResponse.json(publicValue(result),{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar.' }, { status: error instanceof WorkspaceError ? error.status : 400 });
  }
}

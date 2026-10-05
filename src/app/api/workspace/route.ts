import { responsiblePeople } from '@/lib/workspaceLayers';
import { dailyWork } from '@/lib/stepWork';
import { belongsTo, validDate, localDay } from '@/lib/personalTasks';
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { dbService } from '@/services/dbService';
import { applyWorkspaceCommand } from '@/services/workspaceService';
import { WorkspaceError } from '@/lib/projects';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const data = await dbService.readData();
    const day = request.nextUrl.searchParams.get('day') || localDay(new Date(), 'America/Panama');
    if (!validDate(day)) return NextResponse.json({ error: 'Día de trabajo inválido.' }, { status: 400 });
    const dayWork = dailyWork(data.tasks.filter(t => belongsTo(t, auth.session!.personId) && !data.projects?.some(p => p.id === t.projectId && p.state === 'Cancelled')), day);
    return NextResponse.json({ day, dayWork, observedAt: new Date().toISOString(), localOnly: process.env.TASKMANAGER_LOCAL_ONLY === '1', tasks: data.tasks, people: responsiblePeople(data), companies: data.companies, projects: data.projects || [], automations: (data.automations || []).filter(a => a.ownerId === auth.session!.personId), heroPreference: data.heroPreferences?.find(p => p.ownerId === auth.session!.personId) || null, decisions: (data.decisions || []).filter(d => d.ownerId === auth.session!.personId), dayPlans: (data.dayPlans || []).filter(p => p.ownerId === auth.session!.personId) });
  } catch { return NextResponse.json({ error: 'Datos no disponibles; se conserva la base existente.' }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await request.json();
    const result = await applyWorkspaceCommand(auth.session!, body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar.' }, { status: error instanceof WorkspaceError ? error.status : 400 });
  }
}

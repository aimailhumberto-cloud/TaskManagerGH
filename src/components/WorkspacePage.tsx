import { hasAdministrationCapability } from '@/lib/capabilities';
import { responsiblePeople } from '@/lib/workspaceLayers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { decryptSession } from '@/lib/session';
import { dbService } from '@/services/dbService';
import WorkspaceHub, { Entry } from './WorkspaceHub';
import PublicHbWorkspace from './PublicHbWorkspace';
import {readPublicHbWorkspace} from '@/services/publicHbWorkspace';
import { workspaceDTO } from '@/lib/publicWorkspace';
export default async function WorkspacePage({ entry }: { entry: Entry }) {
  const session = decryptSession((await cookies()).get('hermes_session')?.value || '');
  if (!session) {
    if (!['home','companies','agenda','search','supervision'].includes(entry)) redirect('/login');
    try { return <PublicHbWorkspace entry={entry} initial={await readPublicHbWorkspace()} />; }
    catch { return <section className="tm-workspace"><header className="tm-hero"><h1>TaskManager HB</h1><p>Consulta pública · Solo lectura</p></header><section className="tm-pane tm-pane-dark"><h2>Datos no disponibles</h2><p role="alert">El espacio HB requiere verificación del almacenamiento existente. No se inicializó una base vacía ni se importaron datos.</p><Link href="/">Reintentar consulta</Link></section></section>; }
  }
  let data;
  try {
    data = await dbService.readData();
  } catch {
    return <section className="p-8"><h1 className="text-2xl font-bold">Datos no disponibles</h1><p role="alert">No se modificó ni sustituyó la base. Revisa el almacenamiento y vuelve a cargar.</p><Link href="/">Reintentar</Link></section>;
  }
  const user = data.users?.find(u => u.id === session.userId && u.personId === session.personId && u.isActive);
  if (!user || !data.people.some(p=>p.id===session.personId)) redirect('/login?expired=1');
  const view=workspaceDTO(data,session);
  return <WorkspaceHub entry={entry} actorId={session.personId} canEdit={hasAdministrationCapability(data.people.find(p => p.id === session.personId)?.role)} initial={{...view,people:responsiblePeople(view)}} />;
}

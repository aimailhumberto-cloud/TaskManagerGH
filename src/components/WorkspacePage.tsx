import { hasAdministrationCapability } from '@/lib/capabilities';
import { responsiblePeople } from '@/lib/workspaceLayers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { decryptSession } from '@/lib/session';
import { dbService } from '@/services/dbService';
import WorkspaceHub, { Entry } from './WorkspaceHub';
import { workspaceDTO } from '@/lib/publicWorkspace';
export default async function WorkspacePage({ entry }: { entry: Entry }) {
  const session = decryptSession((await cookies()).get('hermes_session')?.value || '');
  if (!session) redirect('/login');
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

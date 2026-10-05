'use client';
import type { Task, Company } from '@/services/mockData';
import type { Project } from '@/lib/projects';
import { projectProgress } from '@/lib/projects';
import WorkspaceIcon from './WorkspaceIcon';
export default function CompanyDashboards({ tasks, companies, projects, selected, choose }: { tasks: Task[]; companies: Company[]; projects: Project[]; selected: string; choose: (id: string) => void }) {
  return <section className="tm-business-dashboards" aria-label="Resumen de empresas">{companies.filter(c => !selected || c.id === selected).map(c => {
    const work = tasks.filter(t => t.companyId === c.id && !t.cancelledAt && t.validationStatus !== 'NeedsConfirmation');
    const done = work.filter(t => t.status === 'Completed').length; const waiting = work.filter(t => t.status !== 'Completed' && (t.status === 'Blocked' || t.waitingOn)).length;
    const results = projects.filter(p => p.companyId === c.id && p.state !== 'Cancelled').map(projectProgress);
    const accepted = results.reduce((n, p) => n + p.accepted, 0); const total = results.reduce((n, p) => n + p.total, 0);
    const milestones = projects.filter(p => p.companyId === c.id && p.state !== 'Cancelled').flatMap(p => p.milestones.filter(m => !m.deliverableIds.length || m.deliverableIds.some(id => p.deliverables.find(d => d.id === id)?.state !== 'Accepted')).map(m => ({ ...m, project: p.title, date: p.deliverables.filter(d => m.deliverableIds.includes(d.id)).map(d => d.dueDate).filter(Boolean).sort()[0] }))).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    return <article className="tm-pane tm-pane-dark" key={c.id}><button className="tm-heading-icon" onClick={() => choose(c.id)}><WorkspaceIcon name="company" /><h2>{c.name}</h2></button><div className="tm-business-metrics"><span><b>{work.length - done}</b>Pendientes</span><span><b>{done}</b>Completadas</span><span><b>{waiting}</b>Esperas / bloqueos</span></div><progress aria-label={`Tareas completadas de ${c.name}`} value={done} max={work.length || 1} /><p className="tm-small">{done}/{work.length} tareas completas{total > 0 && ` · ${accepted}/${total} entregables aceptados`}</p><p className="tm-small">{milestones[0] ? `Próximo hito: ${milestones[0].title} · ${milestones[0].date || 'fecha por definir'} · ${milestones[0].project}` : 'Sin próximos hitos registrados.'}</p><small>Los pasos permanecen dentro de su proyecto; no duplican el total de tareas.</small></article>;
  })}</section>;
}

export type ProjectState = 'Active' | 'Paused' | 'Completed' | 'Cancelled';
export type DeliverableState = 'Draft' | 'Submitted' | 'Accepted' | 'ChangesRequested' | 'Cancelled';
export interface Stage { id: string; title: string }
export interface Evidence { id: string; title: string; note: string; url: string; createdAt: string; createdBy: string }
export interface Deliverable { id: string; title: string; stageId: string; criteria: string; state: DeliverableState; evidenceIds: string[]; dependencyIds: string[]; acceptedBy?: string; acceptedAt?: string; dueDate?: string }
export interface Milestone { id: string; title: string; deliverableIds: string[] }
export interface ProjectSnapshot { id: string; companyId: string; title: string; objective: string; scope: string; ownerId: string; acceptancePersonId: string; state: ProjectState; revision: number; stages: Stage[]; deliverables: Deliverable[]; milestones: Milestone[]; evidence: Evidence[] }
export interface ProjectRevision { revision: number; at: string; actorId: string; action: string; reason: string; snapshot: ProjectSnapshot }
export interface Project extends ProjectSnapshot { history: ProjectRevision[] }
export interface AppliedOperation { requestId: string; fingerprint: string; actorId: string; result: unknown }
export class WorkspaceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function projectProgress(project: Project) {
  const planned = project.deliverables.filter(d => d.state !== 'Cancelled');
  const accepted = planned.filter(d => d.state === 'Accepted').length;
  return { accepted, total: planned.length, percent: planned.length ? Math.round(accepted / planned.length * 100) : 0 };
}
export function milestoneReady(project: Project, milestone: Milestone): boolean {
  return milestone.deliverableIds.length > 0 && milestone.deliverableIds.every(id => project.deliverables.some(d => d.id === id && d.state === 'Accepted'));
}
export function assertNoCycles(graph: { id: string; dependencyIds?: string[] }[]) {
  const visiting = new Set<string>(); const visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new WorkspaceError('Las dependencias forman un ciclo.');
    if (visited.has(id)) return;
    const node = graph.find(item => item.id === id);
    if (!node) throw new WorkspaceError('Una dependencia no existe.');
    visiting.add(id);
    for (const dependency of node.dependencyIds || []) visit(dependency);
    visiting.delete(id); visited.add(id);
  }
  graph.forEach(node => visit(node.id));
}
export function nextOccurrence(date: string, pattern: string): string {
  const source = new Date(date + 'T12:00:00Z');
  if (pattern === 'Monthly') {
    const day = source.getUTCDate(); source.setUTCDate(1); source.setUTCMonth(source.getUTCMonth() + 1);
    const last = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, 0)).getUTCDate();
    source.setUTCDate(Math.min(day, last));
  } else source.setUTCDate(source.getUTCDate() + (pattern === 'Weekly' ? 7 : 1));
  return source.toISOString().slice(0, 10);
}

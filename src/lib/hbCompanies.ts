import type { Company, Task } from '@/services/mockData';
import type { Project } from '@/lib/projects';

export interface HbCompanyMeta {
  id: string;
  name: string;
  icon: string;
  subtitle: string;
  color: string;
  subBrands: string[];
}

export const HB_CANONICAL_COMPANIES: HbCompanyMeta[] = [
  {
    id: 'business-surf-shack',
    name: 'Surf Shack',
    icon: '🏄',
    subtitle: 'Operación Playa Caracol, Legal & Estructura',
    color: '#5fd4c4',
    subBrands: ['Playa Caracol', 'Legal y Pagos', 'Operación'],
  },
  {
    id: 'business-academia-surf',
    name: 'Academia Nacional de Surf',
    icon: '🌊',
    subtitle: 'Programas, Instructores & Surf 101',
    color: '#4ea8de',
    subBrands: ['Surf 101', 'Instructores', 'Programas'],
  },
  {
    id: 'business-casa-mahana',
    name: 'Casa Mahana',
    icon: '🏡',
    subtitle: 'Hospitalidad, Reservas & Propiedad',
    color: '#e9bc6e',
    subBrands: ['Reservas', 'Mantenimiento', 'Huéspedes'],
  },
  {
    id: 'business-soluciones-express',
    name: 'Soluciones Express',
    icon: '⚡',
    subtitle: 'Servicios Rápidos, Logística & Operaciones',
    color: '#f3b35c',
    subBrands: ['Operaciones', 'Logística', 'Clientes'],
  },
  {
    id: 'business-mahana-tours',
    name: 'Mahana Tours',
    icon: '🚐',
    subtitle: 'Turismo, Rutas & Experiencias',
    color: '#72efdd',
    subBrands: ['Tours', 'Transporte', 'Alianzas'],
  },
  {
    id: 'business-bee-smart',
    name: 'Bee Smart',
    icon: '🐝',
    subtitle: 'Consultoría Comercial, Ingredienta & IA para Todos',
    color: '#f5c451',
    subBrands: ['IA para Todos', 'Ingredienta', 'Hotel Panamá Canal', 'Rollup y Flyers'],
  },
  {
    id: 'business-sm-jaleel',
    name: 'S.M. Jaleel',
    icon: '🥤',
    subtitle: 'Centro Contractual · 301,430 Cases & Scorecard',
    color: '#e97a6e',
    subBrands: ['Contrato Año 1', 'Scorecard 14 Criterios', 'Canadá / Caribe'],
  },
  {
    id: 'local-personal',
    name: 'Personal',
    icon: '👤',
    subtitle: 'Trámites Personales, Pasaporte, eTA & ESTA',
    color: '#b5c0cb',
    subBrands: ['Viajes y Visas', ' Salud / Healing', 'Personal'],
  },
];

export const HIDDEN_LEGACY_COMPANY_IDS = new Set([
  'local-business',
  'business-tuinsa',
  'business-surf-unassigned',
  'business-ia-para-todos',
]);

export const HIDDEN_DEMO_IDS = new Set([
  '77ee7641-3fde-499a-a784-d78fc97e5883',
  '5d1e091c-0c21-4b33-8837-17ecf6949177',
]);

export function getCompanyMeta(companyId: string, fallbackName?: string): HbCompanyMeta {
  const found = HB_CANONICAL_COMPANIES.find(c => c.id === companyId);
  if (found) return found;
  return {
    id: companyId,
    name: fallbackName || companyId,
    icon: '🏢',
    subtitle: 'Unidad de negocio activa',
    color: '#e9bc6e',
    subBrands: [],
  };
}

export function normalizeHbCompanies(existing: Company[]): Company[] {
  const byId = new Map<string, Company>();
  for (const c of existing) {
    if (HIDDEN_LEGACY_COMPANY_IDS.has(c.id)) continue;
    byId.set(c.id, { id: c.id, name: c.name });
  }
  const ordered: Company[] = [];
  for (const canonical of HB_CANONICAL_COMPANIES) {
    const current = byId.get(canonical.id);
    ordered.push({
      id: canonical.id,
      name: current?.name && current.name !== 'BEE SMART' ? current.name : canonical.name,
    });
    byId.delete(canonical.id);
  }
  for (const custom of byId.values()) {
    ordered.push(custom);
  }
  return ordered;
}

export function normalizeHbTask(task: Task): Task | null {
  if (HIDDEN_DEMO_IDS.has(task.id) || /^DEMO\b/i.test(task.title.trim())) {
    return null;
  }
  if (task.companyId === 'business-tuinsa') {
    return null;
  }
  const copy = { ...task };
  // Nest "IA para Todos" inside Bee Smart
  if (copy.companyId === 'business-ia-para-todos' || /ia para todos/i.test(copy.title)) {
    copy.companyId = 'business-bee-smart';
    copy.category = copy.category || 'IA para Todos';
    const subs = new Set([...(copy.subcategories || []), 'IA para Todos']);
    copy.subcategories = Array.from(subs);
  }
  // Assign "Surf · operación por asignar" (Surf 101 / Florencia Alvez) to Academia Nacional de Surf
  if (copy.companyId === 'business-surf-unassigned' || /surf 101/i.test(copy.title)) {
    copy.companyId = 'business-academia-surf';
    copy.category = copy.category || 'Surf 101';
    const subs = new Set([...(copy.subcategories || []), 'Surf 101']);
    copy.subcategories = Array.from(subs);
  }
  // Tag Ingredienta tasks inside Bee Smart
  if (copy.companyId === 'business-bee-smart' && /ingredienta/i.test(copy.title) && !copy.category) {
    copy.category = 'Ingredienta';
  }
  // Tag Rollup / Flyers inside Bee Smart
  if (copy.companyId === 'business-bee-smart' && /rollup|flyer/i.test(copy.title) && !copy.category) {
    copy.category = 'Rollup y Flyers';
  }
  return copy;
}

export function normalizeHbProjects(projects: Project[]): Project[] {
  return projects
    .filter(p => !HIDDEN_DEMO_IDS.has(p.id) && !/^DEMO\b/i.test(p.title.trim()))
    .map(p => {
      if (p.companyId === 'business-ia-para-todos') {
        return { ...p, companyId: 'business-bee-smart' };
      }
      if (p.companyId === 'business-surf-unassigned') {
        return { ...p, companyId: 'business-academia-surf' };
      }
      return p;
    });
}

export function ensureDefaultHbMeetings(tasks: Task[], actorId: string): Task[] {
  const hasArmandoOct21 = tasks.some(
    t => !t.cancelledAt && /armando/i.test(t.title) && (t.workDate === '2026-10-21' || t.dueDate?.startsWith('2026-10-21'))
  );
  const hasThursdayAppointment = tasks.some(
    t => !t.cancelledAt && t.isMeeting && (t.workDate === '2026-10-22' || t.dueDate?.startsWith('2026-10-22'))
  );
  const extra: Task[] = [];
  if (!hasArmandoOct21) {
    extra.push({
      id: 'hb-meeting-armando-2026-10-21',
      title: 'Reunión con Armando Pinzón · IA para Todos',
      description: 'Revisión de avances, logística y alineación de IA para Todos dentro de Bee Smart.',
      type: 'One-shot',
      steps: [],
      companyId: 'business-bee-smart',
      category: 'IA para Todos',
      subcategories: ['IA para Todos'],
      assigneeId: actorId,
      assigneeIds: [actorId],
      ownerId: actorId,
      status: 'Pending',
      priority: 'High',
      origin: 'Manual',
      workDate: '2026-10-21',
      dueDate: '2026-10-21',
      isMeeting: true,
      meetingTime: '10:00',
      validationStatus: 'Confirmed',
      attachments: [],
      activityLog: [],
      revision: 1,
    });
  }
  if (!hasThursdayAppointment) {
    extra.push({
      id: 'hb-meeting-jueves-2026-10-22',
      title: 'Cita del Jueves · Seguimiento Ejecutivo y Comercial',
      description: 'Reunión programada de seguimiento de entregables de la semana.',
      type: 'One-shot',
      steps: [],
      companyId: 'business-sm-jaleel',
      category: 'Seguimiento Comercial',
      subcategories: ['Contrato Año 1'],
      assigneeId: actorId,
      assigneeIds: [actorId],
      ownerId: actorId,
      status: 'Pending',
      priority: 'High',
      origin: 'Manual',
      workDate: '2026-10-22',
      dueDate: '2026-10-22',
      isMeeting: true,
      meetingTime: '14:30',
      validationStatus: 'Confirmed',
      attachments: [],
      activityLog: [],
      revision: 1,
    });
  }
  return [...tasks, ...extra];
}

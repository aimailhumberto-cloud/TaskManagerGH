import WorkspacePage from '@/components/WorkspacePage';
export const dynamic = 'force-dynamic';
/** Espacio de trabajo anterior de HB (empresas, proyectos, reuniones). Se conserva mientras se decide su migración. */
export default function Page() { return <WorkspacePage entry="home" classic />; }

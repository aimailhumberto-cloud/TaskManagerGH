/**
 * Dueño y visibilidad de cada nodo, para poder conectar varios cerebros más adelante.
 * Hoy es SOLO una etiqueta: no restringe nada. Los permisos reales llegan con la capa de seguridad.
 *
 * Encabezado opcional de cada nota:
 *   brain_id: smj            # a qué cerebro pertenece
 *   brain_owner: hb          # quién es el dueño (no usar "owner": suele significar responsable de una tarea)
 *   visibility: private      # private | shared | public
 *   shared_with: [ana, luis] # solo aplica si visibility es shared
 * Si la nota no dice nada, se asume el cerebro y dueño por defecto, y visibilidad privada.
 */

export type BrainVisibility = 'private' | 'shared' | 'public';

export type BrainOwnership = {
  brain_id: string;
  owner: string;
  visibility: BrainVisibility;
  shared_with: string[];
};

const VISIBILITIES: BrainVisibility[] = ['private', 'shared', 'public'];

function slug(value: unknown, fallback: string): string {
  const s = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return s || fallback;
}

export function getDefaultBrainIdentity(env: Record<string, string | undefined> = process.env): { brain_id: string; owner: string } {
  return {
    brain_id: slug(env.SMJ_BRAIN_ID, 'smj'),
    owner: slug(env.SMJ_BRAIN_OWNER, 'hb'),
  };
}

export function resolveOwnership(
  frontmatter: Record<string, any> | null | undefined,
  defaults: { brain_id: string; owner: string } = getDefaultBrainIdentity()
): BrainOwnership {
  const fm = frontmatter || {};
  const raw = String(fm.visibility ?? '').trim().toLowerCase();
  // Cualquier valor desconocido se trata como privado: ante la duda, no se comparte.
  const visibility: BrainVisibility = (VISIBILITIES as string[]).includes(raw) ? (raw as BrainVisibility) : 'private';
  const list = Array.isArray(fm.shared_with) ? fm.shared_with : (typeof fm.shared_with === 'string' && fm.shared_with.trim() ? fm.shared_with.split(',') : []);
  const shared_with = visibility === 'shared'
    ? Array.from(new Set(list.map((x: unknown) => slug(x, '')).filter(Boolean))) as string[]
    : [];
  return {
    brain_id: slug(fm.brain_id, defaults.brain_id),
    owner: slug(fm.brain_owner, defaults.owner),
    visibility,
    shared_with,
  };
}

import { resolveBrainNode, type IdentityNode } from './smjIdentity';

export interface ContactNode extends IdentityNode { spatial_anchor?: string }
export interface ContactLink {
  source: string | { id: string };
  target: string | { id: string };
  relationType?: string;
}
const end = (v: ContactLink['source']) => typeof v === 'string' ? v : v.id;
const refs = (v: unknown): string[] => Array.isArray(v) ? v.flatMap(refs) : typeof v === 'string' ? [v] : [];
function refIds(value: unknown, nodes: ContactNode[]): string[] {
  return refs(value).flatMap(r => {
    const found = resolveBrainNode(nodes, r);
    return found.kind === 'found' ? [found.node.id] : [];
  });
}

/** A commercial contact can belong to several distributors. This is not reporting hierarchy. */
export function contactDistributors(person: ContactNode, nodes: ContactNode[], links: ContactLink[] = []): ContactNode[] {
  if (person.type !== 'person') return [];
  const ids = new Set(refIds(person.frontmatter?.relations?.contact_for, nodes));
  for (const n of nodes) {
    if (n.type === 'distributor' && refIds(n.frontmatter?.relations?.has_contact, nodes).includes(person.id)) ids.add(n.id);
  }
  for (const l of links) {
    if (end(l.source) === person.id && l.relationType === 'contact_for') ids.add(end(l.target));
    if (end(l.target) === person.id && l.relationType === 'has_contact') ids.add(end(l.source));
  }
  return nodes.filter(n => n.type === 'distributor' && ids.has(n.id));
}

export function distributorContacts(id: string, nodes: ContactNode[], links: ContactLink[] = []): ContactNode[] {
  return nodes.filter(n => n.type === 'person' && contactDistributors(n, nodes, links).some(d => d.id === id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Overlay only the contact's target; each existing layout keeps all its other targets. */
export function contactTarget(person: ContactNode, nodes: ContactNode[], baseTarget: (n: ContactNode) => { x: number; y: number }): { x: number; y: number } | null {
  const parents = contactDistributors(person, nodes);
  if (!parents.length) return null;
  const anchor = String(person.frontmatter?.spatial_anchor || person.spatial_anchor || '').replace(/^\[\[|\]\]$/g, '');
  const parent = parents.find(n => n.id === anchor) || [...parents].sort((a, b) => a.id.localeCompare(b.id))[0];
  const point = baseTarget(parent);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const siblings = distributorContacts(parent.id, nodes).filter(n => {
    const own = String(n.frontmatter?.spatial_anchor || n.spatial_anchor || '').replace(/^\[\[|\]\]$/g, '');
    const ownParents = contactDistributors(n, nodes);
    const ownParent = ownParents.find(p => p.id === own) || [...ownParents].sort((a, b) => a.id.localeCompare(b.id))[0];
    return ownParent?.id === parent.id;
  });
  const index = Math.max(0, siblings.findIndex(n => n.id === person.id));
  return { x: point.x + (point.x < 0 ? -1 : 1) * (100 + Math.floor(index / 6) * 84), y: point.y + 72 + (index % 6) * 70 };
}

const relationNames: Record<string, string> = {
  contact_for: 'Contacto comercial', has_contact: 'Contacto comercial', coordinates_with: 'Coordinación',
  in_contact_with: 'Contacto', covers_channel: 'Canal vinculado', channel_contact: 'Contacto de canal',
  operates_in_market: 'Mercado', belongs_to_market: 'Mercado', reports_to: 'Reporta a',
};
export function contactConnections(id: string, nodes: ContactNode[], links: ContactLink[]): { node: ContactNode; labels: string[] }[] {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const grouped = new Map<string, Set<string>>();
  for (const l of links) {
    const s = end(l.source), t = end(l.target);
    if (s !== id && t !== id) continue;
    const other = s === id ? t : s;
    if (other === id || !byId.has(other) || !l.relationType || ['reference', 'references'].includes(l.relationType)) continue;
    const labels = grouped.get(other) || new Set<string>();
    labels.add(relationNames[l.relationType] || l.relationType.replaceAll('_', ' '));
    grouped.set(other, labels);
  }
  return [...grouped].map(([other, labels]) => ({ node: byId.get(other)!, labels: [...labels] }))
    .sort((a, b) => (a.node.title || a.node.id).localeCompare(b.node.title || b.node.id));
}

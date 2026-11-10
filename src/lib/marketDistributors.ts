/** Only stored, directed commercial relationships establish distribution.
 * A reference, country-name match, office address or unknown assignment does not.
 */
export interface DistributorNode {
  id: string;
  title?: string;
  type?: string;
  status?: string;
  frontmatter?: Record<string, any>;
}

export interface DistributorLink {
  source: string | { id: string };
  target: string | { id: string };
  relationType?: string;
}

const endpoint = (value: DistributorLink['source']) => typeof value === 'string' ? value : value.id;

export function getMarketDistributors(marketId: string, nodes: DistributorNode[], links: DistributorLink[]): DistributorNode[] {
  const market = nodes.find(n => n.id === marketId);
  if (!market || market.type !== 'market') return [];
  const assigned = new Set<string>();
  for (const link of links) {
    const source = endpoint(link.source);
    const target = endpoint(link.target);
    if (source === marketId && link.relationType === 'distributors') assigned.add(target);
    if (target === marketId && link.relationType === 'belongs_to_market') assigned.add(source);
  }
  return nodes.filter(n => {
    const fm = n.frontmatter || {};
    const inactive = ['historical_inactive', 'inactive', 'archived'];
    return n.type === 'distributor' && assigned.has(n.id) && fm.is_active !== false &&
      !inactive.includes(String(n.status || '').toLowerCase()) &&
      !inactive.includes(String(fm.status || '').toLowerCase());
  });
}

export function distributorDisplayName(node: DistributorNode): string {
  return node.frontmatter?.company_name || (node.title || node.id).replace(/^Distributor:\s*/i, '');
}

export function marketDistributorLabel(distributors: DistributorNode[]): string {
  return distributors.length ? distributors.map(distributorDisplayName).join(' · ') : 'Dato pendiente: distribuidor no confirmado';
}

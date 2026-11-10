import { describe, it, expect } from '../harness/test-framework.mjs';

describe('Tier 3 — Combination 6: Compact Header Filters + Graph Node Filtering', () => {
  const sampleNodes = [
    { id: 'core-tt', title: 'S.M. Jaleel HQ', country: 'Trinidad & Tobago', type: 'core' },
    { id: 'org-guyana', title: 'Guyana Beverages Inc.', country: 'Guyana', type: 'organization' },
    { id: 'dist-medimex', title: 'MEDIMEX S.A.', country: 'Panama', type: 'distributor' },
    { id: 'brand-chubby', title: 'Chubby Soda', country: 'Global', type: 'brand' },
  ];

  function applyMobileFilter(nodes, selectedMarket, selectedLens) {
    return nodes.filter(n => {
      // Core nodes always remain visible
      if (n.type === 'core') return true;

      // Filter by market
      if (selectedMarket && selectedMarket !== 'all') {
        const countryMatch = (n.country || '').toLowerCase().includes(selectedMarket.toLowerCase());
        if (!countryMatch) return false;
      }

      // Filter by lens
      if (selectedLens && selectedLens !== 'global-core') {
        if (selectedLens === 'commercial' && n.type !== 'distributor' && n.type !== 'customer') return false;
        if (selectedLens === 'operations' && n.type !== 'organization') return false;
      }

      return true;
    });
  }

  it('Comb6-T1: filters graph nodes by market from mobile header popover selection', () => {
    const filtered = applyMobileFilter(sampleNodes, 'panama', 'global-core');
    expect(filtered.length).toBe(2);
    const ids = filtered.map(n => n.id);
    expect(ids).toContain('core-tt');       // Core preserved
    expect(ids).toContain('dist-medimex');  // Panama match
    expect(ids).not.toContain('org-guyana');
  });

  it('Comb6-T2: filters graph nodes by functional lens (commercial) from header popover', () => {
    const filtered = applyMobileFilter(sampleNodes, 'all', 'commercial');
    const ids = filtered.map(n => n.id);
    expect(ids).toContain('core-tt');
    expect(ids).toContain('dist-medimex');
    expect(ids).not.toContain('brand-chubby');
  });

  it('Comb6-T3: combines market filter and lens filter concurrently', () => {
    const filtered = applyMobileFilter(sampleNodes, 'guyana', 'operations');
    const ids = filtered.map(n => n.id);
    expect(ids).toContain('core-tt');
    expect(ids).toContain('org-guyana');
    expect(ids).not.toContain('dist-medimex');
  });

  it('Comb6-T4: resets filters back to global overview cleanly', () => {
    const reset = applyMobileFilter(sampleNodes, 'all', 'global-core');
    expect(reset.length).toBe(sampleNodes.length);
  });
});

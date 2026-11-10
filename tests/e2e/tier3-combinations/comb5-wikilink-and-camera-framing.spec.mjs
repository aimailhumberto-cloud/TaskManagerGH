import { describe, it, expect } from '../harness/test-framework.mjs';
import { parseWikilinkTokens } from '../helpers/render-shield.mjs';
import { calculateCameraAutoFraming } from '../helpers/mobile-simulator.mjs';

describe('Tier 3 — Combination 5: Wikilink Navigation + Camera Auto-Framing', () => {
  const nodeDatabase = new Map([
    ['core-smj', { id: 'core-smj', title: 'Core - S.M. Jaleel & Co. Ltd.', x: 0, y: 0 }],
    ['dist-medimex', { id: 'dist-medimex', title: 'Distributor - MEDIMEX', x: 450, y: 320 }],
    ['mkt-panama', { id: 'mkt-panama', title: 'Market - Panama', x: 400, y: 550 }],
  ]);

  function simulateWikilinkNavigation(wikilinkTarget, isMobile, viewport) {
    const targetNorm = wikilinkTarget.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    let matchedNode = null;

    for (const [id, node] of nodeDatabase.entries()) {
      if (id === targetNorm || node.title.toLowerCase().includes(wikilinkTarget.toLowerCase())) {
        matchedNode = node;
        break;
      }
    }

    if (!matchedNode) return null;

    const framing = calculateCameraAutoFraming({
      nodeX: matchedNode.x,
      nodeY: matchedNode.y,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      isMobile,
      bottomSheetOpen: true,
    });

    return {
      node: matchedNode,
      framing,
    };
  }

  it('Comb5-T1: clicks wikilink in dossier, resolves target node, and offsets camera for mobile view', () => {
    const rawParagraph = 'Ver acuerdo comercial vigente con [[Distributor - MEDIMEX]].';
    const tokens = parseWikilinkTokens(rawParagraph);
    const linkToken = tokens.find(t => t.type === 'wikilink');

    expect(linkToken).toBeDefined();

    const navResult = simulateWikilinkNavigation(linkToken.target, true, { width: 390, height: 844 });
    expect(navResult).not.toBeNull();
    expect(navResult.node.id).toBe('dist-medimex');
    expect(navResult.framing.targetX).toBe(450);
    expect(navResult.framing.targetY).toBeLessThan(320); // Mobile offset
    expect(navResult.framing.nodeScreenYPercent).toBeLessThan(35);
  });

  it('Comb5-T2: preserves center framing when navigating wikilinks on desktop viewport', () => {
    const navResult = simulateWikilinkNavigation('Distributor - MEDIMEX', false, { width: 1440, height: 900 });
    expect(navResult).not.toBeNull();
    expect(navResult.framing.targetX).toBe(450);
    expect(navResult.framing.targetY).toBe(320); // Exact center on desktop
    expect(navResult.framing.nodeScreenYPercent).toBe(50);
  });

  it('Comb5-T3: handles chained wikilink navigation across 3 nodes sequentially', () => {
    const chain = ['Core - S.M. Jaleel & Co. Ltd.', 'Distributor - MEDIMEX', 'Market - Panama'];
    const results = chain.map(target => simulateWikilinkNavigation(target, true, { width: 375, height: 667 }));

    expect(results.every(r => r !== null)).toBe(true);
    expect(results[0].node.id).toBe('core-smj');
    expect(results[1].node.id).toBe('dist-medimex');
    expect(results[2].node.id).toBe('mkt-panama');
  });
});

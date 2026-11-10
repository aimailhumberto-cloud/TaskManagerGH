import { describe, it, expect } from '../harness/test-framework.mjs';
import { parseWikilinkTokens } from '../helpers/render-shield.mjs';
import { calculateCameraAutoFraming } from '../helpers/mobile-simulator.mjs';

describe('Tier 4 — Scenario 3: Executive Wikilink Graph Traversal Across Corporate Tiers', () => {
  const nodes = [
    { id: 'core-smj', title: 'Core - S.M. Jaleel & Co. Ltd.', x: 0, y: 0, type: 'core' },
    { id: 'mkt-tt', title: 'Country - Trinidad & Tobago', x: 200, y: -100, type: 'market' },
    { id: 'person-humberto', title: 'Person - Humberto Bouche', x: -150, y: 300, type: 'person' },
    { id: 'dist-medimex', title: 'Distributor - MEDIMEX', x: 450, y: 320, type: 'distributor' },
  ];

  class GraphSessionSimulator {
    constructor() {
      this.history = [];
      this.currentNode = null;
      this.camera = { x: 0, y: 0 };
    }

    selectNode(nodeId, isMobile = true, vp = { width: 390, height: 844 }) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      if (this.currentNode) {
        this.history.push(this.currentNode.id);
      }
      this.currentNode = node;
      const framing = calculateCameraAutoFraming({
        nodeX: node.x,
        nodeY: node.y,
        viewportWidth: vp.width,
        viewportHeight: vp.height,
        isMobile,
        bottomSheetOpen: true,
      });
      this.camera = { x: framing.targetX, y: framing.targetY };
      return { node: this.currentNode, camera: this.camera };
    }

    followWikilink(linkText, isMobile = true) {
      const tokens = parseWikilinkTokens(linkText);
      const link = tokens.find(t => t.type === 'wikilink');
      if (!link) throw new Error(`No wikilink in text: ${linkText}`);

      const target = link.target;
      const matched = nodes.find(n => n.title.toLowerCase() === target.toLowerCase() || n.id.toLowerCase() === target.toLowerCase());
      if (!matched) throw new Error(`Target not found in graph: ${target}`);
      return this.selectNode(matched.id, isMobile);
    }

    goBack(isMobile = true) {
      if (this.history.length === 0) return null;
      const prevId = this.history.pop();
      return this.selectNode(prevId, isMobile);
    }
  }

  it('Step 1: director opens Cerebro starting at Trinidad HQ Core node', () => {
    const session = new GraphSessionSimulator();
    const state = session.selectNode('core-smj');

    expect(state.node.id).toBe('core-smj');
    expect(state.node.title).toContain('S.M. Jaleel & Co. Ltd.');
  });

  it('Step 2: director reads HQ relations and clicks [[Country - Trinidad & Tobago]]', () => {
    const session = new GraphSessionSimulator();
    session.selectNode('core-smj');

    const state = session.followWikilink('Sede principal ubicada en [[Country - Trinidad & Tobago]].');
    expect(state.node.id).toBe('mkt-tt');
    expect(state.camera.x).toBe(200);
    expect(session.history).toContain('core-smj');
  });

  it('Step 3: director clicks wikilink to executive leader [[Person - Humberto Bouche]]', () => {
    const session = new GraphSessionSimulator();
    session.selectNode('core-smj');
    session.followWikilink('Mercado [[Country - Trinidad & Tobago]]');

    const state = session.followWikilink('Supervisión asignada a [[Person - Humberto Bouche]].');
    expect(state.node.id).toBe('person-humberto');
    expect(state.camera.x).toBe(-150);
  });

  it('Step 4: director clicks back button and restores previous market node focus', () => {
    const session = new GraphSessionSimulator();
    session.selectNode('core-smj');
    session.followWikilink('Mercado [[Country - Trinidad & Tobago]]');
    session.followWikilink('Supervisión [[Person - Humberto Bouche]]');

    const prevState = session.goBack();
    expect(prevState.node.id).toBe('mkt-tt');
  });
});

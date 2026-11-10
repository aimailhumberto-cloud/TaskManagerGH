import { describe, it, expect } from '../harness/test-framework.mjs';
import { parseWikilinkTokens } from '../helpers/render-shield.mjs';

describe('Tier 1 — Feature 6: Interactive Wikilinks in Dossier', () => {
  it('F6-T1: parses standard wikilinks without alias', () => {
    const text = 'Revisar la ficha de [[Core - S.M. Jaleel & Co. Ltd.]] para detalles corporativos.';
    const tokens = parseWikilinkTokens(text);

    expect(tokens.length).toBe(3);
    expect(tokens[0].type).toBe('text');
    expect(tokens[1].type).toBe('wikilink');
    expect(tokens[1].target).toBe('Core - S.M. Jaleel & Co. Ltd.');
    expect(tokens[1].alias).toBe('Core - S.M. Jaleel & Co. Ltd.');
    expect(tokens[2].type).toBe('text');
  });

  it('F6-T2: parses piped wikilinks with alias and custom label', () => {
    const text = 'Ver acuerdo con [[Distributor - MEDIMEX|Medimex S.A. Distribución]].';
    const tokens = parseWikilinkTokens(text);

    const linkToken = tokens.find(t => t.type === 'wikilink');
    expect(linkToken).toBeDefined();
    expect(linkToken.target).toBe('Distributor - MEDIMEX');
    expect(linkToken.alias).toBe('Medimex S.A. Distribución');
  });

  it('F6-T3: parses multiple sequential wikilinks in a single paragraph', () => {
    const text = 'Coordinación entre [[Person - Anna Mohammed]] y [[Person - Clint Villafana]] para Trinidad.';
    const tokens = parseWikilinkTokens(text);
    const links = tokens.filter(t => t.type === 'wikilink');

    expect(links.length).toBe(2);
    expect(links[0].target).toBe('Person - Anna Mohammed');
    expect(links[1].target).toBe('Person - Clint Villafana');
  });

  it('F6-T4: handles whitespace within wikilink delimiters gracefully', () => {
    const text = 'Ver [[ Country - Trinidad & Tobago | Mercado Trinidad ]] ahora.';
    const tokens = parseWikilinkTokens(text);
    const link = tokens.find(t => t.type === 'wikilink');

    expect(link.target).toBe('Country - Trinidad & Tobago');
    expect(link.alias).toBe('Mercado Trinidad');
  });

  it('F6-T5: resolves target title into standard normalized graph node identifier', () => {
    function resolveNodeId(targetTitle) {
      return targetTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    const t1 = resolveNodeId('Core - S.M. Jaleel & Co. Ltd.');
    const t2 = resolveNodeId('Distributor - MEDIMEX');

    expect(t1).toContain('core-s-m-jaleel');
    expect(t2).toContain('distributor-medimex');
  });
});

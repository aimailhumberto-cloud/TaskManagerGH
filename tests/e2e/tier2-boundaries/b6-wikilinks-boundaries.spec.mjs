import { describe, it, expect } from '../harness/test-framework.mjs';
import { parseWikilinkTokens } from '../helpers/render-shield.mjs';

describe('Tier 2 — Boundary 6: Wikilinks Edge Cases', () => {
  it('B6-T1: ignores empty wikilink brackets without producing broken tokens', () => {
    const text = 'Texto con [[]] y [[   ]] vacíos.';
    const tokens = parseWikilinkTokens(text);
    const wikilinks = tokens.filter(t => t.type === 'wikilink');
    expect(wikilinks.length).toBe(0);
  });

  it('B6-T2: falls back to target if alias after pipe is empty', () => {
    const text = 'Ver [[ Distributor - MEDIMEX | ]] ahora.';
    const tokens = parseWikilinkTokens(text);
    const link = tokens.find(t => t.type === 'wikilink');
    expect(link).toBeDefined();
    expect(link.target).toBe('Distributor - MEDIMEX');
    expect(link.alias).toBe('Distributor - MEDIMEX');
  });

  it('B6-T3: handles multiple consecutive wikilinks without delimiter spaces', () => {
    const text = '[[LinkA]][[LinkB]][[LinkC]]';
    const tokens = parseWikilinkTokens(text);
    const links = tokens.filter(t => t.type === 'wikilink');
    expect(links.length).toBe(3);
    expect(links[0].target).toBe('LinkA');
    expect(links[1].target).toBe('LinkB');
    expect(links[2].target).toBe('LinkC');
  });

  it('B6-T4: handles unclosed bracket sequence without breaking tokenizer', () => {
    const text = 'Este es un enlace roto [[ Sin Cerrar y continúa el texto.';
    const tokens = parseWikilinkTokens(text);
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe('text');
    expect(tokens[0].content).toContain('Sin Cerrar');
  });

  it('B6-T5: parses complex paths and extensions in wikilink targets', () => {
    const text = 'Ficha en [[01-Internal-Clients/Estructura-corporativa-2026-11-09/group-smj-group.md|Grupo Corporativo]].';
    const tokens = parseWikilinkTokens(text);
    const link = tokens.find(t => t.type === 'wikilink');
    expect(link.target).toBe('01-Internal-Clients/Estructura-corporativa-2026-11-09/group-smj-group.md');
    expect(link.alias).toBe('Grupo Corporativo');
  });
});

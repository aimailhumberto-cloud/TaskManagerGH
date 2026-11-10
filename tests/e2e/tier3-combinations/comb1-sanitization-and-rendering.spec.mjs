import { describe, it, expect } from '../harness/test-framework.mjs';
import { sanitizeAndParseBody, stripJsonBlocks, filterTechnicalSections } from '../helpers/render-shield.mjs';

describe('Tier 3 — Combination 1: Sanitization + Rendering Shield Defense-in-Depth', () => {
  it('Comb1-T1: verifies double-shielding ensures zero residual JSON even if raw file bypasses vault sanitization', () => {
    // Simulated raw un-sanitized file content from 01-Internal-Clients/Core - S.M. Jaleel & Co. Ltd..md
    const unSanitizedRaw = `## Operaciones y Capacidad
Líneas de embotellado de alta velocidad operando en San Fernando.

## Corporate evidence batch 2026-11-09
Source package: C:\\Outputs\\Corporate_Structure_2026-11-09
{
  "id": "STR-REL-001",
  "source_references": [
    { "id": "PUB-CAREERS", "location": "https://www.smjaleel.net" }
  ]
}

## Visual sources associated 2026-11-09
Verified local bytes.`;

    // Passing unsanitized content directly through frontend render shield
    const ast = sanitizeAndParseBody(unSanitizedRaw);

    expect(ast.length).toBe(2);
    expect(ast[0].type).toBe('h2');
    expect(ast[0].title).toBe('Operaciones y Capacidad');
    expect(ast[1].type).toBe('paragraph');
    expect(ast[1].content).toContain('San Fernando');

    // Asserts 100% elimination of residual batch and JSON
    const serialized = JSON.stringify(ast);
    expect(serialized).not.toContain('STR-REL-001');
    expect(serialized).not.toContain('Corporate evidence batch');
    expect(serialized).not.toContain('Visual sources associated');
  });

  it('Comb1-T2: preserves legitimate markdown body untouched when file was already sanitized at vault level', () => {
    const alreadySanitized = `## Visión Estratégica
Consolidación de operaciones en el Caribe y Centroamérica.

- Expansión de marca Chubby en Panamá
- Alianza comercial con [[Distributor - MEDIMEX]]`;

    const ast = sanitizeAndParseBody(alreadySanitized);
    expect(ast.length).toBe(4);
    expect(ast[0].type).toBe('h2');
    expect(ast[0].title).toBe('Visión Estratégica');
    expect(ast[1].type).toBe('paragraph');
    expect(ast[2].type).toBe('bullet');
    expect(ast[2].content).toContain('Chubby');
    expect(ast[3].type).toBe('bullet');
    expect(ast[3].tokens.some(t => t.type === 'wikilink')).toBe(true);
  });

  it('Comb1-T3: handles edge case where technical section is embedded in the middle of executive body', () => {
    const middleBatch = `## Sección Inicial
Primer bloque legítimo.

## Person and connection audit - 2026-11-09
Audit details to eliminate.
{ "audit_id": "AUD-01" }

## Sección Posterior
Segundo bloque legítimo que debe preservarse intacto.`;

    const ast = sanitizeAndParseBody(middleBatch);
    const headings = ast.filter(e => e.type === 'h2').map(e => e.title);
    expect(headings).toContain('Sección Inicial');
    expect(headings).toContain('Sección Posterior');
    expect(headings).not.toContain('Person and connection audit');

    const fullContent = ast.map(e => e.content || e.title).join(' ');
    expect(fullContent).toContain('Primer bloque legítimo');
    expect(fullContent).toContain('Segundo bloque legítimo');
    expect(fullContent).not.toContain('AUD-01');
  });

  it('Comb1-T4: strips multiple JSON blocks scattered throughout body while keeping all intermediate text', () => {
    const multiJson = `Párrafo 1.
{ "json": 1 }
Párrafo 2.
{ "json": 2, "nested": { "val": true } }
Párrafo 3.`;

    const ast = sanitizeAndParseBody(multiJson);
    expect(ast.length).toBe(3);
    expect(ast[0].content).toBe('Párrafo 1.');
    expect(ast[1].content).toBe('Párrafo 2.');
    expect(ast[2].content).toBe('Párrafo 3.');
  });
});

import { describe, it, expect } from '../harness/test-framework.mjs';
import { stripJsonBlocks, filterTechnicalSections, sanitizeAndParseBody } from '../helpers/render-shield.mjs';

describe('Tier 1 — Feature 5: Frontend Rendering Shield', () => {
  it('F5-T1: strips flat single-level JSON objects from body text', () => {
    const raw = 'Intro text.\n{ "id": "TEST-01", "name": "Val" }\nOutro text.';
    const cleaned = stripJsonBlocks(raw);
    expect(cleaned).toContain('Intro text.');
    expect(cleaned).toContain('Outro text.');
    expect(cleaned).not.toContain('TEST-01');
    expect(cleaned).not.toContain('{');
    expect(cleaned).not.toContain('}');
  });

  it('F5-T2: strips nested JSON objects containing internal braces and arrays without trailing artifacts', () => {
    const nestedJson = `Texto previo.
{
  "id": "STR-REL-001",
  "source_references": [
    {
      "id": "PUB-CAREERS",
      "location": "https://www.smjaleel.net"
    }
  ],
  "notes": "Group is a research grouping."
}
Texto posterior.`;

    const cleaned = stripJsonBlocks(nestedJson);
    expect(cleaned).toContain('Texto previo.');
    expect(cleaned).toContain('Texto posterior.');
    expect(cleaned).not.toContain('PUB-CAREERS');
    expect(cleaned).not.toContain('Group is a research grouping.');
    expect(cleaned).not.toContain('}');
  });

  it('F5-T3: filters out technical audit sections like Corporate evidence batch and Visual sources', () => {
    const body = `## Operaciones Comerciales
Ventas sólidas en el Caribe.

## Corporate evidence batch 2026-11-09
Batch details that should be excluded.

## Visual sources associated 2026-11-09
Visual metadata to be excluded.

## Próximos Pasos
Continuar expansión.`;

    const filtered = filterTechnicalSections(body);
    expect(filtered).toContain('## Operaciones Comerciales');
    expect(filtered).toContain('Ventas sólidas en el Caribe.');
    expect(filtered).toContain('## Próximos Pasos');
    expect(filtered).toContain('Continuar expansión.');
    expect(filtered).not.toContain('Corporate evidence batch');
    expect(filtered).not.toContain('Visual sources associated');
  });

  it('F5-T4: discards single-line scraping disclaimers', () => {
    const body = `Párrafo legítimo.
Source package: C:\\Documents\\Outputs\\Scraping
Sources: C:\\Downloads\\organigrama.md
Uncorroborated legacy fields and percentages remain unverified.
Professional contexts are not employment.
Párrafo final seguro.`;

    const filtered = filterTechnicalSections(body);
    expect(filtered).toContain('Párrafo legítimo.');
    expect(filtered).toContain('Párrafo final seguro.');
    expect(filtered).not.toContain('Source package:');
    expect(filtered).not.toContain('Sources:');
    expect(filtered).not.toContain('Uncorroborated legacy fields');
    expect(filtered).not.toContain('Professional contexts are not');
  });

  it('F5-T5: generates clean AST representing headings, bullets and paragraphs', () => {
    const raw = `## Visión General
Esta es la visión general.

- Canal supermercados
- Canal mayorista

{ "internal": true }`;

    const elements = sanitizeAndParseBody(raw);
    expect(elements.length).toBe(4);
    expect(elements[0].type).toBe('h2');
    expect(elements[0].title).toBe('Visión General');
    expect(elements[1].type).toBe('paragraph');
    expect(elements[1].content).toBe('Esta es la visión general.');
    expect(elements[2].type).toBe('bullet');
    expect(elements[2].content).toBe('Canal supermercados');
    expect(elements[3].type).toBe('bullet');
    expect(elements[3].content).toBe('Canal mayorista');
  });
});

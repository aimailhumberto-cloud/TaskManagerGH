import { describe, it, expect } from '../harness/test-framework.mjs';
import { stripJsonBlocks, filterTechnicalSections, sanitizeAndParseBody } from '../helpers/render-shield.mjs';

describe('Tier 2 — Boundary 5: Frontend Rendering Shield Edge Cases', () => {
  it('B5-T1: handles JSON with escaped quotes and internal curly braces inside string values', () => {
    const raw = `Inicio.
{
  "description": "El objeto contiene { llaves internas } y comillas escapadas \\"ejemplo\\"",
  "status": "ok"
}
Fin.`;

    const cleaned = stripJsonBlocks(raw);
    expect(cleaned).toContain('Inicio.');
    expect(cleaned).toContain('Fin.');
    expect(cleaned).not.toContain('llaves internas');
    expect(cleaned).not.toContain('status');
  });

  it('B5-T2: handles multiple discrete JSON blocks separated by executive prose', () => {
    const raw = `Bloque A.
{ "id": "A" }
Párrafo intermedio de análisis.
{ "id": "B", "child": { "c": 1 } }
Bloque B.`;

    const cleaned = stripJsonBlocks(raw);
    expect(cleaned).toContain('Bloque A.');
    expect(cleaned).toContain('Párrafo intermedio de análisis.');
    expect(cleaned).toContain('Bloque B.');
    expect(cleaned).not.toContain('"id": "A"');
    expect(cleaned).not.toContain('"id": "B"');
  });

  it('B5-T3: handles empty string, null, or undefined gracefully without throwing', () => {
    expect(stripJsonBlocks('')).toBe('');
    expect(stripJsonBlocks(null)).toBe('');
    expect(stripJsonBlocks(undefined)).toBe('');
    expect(filterTechnicalSections('')).toBe('');
    expect(sanitizeAndParseBody('')).toEqual([]);
    expect(sanitizeAndParseBody(null)).toEqual([]);
  });

  it('B5-T4: handles whitespace-only body and produces empty element array', () => {
    const elements = sanitizeAndParseBody('   \n\t  \n   ');
    expect(elements.length).toBe(0);
  });

  it('B5-T5: handles text with unclosed curly brace without throwing an unhandled exception', () => {
    const unclosed = 'Párrafo normal con una llave abierta { y texto que sigue.';
    const cleaned = stripJsonBlocks(unclosed);
    expect(typeof cleaned).toBe('string');
  });
});

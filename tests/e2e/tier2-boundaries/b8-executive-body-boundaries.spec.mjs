import { describe, it, expect } from '../harness/test-framework.mjs';
import { sanitizeAndParseBody } from '../helpers/render-shield.mjs';

describe('Tier 2 — Boundary 8: Executive Body Edge Cases', () => {
  it('B8-T1: parses body without any standard headers as flat paragraphs', () => {
    const raw = `Texto introductorio continuo sin ningún encabezado h2 o h3.
Segundo párrafo ejecutivo con observaciones generales.`;

    const ast = sanitizeAndParseBody(raw);
    expect(ast.length).toBe(2);
    expect(ast[0].type).toBe('paragraph');
    expect(ast[1].type).toBe('paragraph');
  });

  it('B8-T2: parses nested bullet lists and asterisk bullets consistently', () => {
    const raw = `## Sección
* Bullet con asterisco 1
* Bullet con asterisco 2
- Bullet con guion 3`;

    const ast = sanitizeAndParseBody(raw);
    const bullets = ast.filter(e => e.type === 'bullet');
    expect(bullets.length).toBe(3);
    expect(bullets[0].content).toBe('Bullet con asterisco 1');
    expect(bullets[2].content).toBe('Bullet con guion 3');
  });

  it('B8-T3: handles level 3 headings (###) properly in AST', () => {
    const raw = `## Nivel 2
### Subsección Estratégica
Detalle táctico.`;

    const ast = sanitizeAndParseBody(raw);
    expect(ast[0].type).toBe('h2');
    expect(ast[1].type).toBe('h3');
    expect(ast[1].title).toBe('Subsección Estratégica');
    expect(ast[2].type).toBe('paragraph');
  });

  it('B8-T4: renders large executive report (50,000 chars) in under 50ms', () => {
    let largeBody = '## Gran Reporte Anual\n';
    for (let i = 0; i < 500; i++) {
      largeBody += `- Indicador de rendimiento ${i}: Valor óptimo verificado en planta.\n`;
    }

    const t0 = Date.now();
    const ast = sanitizeAndParseBody(largeBody);
    const duration = Date.now() - t0;

    expect(duration).toBeLessThan(50);
    expect(ast.length).toBe(501);
  });

  it('B8-T5: parses markdown containing both markdown URLs and wikilinks', () => {
    const raw = 'Consultar portal [SMJ Online](https://smjaleel.net) y la ficha [[Distributor - MEDIMEX]].';
    const ast = sanitizeAndParseBody(raw);
    expect(ast.length).toBe(1);
    const wikilink = ast[0].tokens.find(t => t.type === 'wikilink');
    expect(wikilink).toBeDefined();
    expect(wikilink.target).toBe('Distributor - MEDIMEX');
  });
});

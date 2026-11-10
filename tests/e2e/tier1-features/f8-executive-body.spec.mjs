import { describe, it, expect } from '../harness/test-framework.mjs';
import { sanitizeAndParseBody } from '../helpers/render-shield.mjs';

describe('Tier 1 — Feature 8: Enriched Executive Body Structure', () => {
  const sampleExecutiveBody = `## Visión General & Posicionamiento
Líder en manufactura y distribución de bebidas en el Caribe anglófono y mercados internacionales.

## Operaciones y Capacidad
- Capacidad instalada: 12 líneas de embotellado de alta velocidad.
- Cumplimiento normativo ISO 9001 e ISO 22000 verificado.

## Relaciones Clave y Ecosistema
- Distribución en Panamá a través de [[Distributor - MEDIMEX]].
- Supervisión comercial por [[Person - Humberto Bouche]].

## Próximos Pasos & Hitos
- Expansión de portafolio de néctares Fruta en Centroamérica.
- Auditoría logística programada para Q1 2027.
`;

  it('F8-T1: verifies standard 4 executive sections are present', () => {
    const ast = sanitizeAndParseBody(sampleExecutiveBody);
    const headings = ast.filter(e => e.type === 'h2').map(e => e.title);

    expect(headings).toContain('Visión General & Posicionamiento');
    expect(headings).toContain('Operaciones y Capacidad');
    expect(headings).toContain('Relaciones Clave y Ecosistema');
    expect(headings).toContain('Próximos Pasos & Hitos');
  });

  it('F8-T2: verifies executive bullets are formatted concisely', () => {
    const ast = sanitizeAndParseBody(sampleExecutiveBody);
    const bullets = ast.filter(e => e.type === 'bullet');
    expect(bullets.length).toBeGreaterThanOrEqual(4);
    expect(bullets[0].content).toContain('12 líneas de embotellado');
  });

  it('F8-T3: verifies wikilinks embedded in executive relations are parsed into tokens', () => {
    const ast = sanitizeAndParseBody(sampleExecutiveBody);
    const relationBullet = ast.find(e => e.content && e.content.includes('Distributor - MEDIMEX'));
    expect(relationBullet).toBeDefined();

    const linkToken = relationBullet.tokens.find(t => t.type === 'wikilink');
    expect(linkToken).toBeDefined();
    expect(linkToken.target).toBe('Distributor - MEDIMEX');
  });

  it('F8-T4: verifies absence of scraping disclaimers in executive text', () => {
    const ast = sanitizeAndParseBody(sampleExecutiveBody);
    const rawText = ast.map(e => e.content || e.title).join(' ');
    expect(rawText).not.toContain('Source package:');
    expect(rawText).not.toContain('Uncorroborated legacy');
  });

  it('F8-T5: confirms body renders non-empty executive elements', () => {
    const ast = sanitizeAndParseBody(sampleExecutiveBody);
    expect(ast.length).toBeGreaterThanOrEqual(8);
  });
});

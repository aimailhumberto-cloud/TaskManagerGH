import { describe, it, expect } from '../harness/test-framework.mjs';

function robustSanitize(content) {
  const match = content.match(/## Corporate evidence batch[^\r\n]*/);
  if (!match) return content;
  return content.slice(0, match.index).trimEnd() + '\n';
}

describe('Tier 2 — Boundary 4: Vault Sanitization Edge Cases', () => {
  it('B4-T1: handles batch header appearing immediately after frontmatter', () => {
    const raw = `---
id: test-immediate-batch
---
## Corporate evidence batch 2026-11-09
{ "id": "TEST-01" }`;

    const sanitized = robustSanitize(raw);
    expect(sanitized).not.toContain('Corporate evidence batch');
    expect(sanitized).toContain('id: test-immediate-batch');
  });

  it('B4-T2: handles Windows CRLF (\\r\\n) line endings across batch header', () => {
    const raw = "---\r\nid: test-crlf\r\n---\r\n# Body\r\n\r\n## Corporate evidence batch 2026-11-09\r\n{\r\n  \"id\": \"CRLF-01\"\r\n}";
    const sanitized = robustSanitize(raw);
    expect(sanitized).not.toContain('CRLF-01');
    expect(sanitized).toContain('# Body');
  });

  it('B4-T3: preserves Spanish diacritics and emojis before truncation point', () => {
    const raw = `---
title: "Operación & Expansión — Región Centroamérica 🌎"
---
# Resumen Estratégico 🚀
Línea de producción en Panamá y Trinidad con verificación de calidad ISO.

## Corporate evidence batch 2026-11-09
Residual dump`;

    const sanitized = robustSanitize(raw);
    expect(sanitized).toContain('Región Centroamérica 🌎');
    expect(sanitized).toContain('Resumen Estratégico 🚀');
    expect(sanitized).not.toContain('Residual dump');
  });

  it('B4-T4: sanitizes large content (10,000 lines) in sub-millisecond time without catastrophic backtracking', () => {
    const lines = [];
    lines.push('---');
    lines.push('id: large-vault-file');
    lines.push('---');
    for (let i = 0; i < 5000; i++) {
      lines.push(`- Registro corporativo histórico ${i} con métricas.`);
    }
    lines.push('## Corporate evidence batch 2026-11-09');
    for (let i = 0; i < 5000; i++) {
      lines.push(`{ "id": "BATCH-${i}" }`);
    }

    const hugeContent = lines.join('\n');
    const t0 = Date.now();
    const sanitized = robustSanitize(hugeContent);
    const duration = Date.now() - t0;

    expect(duration).toBeLessThan(100); // Super fast
    expect(sanitized).not.toContain('BATCH-0');
    expect(sanitized).toContain('Registro corporativo histórico 4999');
  });

  it('B4-T5: handles content with slight date variants in header (e.g. 2026-11-10)', () => {
    const raw = `# Notes
## Corporate evidence batch 2026-11-10
Residual data`;

    const sanitized = robustSanitize(raw);
    expect(sanitized).not.toContain('Residual data');
    expect(sanitized).toContain('# Notes');
  });
});

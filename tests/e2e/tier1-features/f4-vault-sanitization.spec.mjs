import { describe, it, expect } from '../harness/test-framework.mjs';
import { KNOWN_13_RESIDUAL_FILES } from '../helpers/vault-helpers.mjs';
import { parseMarkdownContent } from '../helpers/vault-helpers.mjs';

function sanitizeVaultFileContent(rawContent) {
  const batchMarker = '## Corporate evidence batch 2026-11-09';
  const idx = rawContent.indexOf(batchMarker);
  if (idx === -1) return rawContent;
  return rawContent.slice(0, idx).trimEnd() + '\n';
}

describe('Tier 1 — Feature 4: Vault File Sanitization', () => {
  it('F4-T1: verifies all 13 targeted residual vault files are enumerated and mapped', () => {
    expect(KNOWN_13_RESIDUAL_FILES.length).toBe(13);
    for (const relPath of KNOWN_13_RESIDUAL_FILES) {
      expect(relPath.endsWith('.md')).toBe(true);
      expect(relPath.startsWith('01-Internal-Clients')).toBe(true);
    }
  });

  it('F4-T2: verifies sanitization truncates at batch header and removes trailing JSON dumps', () => {
    const rawSample = `---
id: sample-core
title: "Sample Core"
---

## Resumen Ejecutivo
Texto ejecutivo legítimo.

## Corporate evidence batch 2026-11-09
Source package: C:\\dummy\\path
{
  "id": "STR-REL-001",
  "origin": "smj"
}

## Visual sources associated 2026-11-09
Trailing metadata.
`;
    const sanitized = sanitizeVaultFileContent(rawSample);
    expect(sanitized).not.toContain('## Corporate evidence batch 2026-11-09');
    expect(sanitized).not.toContain('STR-REL-001');
    expect(sanitized).not.toContain('## Visual sources associated 2026-11-09');
    expect(sanitized).toContain('## Resumen Ejecutivo');
    expect(sanitized).toContain('Texto ejecutivo legítimo.');
  });

  it('F4-T3: verifies YAML frontmatter remains valid after truncation', () => {
    const rawSample = `---
id: person-test
title: "Test Leader"
type: person
---

# Test Leader
Notas de trabajo.

## Corporate evidence batch 2026-11-09
{ "id": "STR-REL-999" }
`;
    const sanitized = sanitizeVaultFileContent(rawSample);
    const parsed = parseMarkdownContent(sanitized);
    expect(parsed.frontmatter.id).toBe('person-test');
    expect(parsed.frontmatter.type).toBe('person');
    expect(parsed.frontmatter.__error).toBeUndefined();
  });

  it('F4-T4: preserves files that do not contain the residual batch without modification', () => {
    const cleanSample = `---
id: clean-node
title: "Clean Node"
---
# Clean Node
Legitimate executive summary without batch headers.
`;
    const sanitized = sanitizeVaultFileContent(cleanSample);
    expect(sanitized).toBe(cleanSample);
  });

  it('F4-T5: sanitizes multi-line JSON blocks with nested source_references arrays', () => {
    const complexSample = `---
id: complex-org
---
Texto ejecutivo.

## Corporate evidence batch 2026-11-09
{
  "id": "STR-REL-004",
  "source_references": [
    {
      "id": "PUB-01",
      "location": "https://example.com"
    }
  ]
}
`;
    const sanitized = sanitizeVaultFileContent(complexSample);
    expect(sanitized).not.toContain('source_references');
    expect(sanitized).not.toContain('PUB-01');
    expect(sanitized).toContain('Texto ejecutivo.');
  });
});

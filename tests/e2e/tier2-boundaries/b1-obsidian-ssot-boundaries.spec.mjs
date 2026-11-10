import { describe, it, expect } from '../harness/test-framework.mjs';
import { parseMarkdownContent } from '../helpers/vault-helpers.mjs';

describe('Tier 2 — Boundary 1: Obsidian SSOT Edge Cases', () => {
  it('B1-T1: handles completely empty (0-byte) markdown file without crashing', () => {
    const parsed = parseMarkdownContent('');
    expect(parsed.body).toBe('');
    expect(Object.keys(parsed.frontmatter).length).toBe(0);
    expect(parsed.wikilinks.length).toBe(0);
  });

  it('B1-T2: handles file with frontmatter but empty body', () => {
    const raw = `---
id: empty-body-node
title: "No Body"
---
`;
    const parsed = parseMarkdownContent(raw);
    expect(parsed.frontmatter.id).toBe('empty-body-node');
    expect(parsed.body.trim()).toBe('');
  });

  it('B1-T3: handles file with markdown body but missing frontmatter delimiters', () => {
    const raw = `# Heading
This file has no YAML delimiters at all.
[[Wikilink 1]]`;
    const parsed = parseMarkdownContent(raw);
    expect(Object.keys(parsed.frontmatter).length).toBe(0);
    expect(parsed.body).toContain('# Heading');
    expect(parsed.wikilinks.length).toBe(1);
    expect(parsed.wikilinks[0].target).toBe('Wikilink 1');
  });

  it('B1-T4: traps syntax errors in malformed YAML frontmatter gracefully', () => {
    const malformed = `---
id: invalid: yaml: syntax: [unclosed
title: "Broken
---
# Content`;
    const parsed = parseMarkdownContent(malformed);
    expect(parsed.frontmatter.__error).toBeDefined();
    expect(parsed.body).toContain('# Content');
  });

  it('B1-T5: handles special characters, accents, and ampersands in titles and bodies', () => {
    const special = `---
id: core-smj-trinidad
title: "S.M. Jaleel & Co. Ltd. — Operación & Expansión (Caribeña)"
country: "Trinidad & Tobago"
---
# S.M. Jaleel & Co. Ltd.
Relación con [[Distributor - MEDIMEX & CIA.]] y [[Person - Raúl González Gómez]].
`;
    const parsed = parseMarkdownContent(special);
    expect(parsed.frontmatter.country).toBe('Trinidad & Tobago');
    expect(parsed.wikilinks.length).toBe(2);
    expect(parsed.wikilinks[0].target).toBe('Distributor - MEDIMEX & CIA.');
    expect(parsed.wikilinks[1].target).toBe('Person - Raúl González Gómez');
  });
});

import { describe, it, expect } from '../harness/test-framework.mjs';
import { getAllVaultFiles, parseMarkdownContent, resolveVaultPath } from '../helpers/vault-helpers.mjs';
import fs from 'fs';

describe('Tier 1 — Feature 1: Strict Obsidian SSOT Preservation', () => {
  it('F1-T1: verifies vault files use pure Markdown format without proprietary databases', () => {
    const vaultDir = resolveVaultPath();
    expect(fs.existsSync(vaultDir)).toBeTruthy();
    const files = getAllVaultFiles(vaultDir);
    expect(files.length).toBeGreaterThan(450);
    const nonMdFiles = files.filter(f => !f.endsWith('.md'));
    expect(nonMdFiles.length).toBe(0);
  });

  it('F1-T2: verifies frontmatter and markdown body are cleanly separated by YAML delimiters', () => {
    const sample = `---
id: test-node-01
title: "Test Corporate Node"
type: department
memory_tier: long_term
---

# Test Corporate Node
Body executive text here.
`;
    const parsed = parseMarkdownContent(sample);
    expect(parsed.frontmatter.id).toBe('test-node-01');
    expect(parsed.frontmatter.type).toBe('department');
    expect(parsed.body).toContain('# Test Corporate Node');
    expect(parsed.body).not.toContain('id: test-node-01');
  });

  it('F1-T3: verifies wikilinks are extracted from pure markdown text', () => {
    const sample = `---
title: "Sample with Links"
---
Refers to [[Core - S.M. Jaleel & Co. Ltd.]] and also [[Distributor - MEDIMEX|Medimex Distribuidora]].
`;
    const parsed = parseMarkdownContent(sample);
    expect(parsed.wikilinks.length).toBe(2);
    expect(parsed.wikilinks[0].target).toBe('Core - S.M. Jaleel & Co. Ltd.');
    expect(parsed.wikilinks[0].alias).toBe('Core - S.M. Jaleel & Co. Ltd.');
    expect(parsed.wikilinks[1].target).toBe('Distributor - MEDIMEX');
    expect(parsed.wikilinks[1].alias).toBe('Medimex Distribuidora');
  });

  it('F1-T4: verifies vault preserves nested organizational folders without SQL tables', () => {
    const vaultDir = resolveVaultPath();
    const subdirs = fs.readdirSync(vaultDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    expect(subdirs).toContain('01-Internal-Clients');
    expect(subdirs).toContain('02-External-Clients');
  });

  it('F1-T5: verifies parsed frontmatter supports arbitrary structured key-values', () => {
    const sample = `---
id: node-telemetry
status: active
metrics:
  capacity: 85.5
  currency: "USD"
tags:
  - corporate
  - verified
---
Body text.
`;
    const parsed = parseMarkdownContent(sample);
    expect(parsed.frontmatter.metrics.capacity).toBe(85.5);
    expect(parsed.frontmatter.metrics.currency).toBe('USD');
    expect(parsed.frontmatter.tags).toContain('corporate');
    expect(parsed.frontmatter.tags).toContain('verified');
  });
});

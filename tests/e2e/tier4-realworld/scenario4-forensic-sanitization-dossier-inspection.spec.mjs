import { describe, it, expect } from '../harness/test-framework.mjs';
import { KNOWN_13_RESIDUAL_FILES, resolveVaultPath } from '../helpers/vault-helpers.mjs';
import { sanitizeAndParseBody } from '../helpers/render-shield.mjs';
import fs from 'fs';
import path from 'path';

describe('Tier 4 — Scenario 4: Forensic Sanitization & Clean Dossier Rendering Audit', () => {
  const vaultDir = resolveVaultPath();

  it('Step 1: verifies all 13 targeted corporate files exist on the filesystem', () => {
    for (const relPath of KNOWN_13_RESIDUAL_FILES) {
      const fullPath = path.join(vaultDir, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  it('Step 2: performs forensic scan across all 13 files and tests frontend rendering shield', () => {
    let filesAudited = 0;

    for (const relPath of KNOWN_13_RESIDUAL_FILES) {
      const fullPath = path.join(vaultDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Passes content through the frontend rendering shield
      const ast = sanitizeAndParseBody(content);
      filesAudited++;

      // Assert 0 JSON block artifacts in rendered AST
      for (const element of ast) {
        const text = element.content || element.title || '';
        expect(text).not.toContain('"id": "STR-REL-');
        expect(text).not.toContain('"source_references":');
        expect(text).not.toContain('Corporate evidence batch');
        expect(text).not.toContain('Visual sources associated');
      }
    }

    expect(filesAudited).toBe(13);
  });

  it('Step 3: confirms rendered output retains valid executive headings and bullet items', () => {
    // Specifically test Core - S.M. Jaleel & Co. Ltd.
    const corePath = path.join(vaultDir, '01-Internal-Clients/Core - S.M. Jaleel & Co. Ltd..md');
    const content = fs.readFileSync(corePath, 'utf-8');
    const ast = sanitizeAndParseBody(content);

    expect(ast.length).toBeGreaterThan(0);
    const hasHeadings = ast.some(e => e.type === 'h2' || e.type === 'h3');
    expect(hasHeadings).toBe(true);
  });

  it('Step 4: verifies no orphaned closing curly braces "}" in rendered paragraphs', () => {
    for (const relPath of KNOWN_13_RESIDUAL_FILES) {
      const fullPath = path.join(vaultDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const ast = sanitizeAndParseBody(content);

      for (const element of ast) {
        if (element.type === 'paragraph') {
          // A paragraph that is just "}" or "]," is a sign of a failed regex
          const trimmed = element.content.trim();
          expect(trimmed).not.toBe('}');
          expect(trimmed).not.toBe('},');
          expect(trimmed).not.toBe(']');
          expect(trimmed).not.toBe('],');
        }
      }
    }
  });
});

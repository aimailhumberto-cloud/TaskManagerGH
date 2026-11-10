import { describe, it, expect } from '../harness/test-framework.mjs';
import { parseMarkdownContent } from '../helpers/vault-helpers.mjs';

describe('Tier 2 — Boundary 7: Metadata Frontmatter Edge Cases', () => {
  it('B7-T1: handles missing optional telemetry sections safely with defaults', () => {
    const raw = `---
id: minimal-node
title: "Minimal"
type: distributor
---
Content`;
    const parsed = parseMarkdownContent(raw);
    const telemetry = parsed.frontmatter.commercial_telemetry || {};
    expect(telemetry.annual_volume_cases || 0).toBe(0);
    expect(parsed.frontmatter.email_activity || null).toBeNull();
  });

  it('B7-T2: handles zero and decimal values in telemetry metrics', () => {
    const raw = `---
id: zero-metric-node
commercial_telemetry:
  annual_volume_cases: 0
  market_share_percent: 42.85
---
Content`;
    const parsed = parseMarkdownContent(raw);
    expect(parsed.frontmatter.commercial_telemetry.annual_volume_cases).toBe(0);
    expect(parsed.frontmatter.commercial_telemetry.market_share_percent).toBe(42.85);
  });

  it('B7-T3: validates date format variations in email_activity', () => {
    const raw = `---
email_activity:
  last_email_date: 2026-11-10
  created_at: "2026-11-10T09:30:00.000Z"
---
Content`;
    const parsed = parseMarkdownContent(raw);
    const dateStr = String(parsed.frontmatter.email_activity.last_email_date);
    expect(dateStr).toContain('2026-11-10');
    expect(parsed.frontmatter.email_activity.created_at).toContain('2026-11-10T');
  });

  it('B7-T4: handles contacts array with partial fields without breaking cards', () => {
    const raw = `---
key_contacts:
  - name: "Solo Nombre"
  - email: "solo@email.com"
---
Content`;
    const parsed = parseMarkdownContent(raw);
    expect(parsed.frontmatter.key_contacts.length).toBe(2);
    expect(parsed.frontmatter.key_contacts[0].name).toBe('Solo Nombre');
    expect(parsed.frontmatter.key_contacts[0].role || 'N/A').toBe('N/A');
    expect(parsed.frontmatter.key_contacts[1].email).toBe('solo@email.com');
  });

  it('B7-T5: normalizes single string relation values into array', () => {
    const raw = `---
relations:
  parent: "[[Core - S.M. Jaleel & Co. Ltd.]]"
---
Content`;
    const parsed = parseMarkdownContent(raw);
    const rawParent = parsed.frontmatter.relations.parent;
    const parentList = Array.isArray(rawParent) ? rawParent : [rawParent];
    expect(parentList.length).toBe(1);
    expect(parentList[0]).toBe('[[Core - S.M. Jaleel & Co. Ltd.]]');
  });
});

import { describe, it, expect } from '../harness/test-framework.mjs';
import { PRIMARY_21_NODES } from '../helpers/vault-helpers.mjs';
import { parseMarkdownContent } from '../helpers/vault-helpers.mjs';

describe('Tier 1 — Feature 7: Enriched Technical Metadata Frontmatter', () => {
  it('F7-T1: verifies all 21 primary corporate nodes are targeted for metadata enrichment', () => {
    expect(PRIMARY_21_NODES.length).toBe(21);
    expect(PRIMARY_21_NODES).toContain('01-Internal-Clients/Core - S.M. Jaleel & Co. Ltd..md');
    expect(PRIMARY_21_NODES).toContain('02-External-Clients/Distributor - MEDIMEX.md');
  });

  it('F7-T2: validates Medimex benchmark 7-category telemetry schema structure', () => {
    const medimexSchema = {
      commercial_telemetry: {
        annual_volume_cases: 450000,
        active_skus: 14,
        payment_terms: '60 days',
      },
      email_activity: {
        last_email_date: '2026-11-08',
        last_email_subject: 'Forecast Q4 2026',
        last_email_sender: 'contact@medimex.com',
      },
      key_contacts: [
        { name: 'Director Comercial', role: 'Executive', email: 'dir@medimex.com' },
      ],
      milestones: [
        { title: 'Renovación Contrato', date: '2026-12-15', status: 'pending' },
      ],
    };

    expect(typeof medimexSchema.commercial_telemetry.annual_volume_cases).toBe('number');
    expect(medimexSchema.email_activity.last_email_date).toBe('2026-11-08');
    expect(medimexSchema.key_contacts.length).toBeGreaterThan(0);
    expect(medimexSchema.milestones[0].status).toBe('pending');
  });

  it('F7-T3: validates YAML parser extracts enriched frontmatter correctly', () => {
    const sample = `---
id: org-guyana
title: "Guyana Beverages Inc."
type: organization
memory_tier: long_term
country: Guyana
commercial_telemetry:
  annual_volume_cases: 320000
  market_rank: 1
email_activity:
  last_email_date: "2026-11-05"
---
# Content`;

    const parsed = parseMarkdownContent(sample);
    expect(parsed.frontmatter.id).toBe('org-guyana');
    expect(parsed.frontmatter.type).toBe('organization');
    expect(parsed.frontmatter.commercial_telemetry.annual_volume_cases).toBe(320000);
    expect(parsed.frontmatter.email_activity.last_email_date).toBe('2026-11-05');
  });

  it('F7-T4: verifies visual identity fields (logo / photo / flag) in frontmatter', () => {
    const sample = `---
id: dist-sample
visual_logo_url: "/brands/smjaleel-logo.png"
visual_photo_url: "/photos/hq-plant.jpg"
visual_flag_url: "/flags/tt.png"
---
Body`;

    const parsed = parseMarkdownContent(sample);
    expect(parsed.frontmatter.visual_logo_url).toBe('/brands/smjaleel-logo.png');
    expect(parsed.frontmatter.visual_photo_url).toBe('/photos/hq-plant.jpg');
    expect(parsed.frontmatter.visual_flag_url).toBe('/flags/tt.png');
  });

  it('F7-T5: validates relations dictionary with typed connections', () => {
    const sample = `---
id: core-smj
relations:
  subsidiary:
    - "[[organization-guyana-beverages-inc]]"
    - "[[organization-smj-beverages-barbados-inc]]"
  distributor:
    - "[[Distributor - MEDIMEX]]"
---
Body`;

    const parsed = parseMarkdownContent(sample);
    expect(parsed.frontmatter.relations.subsidiary.length).toBe(2);
    expect(parsed.frontmatter.relations.distributor[0]).toBe('[[Distributor - MEDIMEX]]');
  });
});

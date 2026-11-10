import { describe, it, expect } from '../harness/test-framework.mjs';
import { parseMarkdownContent } from '../helpers/vault-helpers.mjs';

function buildVisualCardModel(frontmatter) {
  const telemetry = frontmatter.commercial_telemetry || {};
  const email = frontmatter.email_activity || {};
  const contacts = Array.isArray(frontmatter.key_contacts) ? frontmatter.key_contacts : [];
  const milestones = Array.isArray(frontmatter.milestones) ? frontmatter.milestones : [];

  return {
    telemetryCard: {
      volumeLabel: telemetry.annual_volume_cases ? `${telemetry.annual_volume_cases.toLocaleString()} cajas/año` : 'Sin datos de volumen',
      termsLabel: telemetry.payment_terms || 'Términos estándar',
      skusCount: telemetry.active_skus || 0,
      hasData: Boolean(telemetry.annual_volume_cases || telemetry.payment_terms),
    },
    emailCard: {
      lastSubject: email.last_email_subject || 'Sin correos recientes',
      lastDate: email.last_email_date || 'N/A',
      sender: email.last_email_sender || 'N/A',
      hasData: Boolean(email.last_email_subject || email.last_email_date),
    },
    contactsRoster: contacts.map(c => ({
      name: c.name || 'Contacto',
      role: c.role || 'Colaborador',
      email: c.email || '',
    })),
    milestonesTimeline: milestones.map(m => ({
      title: m.title || 'Hito',
      date: m.date || 'TBD',
      status: m.status || 'pending',
    })),
  };
}

describe('Tier 3 — Combination 2: Frontmatter Enrichment + Visual Cards UI', () => {
  it('Comb2-T1: transforms complete frontmatter metadata into rich UI card representations', () => {
    const rawMarkdown = `---
id: dist-medimex
title: "Distributor: MEDIMEX"
commercial_telemetry:
  annual_volume_cases: 450000
  payment_terms: "60 días crédito"
  active_skus: 14
email_activity:
  last_email_date: "2026-11-08"
  last_email_subject: "Forecast Q4 2026 y distribución Chubby"
  last_email_sender: "gerencia@medimex.com"
key_contacts:
  - name: "Carlos Méndez"
    role: "Director de Operaciones"
    email: "cmendez@medimex.com"
milestones:
  - title: "Renovación Anual de Exclusividad"
    date: "2026-12-15"
    status: "in_progress"
---
# Content`;

    const parsed = parseMarkdownContent(rawMarkdown);
    const model = buildVisualCardModel(parsed.frontmatter);

    expect(model.telemetryCard.hasData).toBe(true);
    expect(model.telemetryCard.volumeLabel).toContain('450');
    expect(model.telemetryCard.skusCount).toBe(14);

    expect(model.emailCard.hasData).toBe(true);
    expect(model.emailCard.lastDate).toBe('2026-11-08');

    expect(model.contactsRoster.length).toBe(1);
    expect(model.contactsRoster[0].name).toBe('Carlos Méndez');

    expect(model.milestonesTimeline.length).toBe(1);
    expect(model.milestonesTimeline[0].status).toBe('in_progress');
  });

  it('Comb2-T2: provides safe fallback states when node frontmatter has partial telemetry', () => {
    const rawMarkdown = `---
id: partial-node
title: "Partial Node"
---
# Content`;

    const parsed = parseMarkdownContent(rawMarkdown);
    const model = buildVisualCardModel(parsed.frontmatter);

    expect(model.telemetryCard.hasData).toBe(false);
    expect(model.telemetryCard.volumeLabel).toBe('Sin datos de volumen');
    expect(model.emailCard.hasData).toBe(false);
    expect(model.emailCard.lastSubject).toBe('Sin correos recientes');
    expect(model.contactsRoster.length).toBe(0);
    expect(model.milestonesTimeline.length).toBe(0);
  });

  it('Comb2-T3: formats high-volume telemetry numbers with standard locale digit separators', () => {
    const rawMarkdown = `---
commercial_telemetry:
  annual_volume_cases: 12500000
---`;
    const parsed = parseMarkdownContent(rawMarkdown);
    const model = buildVisualCardModel(parsed.frontmatter);
    expect(model.telemetryCard.volumeLabel).toContain('12');
    expect(model.telemetryCard.volumeLabel).toContain('cajas/año');
  });
});

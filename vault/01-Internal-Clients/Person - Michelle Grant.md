---
id: person-michelle-grant
title: "Person: Michelle Grant"
type: person
memory_tier: long_term
email_primary: "michelle.grant@smjpm.com"
job_title: "Finance & Operations Manager"
organization: "SMJ Procurement & Marketing Inc."
source: "Recopilacion SMJ v4 2026-11-09; SHA256 dfc0978685ded763e057e7f407a9b8b17dc95b20309e2093002490ba72b022e8; insumos/carga-inicial-2026-11-09/SM_Jaleel_recopilacion_2026-11-09.md"
verification_status: source_observed_fields_only
tags:
  - smj
  - contacto-documentado
relations:
  signature_company:
    - "organization-smj-procurement-marketing-inc"
  based_in:
    - "country-barbados"
  handles_payments_to_HB:
    - "person-humberto-bouche"
---

# Michelle Grant

## Observaciones y contexto
Sales Reports, 2026-11-09 10:59, firma Michelle A Grant. Remitio Excel ventas USA; lectura de adjunto no incluida en fuente v4.

## Fuente
Recopilacion SMJ v4 2026-11-09; SHA256 dfc0978685ded763e057e7f407a9b8b17dc95b20309e2093002490ba72b022e8; insumos/carga-inicial-2026-11-09/SM_Jaleel_recopilacion_2026-11-09.md
Solo datos explicitamente transcritos; campos vacios desconocidos. Ubicacion fisica de ficha no determina relacion interna/externa. No autoriza contacto ni crea tarea.

## Corporate evidence batch 2026-11-09
Source package: C:\Users\Usuario\Documents\SM Jaleel\outputs\SMJ_Corporate_Structure_2026-11-09
No legal ownership percentages, current factory function, or HB employer inferred.

{
  "id": "STR-REL-111",
  "origin": "person:michelle-a-grant",
  "destination": "organization:smj-procurement-marketing-inc",
  "relation_type": "signature_company",
  "entity_context": "organization:smj-procurement-marketing-inc",
  "country_context": null,
  "evidence_class": "recorded_internal_email_fact",
  "temporal_scope": "observed_2026-11-09",
  "valid_from": null,
  "valid_to": null,
  "consulted_date": "2026-11-09",
  "source_ids": [
    "MAIL-MICHELLE"
  ],
  "source_references": [
    {
      "id": "MAIL-MICHELLE",
      "location": "C:\\Users\\Usuario\\Downloads\\SMJaleel\\insumos\\carga-inicial-2026-11-09\\SM_Jaleel_recopilacion_2026-11-09.md"
    }
  ],
  "notes": "Email signature establishes observed professional affiliation, not employment contract or reporting line.",
  "proposed_action": "append_evidence_after_identity_match",
  "reused_relation_id": null
}

{
  "id": "STR-REL-115",
  "origin": "person:michelle-a-grant",
  "destination": "country:barbados",
  "relation_type": "based_in",
  "entity_context": null,
  "country_context": "Barbados",
  "evidence_class": "HB_statement",
  "temporal_scope": "observed_2026-11-09",
  "valid_from": null,
  "valid_to": null,
  "consulted_date": "2026-11-09",
  "source_ids": [
    "HB-STRUCTURE"
  ],
  "source_references": [
    {
      "id": "HB-STRUCTURE",
      "location": "Parent delegation transcript_evidence"
    }
  ],
  "notes": "Direct statement from HB; no office street address confirmed.",
  "proposed_action": "append_evidence_after_identity_match",
  "reused_relation_id": null
}

{
  "id": "STR-REL-116",
  "origin": "person:michelle-a-grant",
  "destination": "person:humberto-bouche",
  "relation_type": "handles_payments_to_HB",
  "entity_context": null,
  "country_context": "Barbados",
  "evidence_class": "HB_statement",
  "temporal_scope": "observed_2026-11-09",
  "valid_from": null,
  "valid_to": null,
  "consulted_date": "2026-11-09",
  "source_ids": [
    "HB-STRUCTURE"
  ],
  "source_references": [
    {
      "id": "HB-STRUCTURE",
      "location": "Parent delegation transcript_evidence"
    }
  ],
  "notes": "HB says Michelle is the person who pays him; payer legal entity and employment arrangement unknown.",
  "proposed_action": "append_evidence_after_identity_match",
  "reused_relation_id": null
}

---
id: market-us-new-york
title: "Market: US - New York"
type: market
memory_tier: long_term
status: active
hierarchy_level: 4
country_name: United States
iso_code: US
geographic_level: distribution_zone
display_name_es: Nueva York
source: HB, ChatGPT, mensaje Sentinel_8811b39fd2748191964023c195835e68, 2026-11-09
evidence_status: confirmed_by_hb
confirmed_at: 2026-11-09
distributor_assignment_status: pending_confirmation
relations:
  belongs_to_market:
    - "[[Market - United States]]"
  part_of:
    - "[[Market - United States]]"
updated_at: 2026-11-09T22:42:24.346Z
us_distribution_evidence_20261110:
  source: 'HB direct statement relayed by coordinator thread 01a1a96c-b06e-72d9-b51f-9e78a98ac0ea on 2026-11-10:
    Walton and Post corresponds to United States; New York has two distributors; Miami has two geographic parts
    and one distributor. Original US regional files still require identification; no exact company/part names supplied
    in this statement.'
  source_date: '2026-11-10'
  evidence_class: direct_HB_confirmation
  country_market_id: market-united-states
  country_distributor_confirmed_id: dist-walton-and-post
  new_york_market_id: market-us-new-york
  new_york_distributor_count_confirmed: 2
  new_york_distributor_ids: null
  miami_market_id: market-us-miami
  miami_geographic_part_count_confirmed: 2
  miami_geographic_part_names: null
  miami_distributor_count_confirmed: 1
  miami_distributor_id: null
  regional_assignments_status: identity_and_exact_coverage_pending_original_documents
  country_level_walton_not_inferred_as_regional_assignment: true
  exclusivity_inferred: false
  current_product_range_inferred: false
  internal_followup:
    date: '2026-11-11'
    timezone: America/Panama
    status: planned
    kind: internal_evidence_review_not_commercial_deadline
    reason: Locate original US regional distribution source; resolve exact companies and geographic parts before
      adding links
---

# Market: US - New York

Zona comercial declarada por HB. Una de las dos zonas de distribución mencionadas para Estados Unidos.

## Alcance y datos pendientes
No representa una empresa distribuidora. La razón social, responsables, cobertura exacta y clientes quedan pendientes de confirmación; no se asignan por inferencia. La mención de Target fue hipotética y no se incorpora como cliente.

## Fuente
HB, ChatGPT, mensaje Sentinel_8811b39fd2748191964023c195835e68, 2026-11-09


## USA distribution evidence register - HB clarification, 2026-11-10

HB direct statement relayed by coordinator thread 01a1a96c-b06e-72d9-b51f-9e78a98ac0ea on 2026-11-10: Walton and Post corresponds to United States; New York has two distributors; Miami has two geographic parts and one distributor. Original US regional files still require identification; no exact company/part names supplied in this statement.

| Scope | Confirmed by HB | Identity / coverage evidence still needed |
| --- | --- | --- |
| United States | Walton and Post; existing country relationship retained | No exclusivity or all-region coverage follows from this confirmation |
| New York region | Two distributors | Both legal/company identities, source date and territorial scope remain unknown |
| Miami region | Two geographic parts, one distributor | Exact part names/boundaries and distributor identity remain unknown |

Existing geography IDs: market-united-states, market-us-new-york and market-us-miami. Existing country distributor ID: dist-walton-and-post. No regional distributor or subdivision is created from an unknown name. Florida/Tampa/Miami relationships already present remain intact; the two Miami parts are not assumed to mean Florida and Tampa. A headquarters in Miami does not independently assign Walton to this region.

Evidence search on 2026-11-10: reviewed existing market/distributor fiches and available local targets/SanCas workbooks; no original US regional distributor/territory rows identified. Available connected OneDrive is personal, not corporate; narrow metadata searches and Library original-document searches supplied no relevant original. Unrelated results were not opened. Await the corporate file location or an authorized source extraction. Historical shipments, targets and inherited narrative do not prove current assortment or exclusivity.

Presentation audit: Costa Rica, El Salvador, Jamaica, Barbados, Guyana, Saint Lucia, South Africa and Suriname currently display Walton in the deployed country card without graph support. New York and Miami also display an unsupported regional default. Those defaults are not evidence and are not imported as relations. Application correction remains pending for the map/Antigravity owner.

Internal evidence review: 2026-11-11, America/Panama; not a commercial deadline and not a new duplicate task.

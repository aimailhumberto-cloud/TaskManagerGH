/**
 * Tipos y esquemas canónicos del Contrato v1 de Supervisión (Lumen AGI)
 * Referencia: CONTRACT_V1.md y ROADMAP_INTEGRACION.md
 * 
 * Reglas estrictas:
 * - Clasificación: private_fixture
 * - fixture_only: true
 * - proposal: true
 * - Sin credenciales, sin rutas de vault, sin servidores externos.
 */

export type V1Kind =
  | 'asset'
  | 'relationship'
  | 'document'
  | 'task'
  | 'flow'
  | 'evidence'
  | 'incident';

export type V1RegistrationState = 'proposed' | 'inventoried';
export type V1ConnectionState = 'connected' | 'not_connected' | 'pending' | 'unknown';
export type V1VerificationState = 'verified' | 'not_verified';
export type V1FreshnessState = 'fresh' | 'stale' | 'unknown';
export type V1WorkState =
  | 'active'
  | 'waiting_third_party'
  | 'hb_decision'
  | 'blocked'
  | 'completed_delivered'
  | 'cancelled'
  | 'unknown';

export interface V1States {
  registration: V1RegistrationState;
  connection: V1ConnectionState;
  verification: V1VerificationState;
  freshness: V1FreshnessState;
  work: V1WorkState;
}

export type V1RelationshipType =
  | 'belongs_to'
  | 'depends_on'
  | 'produces'
  | 'documents'
  | 'publishes_in'
  | 'monitors';

export type V1RelationshipCondition = 'declared' | 'proposed' | 'verified';

export type V1TaskOutcome = 'verified_fixture' | 'uncertain' | 'failed' | 'unknown';

export interface V1RunRecord {
  id: string;
  entity_id: string;
  evidence_id: string;
  expected: number;
  actual: number;
  unit: string;
  status: 'succeeded' | 'failed' | 'running';
  result: string;
  completed_at: string;
}

export interface V1ContinuityTaskData {
  entity_id: string;
  name: string;
  health: 'healthy' | 'volume_mismatch' | 'degraded' | 'failed';
  freshness_seconds: number;
  linear_state: string;
  real_verified: false;
  last_run: V1RunRecord | null;
}

export interface V1ContinuityEvidenceData {
  entity_ref: string;
  observed_at: string;
  received_at: string | null;
  purpose: 'connection' | 'inventory' | 'run' | 'verification';
  real_verified: false;
  runs: V1RunRecord[];
}

export interface V1ContinuityIncidentData {
  entity_ref: string;
  opened_at: string;
  resolved_at: string | null;
  real_verified: false;
}

export interface V1AssetData {
  owner: string | null;
  account_ref: string | null;
  access: string;
  authentication: string;
  last_verified_at: string | null;
}

export interface V1RelationshipData {
  source: string;
  target: string;
  relation: V1RelationshipType;
  evidence_refs: string[];
  condition: V1RelationshipCondition;
}

export interface V1DocumentData {
  source_ref: string;
  captured_at: string;
  hash: string;
  attachments: string[];
  availability: string;
  title: string;
  content: string | null;
  conflict: boolean;
}

export interface V1TaskData {
  obligation: string;
  attempt: number;
  deadline: string | null;
  evidence_refs: string[];
  next_steps: string;
  outcome: V1TaskOutcome;
  result: string | null;
}

export interface V1FlowData {
  dependencies: string[];
  planned: string;
  occurrences: number;
  attempts: number;
  next_steps: string;
}

export interface V1EvidenceData {
  source_ref: string;
  description: string;
}

export interface V1IncidentData {
  reason: string;
  status: 'open' | 'recovered';
  evidence_refs: string[];
  next_steps: string;
}

export type V1ObjectData =
  | V1AssetData
  | V1RelationshipData
  | V1DocumentData
  | V1TaskData
  | V1FlowData
  | V1EvidenceData
  | V1IncidentData;

export interface V1Object<TData = V1ObjectData> {
  id: string;
  business_id: string;
  project_id: string | null;
  kind: V1Kind;
  revision: number;
  classification: 'private_fixture';
  source_refs: string[];
  states: V1States;
  verified_at: string | null;
  data: TData;
  continuity?: V1ContinuityTaskData | V1ContinuityEvidenceData | V1ContinuityIncidentData | null;
  revisions_history?: V1Object<TData>[];
}

export interface V1AdapterStatus {
  enabled: false;
  status: string;
}

export interface V1ContinuityHeader {
  last_check_at: string;
  check_interval_seconds: number;
  entities: number;
  healthy_fixture: number;
  open_incidents: number;
  adapters: {
    dot_wake: V1AdapterStatus;
    obsidian: V1AdapterStatus;
    task_manager: V1AdapterStatus;
  };
}

export interface V1CoverageHeader {
  inventoried: number;
  real_verified: 0;
  expected_total: null;
}

export type V1UpdateStatus = 'periodic_fixture' | 'stale' | 'unknown';
export type V1AgeBasis = 'received_at' | 'observed_at' | null;

export interface V1Envelope {
  api_version: '1.0';
  proposal: true;
  fixture_only: true;
  supervisor_evaluated_at: string;
  last_document_capture_at: string | null;
  last_received_at: string | null;
  last_source_observed_at: string | null;
  last_verified_at: string | null;
  age_basis: V1AgeBasis;
  age_seconds: number;
  update_status: V1UpdateStatus;
  update_label: string;
  coverage: V1CoverageHeader;
  continuity: V1ContinuityHeader;
  objects: V1Object[];
  cursor: string;
}

export type V1ViewName = 'summary' | 'assets' | 'tasks' | 'documents' | 'evidence';

export interface FixtureScope {
  business_ids: string[];
  project_id?: string | null;
  permissions?: {
    document_content?: boolean;
  };
}

// Eventos admitidos por el Contrato v1
export type V1EventType =
  | 'task.changed'
  | 'asset.observed'
  | 'document.revised'
  | 'relationship.changed'
  | 'evidence.added'
  | 'incident.opened'
  | 'incident.recovered'
  | 'freshness.lost';

export interface V1Event {
  id: string;
  type: V1EventType;
  schema_version: '1.0';
  object: V1Object;
  occurred_at: string;
  received_at: string | null;
  correlation_id: string;
  provenance: 'fixture';
}

export type V1ReconciliationStatus =
  | 'duplicate'
  | 'updated'
  | 'archived_past_revision'
  | 'compatibility_warning'
  | 'conflict';

export interface V1ReconcileResult {
  status: V1ReconciliationStatus;
  object?: V1Object;
  archived?: V1Object;
  warning?: string;
}

export interface V1ChangesResponse {
  api_version: '1.0';
  proposal: true;
  fixture_only: true;
  snapshot_required: boolean;
  events: V1Event[];
  cursor: string;
  reason?: string;
}

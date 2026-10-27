import {
  FixtureScope,
  V1Envelope,
  V1Object,
  V1ViewName,
  V1UpdateStatus,
  V1AgeBasis,
  V1DocumentData,
  V1Event,
  V1EventType,
  V1ReconcileResult,
  V1ChangesResponse,
  V1Kind,
} from './types';
import {
  CANONICAL_FIXTURE_OBJECTS,
  CANONICAL_CONTINUITY_HEADER,
  INITIAL_SIMULATED_EVENTS,
} from './fixtures';

const ALLOWED_DATA_FIELDS: Record<V1Kind, Set<string>> = {
  asset: new Set(['owner', 'account_ref', 'access', 'authentication', 'last_verified_at']),
  relationship: new Set(['source', 'target', 'relation', 'evidence_refs', 'condition']),
  document: new Set([
    'source_ref',
    'captured_at',
    'hash',
    'attachments',
    'availability',
    'title',
    'content',
    'conflict',
  ]),
  task: new Set([
    'obligation',
    'attempt',
    'result',
    'deadline',
    'evidence_refs',
    'next_steps',
    'outcome',
  ]),
  flow: new Set(['dependencies', 'planned', 'occurrences', 'attempts', 'next_steps']),
  evidence: new Set(['source_ref', 'description']),
  incident: new Set(['reason', 'status', 'evidence_refs', 'next_steps']),
};

const ALLOWED_EVENT_TYPES = new Set<V1EventType>([
  'task.changed',
  'asset.observed',
  'document.revised',
  'relationship.changed',
  'evidence.added',
  'incident.opened',
  'incident.recovered',
  'freshness.lost',
]);

interface RegisteredCursor {
  cursor: string;
  scope: string[];
  project_id: string | null;
  permissions: { document_content: boolean };
  event_index: number;
  generation: string;
  created_at: string;
}

/**
 * Función que compara exhaustivamente todos los campos relevantes de un objeto v1
 * para deduplicación rigurosa según CONTRACT_V1.md.
 */
function areObjectsIdentical(a: V1Object, b: V1Object): boolean {
  if (a.id !== b.id) return false;
  if (a.business_id !== b.business_id) return false;
  if (a.project_id !== b.project_id) return false;
  if (a.kind !== b.kind) return false;
  if (a.revision !== b.revision) return false;
  if (a.classification !== b.classification) return false;
  if (a.verified_at !== b.verified_at) return false;

  // Comparar source_refs ordenados
  const aRefs = (a.source_refs || []).slice().sort();
  const bRefs = (b.source_refs || []).slice().sort();
  if (aRefs.length !== bRefs.length || !aRefs.every((v, i) => v === bRefs[i])) return false;

  // Comparar 5 dimensiones
  if (JSON.stringify(a.states) !== JSON.stringify(b.states)) return false;

  // Comparar data
  if (JSON.stringify(a.data) !== JSON.stringify(b.data)) return false;

  // Comparar continuity si existe
  if (JSON.stringify(a.continuity || null) !== JSON.stringify(b.continuity || null)) return false;

  return true;
}

function generateOpaqueCursorToken(): string {
  // Token puramente opaco y aleatorio, sin codificar JSON ni contadores globales
  const bytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return 'cur_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Validador estricto de formato de fecha ISO 8601 y rechazo de fechas futuras.
 */
function validateDateString(
  iso: string | null | undefined,
  fieldName: string,
  maxAllowedIso?: string
): string | null {
  if (!iso) return null;
  if (!ISO_DATE_REGEX.test(iso)) {
    throw new Error(
      `Fecha inválida en campo '${fieldName}': '${iso}'. Formato ISO 8601 requerido.`
    );
  }
  const timestamp = Date.parse(iso);
  if (isNaN(timestamp)) {
    throw new Error(
      `Fecha inválida en campo '${fieldName}': '${iso}'. Formato ISO 8601 requerido.`
    );
  }
  const normalized = new Date(timestamp).toISOString();
  if (maxAllowedIso && normalized > maxAllowedIso) {
    throw new Error(
      `Fecha futura rechazada en '${fieldName}': '${normalized}' es posterior al tiempo de evaluación '${maxAllowedIso}'.`
    );
  }
  return normalized;
}

/**
 * Motor de supervisión y proyección v1 (Lumen AGI)
 */
export class SupervisionEngine {
  private objects: V1Object[];
  private events: V1Event[];
  private lastEvaluatedAt: string;
  private readonly generationId: string;
  private registeredCursors: Map<string, RegisteredCursor>;

  constructor(
    initialObjects: V1Object[] = CANONICAL_FIXTURE_OBJECTS,
    initialEvents: V1Event[] = INITIAL_SIMULATED_EVENTS
  ) {
    this.objects = structuredClone(initialObjects);
    this.events = structuredClone(initialEvents);
    this.lastEvaluatedAt = '2026-01-01T12:00:00Z';
    this.generationId = 'gen_' + Math.random().toString(36).substring(2, 10);
    this.registeredCursors = new Map<string, RegisteredCursor>();
  }

  /**
   * Obtiene la instantánea proyectada según el scope, fecha de evaluación y vista.
   */
  public snapshot(
    scope: FixtureScope,
    at: Date | string = new Date(),
    view: V1ViewName = 'summary'
  ): V1Envelope {
    // 1. Validación de scope obligatorio
    if (!scope || !Array.isArray(scope.business_ids) || scope.business_ids.length === 0) {
      throw new Error('Scope obligatorio: se requiere al menos un business_id válido.');
    }

    // 2. Validación de fecha 'at' (formato y no anterior a lastEvaluatedAt)
    const atRaw = typeof at === 'string' ? at : at.toISOString();
    const evaluationIso = validateDateString(atRaw, 'at')!;

    if (evaluationIso < this.lastEvaluatedAt) {
      throw new Error(
        `Lectura obsoleta rechazada: la fecha de evaluación '${evaluationIso}' no puede ser anterior a la última evaluación registrada ('${this.lastEvaluatedAt}').`
      );
    }
    this.lastEvaluatedAt = evaluationIso;

    const businessSet = new Set(scope.business_ids);

    // 3. Filtrado por business_id y project_id
    let scopedObjects = this.objects.filter(obj => {
      if (!businessSet.has(obj.business_id)) return false;
      if (scope.project_id && obj.project_id !== scope.project_id) return false;
      return true;
    });

    // 4. Proyección según la vista solicitada
    if (view === 'tasks') {
      scopedObjects = scopedObjects.filter(o => o.kind === 'task' || o.kind === 'flow');
    } else if (view === 'assets') {
      scopedObjects = scopedObjects.filter(o => o.kind === 'asset' || o.kind === 'relationship');
    } else if (view === 'documents') {
      scopedObjects = scopedObjects.filter(o => o.kind === 'document');
    } else if (view === 'evidence') {
      scopedObjects = scopedObjects.filter(o => o.kind === 'evidence' || o.kind === 'incident');
    }

    // 5. Separación de permisos para contenido de documentos (incluyendo revisions_history)
    const allowDocumentContent = Boolean(scope.permissions?.document_content);
    const projectedObjects = scopedObjects.map(obj => {
      const cloned = structuredClone(obj);

      // Ocultar contenido en objeto principal si no hay permiso
      if (cloned.kind === 'document') {
        const docData = cloned.data as V1DocumentData;
        if (!allowDocumentContent) {
          docData.content = null;
        }
      }

      // Ocultar contenido también en el historial de revisiones históricas
      if (cloned.revisions_history && Array.isArray(cloned.revisions_history)) {
        cloned.revisions_history = cloned.revisions_history.map(hist => {
          const histCloned = structuredClone(hist);
          if (histCloned.kind === 'document' && !allowDocumentContent) {
            (histCloned.data as V1DocumentData).content = null;
          }
          return histCloned;
        });
      }

      // Salvaguarda: resultado incierto jamás completado entregado
      if (cloned.kind === 'task' && (cloned.data as any).outcome === 'uncertain') {
        if (cloned.states.work === 'completed_delivered') {
          cloned.states.work = 'hb_decision';
        }
      }

      return cloned;
    });

    // 6. Separación estricta de fechas: captura, observación, verificación y recepción
    let lastDocumentCaptureAt: string | null = null;
    let lastSourceObservedAt: string | null = null;
    let lastVerifiedAt: string | null = null;
    let lastReceivedAt: string | null = null;

    for (const obj of scopedObjects) {
      // Captura documental
      if (obj.kind === 'document') {
        const doc = obj.data as V1DocumentData;
        const validatedCapture = validateDateString(doc.captured_at, 'captured_at', evaluationIso);
        if (validatedCapture && (!lastDocumentCaptureAt || validatedCapture > lastDocumentCaptureAt)) {
          lastDocumentCaptureAt = validatedCapture;
        }
      }

      // Verificación
      if (obj.verified_at) {
        const validatedVer = validateDateString(obj.verified_at, 'verified_at', evaluationIso);
        if (validatedVer && (!lastVerifiedAt || validatedVer > lastVerifiedAt)) {
          lastVerifiedAt = validatedVer;
        }
      }

      // Observación en origen
      if (obj.continuity && 'observed_at' in obj.continuity && obj.continuity.observed_at) {
        const validatedObs = validateDateString(
          obj.continuity.observed_at,
          'observed_at',
          evaluationIso
        );
        if (validatedObs && (!lastSourceObservedAt || validatedObs > lastSourceObservedAt)) {
          lastSourceObservedAt = validatedObs;
        }
      }
    }

    // Recepción externa (solo en eventos con recepción registrada dentro del scope y proyecto)
    for (const ev of this.events) {
      if (!businessSet.has(ev.object.business_id)) continue;
      if (scope.project_id && ev.object.project_id !== scope.project_id) continue;
      if (ev.received_at) {
        const validatedRec = validateDateString(ev.received_at, 'received_at', evaluationIso);
        if (validatedRec && (!lastReceivedAt || validatedRec > lastReceivedAt)) {
          lastReceivedAt = validatedRec;
        }
      }
    }

    let ageBasis: V1AgeBasis = null;
    let ageSeconds = 0;
    let referenceDateStr: string | null = null;

    if (lastReceivedAt && (!lastSourceObservedAt || lastReceivedAt >= lastSourceObservedAt)) {
      ageBasis = 'received_at';
      referenceDateStr = lastReceivedAt;
    } else if (lastSourceObservedAt) {
      ageBasis = 'observed_at';
      referenceDateStr = lastSourceObservedAt;
    }

    let updateStatus: V1UpdateStatus = 'unknown';
    if (referenceDateStr) {
      const refTime = new Date(referenceDateStr).getTime();
      const evalTime = new Date(evaluationIso).getTime();
      ageSeconds = Math.max(0, Math.floor((evalTime - refTime) / 1000));
      updateStatus = ageSeconds <= 300 ? 'periodic_fixture' : 'stale';
    }

    const openIncidentsCount = scopedObjects.filter(
      o => o.kind === 'incident' && (o.data as any).status === 'open'
    ).length;

    const healthyCount = scopedObjects.filter(
      o => o.kind === 'task' && o.continuity && (o.continuity as any).health === 'healthy'
    ).length;

    // 7. Registro de cursor opaco vinculado a negocio, proyecto y permiso (sin exponer contadores globales)
    const sortedScope = scope.business_ids.slice().sort();
    const cursorToken = generateOpaqueCursorToken();

    this.registeredCursors.set(cursorToken, {
      cursor: cursorToken,
      scope: sortedScope,
      project_id: scope.project_id || null,
      permissions: { document_content: allowDocumentContent },
      event_index: this.events.length,
      generation: this.generationId,
      created_at: evaluationIso,
    });

    const envelope: V1Envelope = {
      api_version: '1.0',
      proposal: true,
      fixture_only: true,
      supervisor_evaluated_at: evaluationIso,
      last_document_capture_at: lastDocumentCaptureAt,
      last_received_at: lastReceivedAt,
      last_source_observed_at: lastSourceObservedAt,
      last_verified_at: lastVerifiedAt,
      age_basis: ageBasis,
      age_seconds: ageSeconds,
      update_status: updateStatus,
      update_label: 'Actualización periódica cada cinco minutos',
      coverage: {
        inventoried: scopedObjects.length,
        real_verified: 0,
        expected_total: null,
      },
      continuity: {
        ...CANONICAL_CONTINUITY_HEADER,
        entities: scopedObjects.filter(o => o.kind === 'task' || o.kind === 'asset').length,
        healthy_fixture: healthyCount,
        open_incidents: openIncidentsCount,
      },
      objects: projectedObjects,
      cursor: cursorToken,
    };

    return envelope;
  }

  /**
   * Consulta incremental con validación estricta de cursores registrados (GET /v1/changes?cursor=...)
   */
  public changes(
    scope: FixtureScope,
    cursor: string,
    at: Date | string = new Date()
  ): V1ChangesResponse {
    if (!scope || !Array.isArray(scope.business_ids) || scope.business_ids.length === 0) {
      throw new Error('Scope obligatorio: se requiere al menos un business_id válido.');
    }

    const atRaw = typeof at === 'string' ? at : at.toISOString();
    const evaluationIso = validateDateString(atRaw, 'at')!;
    if (evaluationIso < this.lastEvaluatedAt) {
      throw new Error(
        `Lectura obsoleta rechazada: la fecha de evaluación '${evaluationIso}' no puede ser anterior a la última evaluación registrada.`
      );
    }
    this.lastEvaluatedAt = evaluationIso;

    // 1. Validar cursor en el registro local
    const registered = this.registeredCursors.get(cursor);
    if (!registered) {
      return {
        api_version: '1.0',
        proposal: true,
        fixture_only: true,
        snapshot_required: true,
        events: [],
        cursor,
        reason: 'snapshot_required: cursor desconocido o no registrado localmente.',
      };
    }

    // 2. Validar que la generación coincida
    if (registered.generation !== this.generationId) {
      return {
        api_version: '1.0',
        proposal: true,
        fixture_only: true,
        snapshot_required: true,
        events: [],
        cursor,
        reason: 'snapshot_required: cursor de otra generación.',
      };
    }

    // 3. Validar alcance de empresas
    const requestedScope = scope.business_ids.slice().sort();
    const regScope = registered.scope.slice().sort();
    if (JSON.stringify(requestedScope) !== JSON.stringify(regScope)) {
      return {
        api_version: '1.0',
        proposal: true,
        fixture_only: true,
        snapshot_required: true,
        events: [],
        cursor,
        reason: 'snapshot_required: empresas del scope no coinciden con las vinculadas al cursor.',
      };
    }

    // 4. Validar project_id
    const requestedProj = scope.project_id || null;
    if (requestedProj !== registered.project_id) {
      return {
        api_version: '1.0',
        proposal: true,
        fixture_only: true,
        snapshot_required: true,
        events: [],
        cursor,
        reason: 'snapshot_required: project_id del scope no coincide con el registrado en el cursor.',
      };
    }

    // 5. Validar permiso documental
    const requestedDocContent = Boolean(scope.permissions?.document_content);
    if (requestedDocContent !== registered.permissions.document_content) {
      return {
        api_version: '1.0',
        proposal: true,
        fixture_only: true,
        snapshot_required: true,
        events: [],
        cursor,
        reason: 'snapshot_required: el permiso document_content difiere del registrado en el cursor.',
      };
    }

    // 6. Validar desbalance > 1000 eventos
    if (
      registered.event_index > this.events.length ||
      this.events.length - registered.event_index > 1000
    ) {
      return {
        api_version: '1.0',
        proposal: true,
        fixture_only: true,
        snapshot_required: true,
        events: [],
        cursor,
        reason: 'snapshot_required: desfase superior a 1000 eventos.',
      };
    }

    const businessSet = new Set(scope.business_ids);
    const allowDocContent = requestedDocContent;

    // 7. Extraer eventos posteriores al cursor para el scope
    const recentEvents = this.events.slice(registered.event_index).filter(ev => {
      if (!businessSet.has(ev.object.business_id)) return false;
      if (scope.project_id && ev.object.project_id !== scope.project_id) return false;
      return true;
    });

    // 8. Ocultación documental en eventos y sus revisions_history
    const projectedEvents = recentEvents.map(ev => {
      const cloned = structuredClone(ev);
      if (cloned.object.kind === 'document' && !allowDocContent) {
        (cloned.object.data as V1DocumentData).content = null;
      }
      if (cloned.object.revisions_history && Array.isArray(cloned.object.revisions_history)) {
        cloned.object.revisions_history = cloned.object.revisions_history.map(hist => {
          const histCloned = structuredClone(hist);
          if (histCloned.kind === 'document' && !allowDocContent) {
            (histCloned.data as V1DocumentData).content = null;
          }
          return histCloned;
        });
      }
      return cloned;
    });

    // 9. Registrar nuevo cursor opaco para la siguiente consulta (sin exponer contadores globales)
    const nextCursorToken = generateOpaqueCursorToken();

    this.registeredCursors.set(nextCursorToken, {
      cursor: nextCursorToken,
      scope: requestedScope,
      project_id: requestedProj,
      permissions: { document_content: allowDocContent },
      event_index: this.events.length,
      generation: this.generationId,
      created_at: evaluationIso,
    });

    return {
      api_version: '1.0',
      proposal: true,
      fixture_only: true,
      snapshot_required: false,
      events: projectedEvents,
      cursor: nextCursorToken,
    };
  }

  /**
   * Reconciliación con comparación exhaustiva de todos los campos relevantes
   * y validación estricta de versiones y fechas.
   */
  public ingestOrReconcile(
    incoming: V1Object,
    eventType: V1EventType = 'task.changed',
    at: Date | string = new Date(),
    schemaVersion: string = '1.0'
  ): V1ReconcileResult {
    // 1. Validación de versión de esquema
    if (schemaVersion !== '1.0') {
      return {
        status: 'compatibility_warning',
        warning: `compatibility_warning: Versión de esquema '${schemaVersion}' no admitida (se requiere '1.0'). No se mutaron los datos.`,
      };
    }

    // 2. Validación de campos no declarados en data
    const allowedFields = ALLOWED_DATA_FIELDS[incoming.kind];
    if (allowedFields && incoming.data) {
      const dataKeys = Object.keys(incoming.data);
      const undeclared = dataKeys.filter(k => !allowedFields.has(k));
      if (undeclared.length > 0) {
        return {
          status: 'compatibility_warning',
          warning: `compatibility_warning: Campos no declarados en data para tipo '${incoming.kind}': ${undeclared.join(', ')}. No se mutaron los datos.`,
        };
      }
    }

    // 3. Validación de tipo de evento
    if (eventType && !ALLOWED_EVENT_TYPES.has(eventType)) {
      return {
        status: 'compatibility_warning',
        warning: `compatibility_warning: Tipo de evento desconocido o incompatible '${eventType}'.`,
      };
    }

    const atRaw = typeof at === 'string' ? at : at.toISOString();
    const evaluationIso = validateDateString(atRaw, 'at')!;

    // 4. Validación de fechas en el objeto entrante (rechazo de fechas futuras)
    if (incoming.verified_at) {
      validateDateString(incoming.verified_at, 'verified_at', evaluationIso);
    }
    if (incoming.kind === 'document') {
      const doc = incoming.data as V1DocumentData;
      if (doc.captured_at) {
        validateDateString(doc.captured_at, 'captured_at', evaluationIso);
      }
    }
    if (incoming.continuity && 'observed_at' in incoming.continuity && incoming.continuity.observed_at) {
      validateDateString(incoming.continuity.observed_at, 'observed_at', evaluationIso);
    }

    const existingIndex = this.objects.findIndex(o => o.id === incoming.id);

    // Si es un objeto nuevo
    if (existingIndex === -1) {
      const newObj = structuredClone(incoming);
      newObj.revisions_history = incoming.revisions_history
        ? structuredClone(incoming.revisions_history)
        : [];
      this.objects.push(newObj);
      this.recordEvent(eventType, newObj, evaluationIso);
      return { status: 'updated', object: newObj };
    }

    const existing = this.objects[existingIndex];

    // Regla de identidad: no puede cambiar de business_id ni de kind
    if (existing.business_id !== incoming.business_id || existing.kind !== incoming.kind) {
      throw new Error(
        `Violación de identidad de objeto: ${incoming.id} no puede cambiar de business_id ('${existing.business_id}' -> '${incoming.business_id}') ni de kind ('${existing.kind}' -> '${incoming.kind}').`
      );
    }

    // 5. Comparación exhaustiva de TODOS los campos relevantes al deduplicar
    if (existing.revision === incoming.revision) {
      if (areObjectsIdentical(existing, incoming)) {
        return { status: 'duplicate', object: existing };
      }
      throw new Error(
        `Conflicto de idempotencia en objeto ${incoming.id}: misma revisión (${incoming.revision}) con campos relevantes divergentes (states, data, verified_at, project_id o source_refs).`
      );
    }

    // Revisión superior: actualiza y archiva la versión anterior en revisions_history
    if (incoming.revision > existing.revision) {
      const historyEntry = structuredClone(existing);
      const existingHistory = existing.revisions_history || [];
      delete historyEntry.revisions_history;

      // Evitar duplicar si la revisión actual de existing ya estuviera en el historial
      const dedupedHistory = existingHistory.filter(h => h.revision !== historyEntry.revision);
      const updatedObj = structuredClone(incoming);
      updatedObj.revisions_history = [...dedupedHistory, historyEntry].sort(
        (a, b) => a.revision - b.revision
      );
      this.objects[existingIndex] = updatedObj;

      this.recordEvent(eventType, updatedObj, evaluationIso);
      return { status: 'updated', object: updatedObj };
    }

    // Revisión antigua: se archiva en el historial pero NO sustituye el objeto actual
    existing.revisions_history = existing.revisions_history || [];

    // Evitar duplicar revisiones antiguas en el historial
    const existingHistIndex = existing.revisions_history.findIndex(
      h => h.revision === incoming.revision
    );
    if (existingHistIndex !== -1) {
      const histEntry = existing.revisions_history[existingHistIndex];
      if (areObjectsIdentical(histEntry, incoming)) {
        return {
          status: 'duplicate',
          object: existing,
          archived: histEntry,
        };
      }
      throw new Error(
        `Conflicto de idempotencia en historial de ${incoming.id}: revisión antigua (${incoming.revision}) con campos divergentes.`
      );
    }

    const archivedEntry = structuredClone(incoming);
    delete archivedEntry.revisions_history;
    existing.revisions_history.push(archivedEntry);
    existing.revisions_history.sort((a, b) => a.revision - b.revision);

    return {
      status: 'archived_past_revision',
      object: existing,
      archived: archivedEntry,
    };
  }

  private recordEvent(type: V1EventType, object: V1Object, occurredAt: string) {
    const event: V1Event = {
      id: 'ev_' + (this.events.length + 1001),
      type,
      schema_version: '1.0',
      object: structuredClone(object),
      occurred_at: occurredAt,
      received_at: null,
      correlation_id: 'corr_' + Math.random().toString(36).substring(2, 10),
      provenance: 'fixture',
    };
    this.events.push(event);
  }

  public recordExternalFixtureEvent(
    type: V1EventType,
    object: V1Object,
    occurredAt: string,
    receivedAt: string
  ): V1Event {
    const occurredIso = validateDateString(occurredAt, 'occurred_at')!;
    const receivedIso = validateDateString(receivedAt, 'received_at')!;
    const event: V1Event = {
      id: 'ev_' + (this.events.length + 1001),
      type,
      schema_version: '1.0',
      object: structuredClone(object),
      occurred_at: occurredIso,
      received_at: receivedIso,
      correlation_id: 'corr_' + Math.random().toString(36).substring(2, 10),
      provenance: 'fixture',
    };
    this.events.push(event);
    return event;
  }

  public getObjects(): V1Object[] {
    return structuredClone(this.objects);
  }

  public getEvents(): V1Event[] {
    return structuredClone(this.events);
  }
}

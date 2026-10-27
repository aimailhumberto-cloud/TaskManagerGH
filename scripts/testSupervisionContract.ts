import assert from 'node:assert/strict';
import { SupervisionEngine } from '../src/lib/supervision/engine';
import type {
  V1Object,
  V1DocumentData,
  V1TaskData,
  V1ReconcileResult,
  V1EventType,
} from '../src/lib/supervision/types';

async function runSupervisionTests() {
  console.log('--- Iniciando suite completa de verificación de Contrato v1 de Supervisión ---');

  const engine = new SupervisionEngine();

  // Test 1: Validación estricta de Scope obligatorio
  console.log('Test 1: Rechazo de scope ausente o vacío...');
  assert.throws(
    () => engine.snapshot({ business_ids: [] }),
    /Scope obligatorio/,
    'Debe rechazar scope con array vacío'
  );
  assert.throws(
    () => engine.snapshot(null as any),
    /Scope obligatorio/,
    'Debe rechazar scope nulo'
  );
  console.log('  ✓ Scope obligatorio validado exitosamente.');

  // Test 2: Validación, separación de fechas y rechazo de fechas inválidas o futuras
  console.log('Test 2: Validación, separación de fechas y rechazo de fechas inválidas o futuras...');
  const fixtureScope = { business_ids: ['fixture-business'] };

  // A. Lectura baseline a las 12:02
  const baselineSnap = engine.snapshot(fixtureScope, '2026-01-01T12:02:00Z', 'summary');
  assert.equal(baselineSnap.supervisor_evaluated_at, '2026-01-01T12:02:00.000Z');
  assert.equal(baselineSnap.age_basis, 'observed_at');
  assert.equal(baselineSnap.age_seconds, 120);
  assert.equal(baselineSnap.update_status, 'periodic_fixture');

  // B. Rechazo de fecha inválida (formato corrupto)
  assert.throws(
    () => engine.snapshot(fixtureScope, 'fecha-no-valida-2026', 'summary'),
    /Fecha inválida en campo 'at'/,
    'Debe rechazar formato de fecha corrupto'
  );

  // C. Rechazo de lectura obsoleta (at < lastEvaluatedAt)
  assert.throws(
    () => engine.snapshot(fixtureScope, '2026-01-01T12:01:00Z', 'summary'),
    /Lectura obsoleta rechazada/,
    'Debe rechazar evaluación con reloj anterior al último ciclo'
  );

  // D. Separación explícita de fechas en SMJ
  const smjScope = { business_ids: ['business-sm-jaleel'] };
  const smjSnap = engine.snapshot(smjScope, '2026-01-01T12:05:00Z', 'summary');
  assert(smjSnap.last_document_capture_at, 'Debe registrar last_document_capture_at');
  assert(smjSnap.last_source_observed_at, 'Debe registrar last_source_observed_at');
  assert(smjSnap.last_verified_at, 'Debe registrar last_verified_at de forma separada');
  assert.equal(smjSnap.last_received_at, null, 'En fixtures sintéticos canónicos last_received_at es null');
  assert.equal(smjSnap.age_basis, 'observed_at');

  // E. Rechazo de fecha futura en objeto entrante
  const futureDoc: V1Object = {
    id: 'fixture:doc:future-test',
    business_id: 'fixture-business',
    project_id: null,
    kind: 'document',
    revision: 1,
    classification: 'private_fixture',
    source_refs: ['fixture:future'],
    states: {
      registration: 'inventoried',
      connection: 'connected',
      verification: 'verified',
      freshness: 'fresh',
      work: 'active',
    },
    verified_at: null,
    data: {
      source_ref: 'fixture:future',
      captured_at: '2026-01-02T00:00:00Z', // Fecha futura respecto a evaluación 2026-01-01T12:05:00Z
      hash: 'sha256-future',
      attachments: [],
      availability: 'local_mirror',
      title: 'Doc Futuro',
      content: 'Contenido futuro',
      conflict: false,
    },
  };
  assert.throws(
    () => engine.ingestOrReconcile(futureDoc, 'document.revised', '2026-01-01T12:05:00Z'),
    /Fecha futura rechazada/,
    'Debe rechazar captura de documento fechada en el futuro respecto a at'
  );
  console.log('  ✓ Validación estricta y separación de las 4 fechas ratificadas.');

  // Test 3: Deduplicación rigurosa comparando TODOS los campos relevantes
  console.log('Test 3: Deduplicación comparando todos los campos relevantes y detección de conflictos...');
  const baseTask: V1Object = {
    id: 'fixture:task:dedup-test',
    business_id: 'fixture-business',
    project_id: 'proj-test',
    kind: 'task',
    revision: 2,
    classification: 'private_fixture',
    source_refs: ['fixture:test-ref-1', 'fixture:test-ref-2'],
    states: {
      registration: 'inventoried',
      connection: 'connected',
      verification: 'verified',
      freshness: 'fresh',
      work: 'active',
    },
    verified_at: '2026-01-01T12:00:00Z',
    data: {
      obligation: 'Tarea deduplicación base',
      attempt: 1,
      deadline: null,
      evidence_refs: [],
      next_steps: 'Paso 1',
      outcome: 'verified_fixture',
      result: 'OK',
    },
    revisions_history: [],
  };

  // Ingestión inicial
  const rInit = engine.ingestOrReconcile(baseTask, 'task.changed', '2026-01-01T12:05:00Z');
  assert.equal(rInit.status, 'updated');

  // Exact duplicate (todos los campos relevantes idénticos)
  const rExactDup = engine.ingestOrReconcile(structuredClone(baseTask), 'task.changed', '2026-01-01T12:05:00Z');
  assert.equal(rExactDup.status, 'duplicate');

  // Fallo de deduplicación: misma revisión pero diferente states.work ('blocked' vs 'active')
  const diffStatesTask = structuredClone(baseTask);
  diffStatesTask.states.work = 'blocked';
  assert.throws(
    () => engine.ingestOrReconcile(diffStatesTask, 'task.changed', '2026-01-01T12:05:00Z'),
    /Conflicto de idempotencia.*campos relevantes divergentes/,
    'Diferencia en states debe arrojar conflicto de idempotencia'
  );

  // Fallo de deduplicación: misma revisión pero diferente verified_at
  const diffVerTask = structuredClone(baseTask);
  diffVerTask.verified_at = '2026-01-01T12:04:00Z';
  assert.throws(
    () => engine.ingestOrReconcile(diffVerTask, 'task.changed', '2026-01-01T12:05:00Z'),
    /Conflicto de idempotencia.*campos relevantes divergentes/,
    'Diferencia en verified_at debe arrojar conflicto de idempotencia'
  );

  // Fallo de deduplicación: misma revisión pero diferentes source_refs
  const diffRefsTask = structuredClone(baseTask);
  diffRefsTask.source_refs = ['fixture:different-ref'];
  assert.throws(
    () => engine.ingestOrReconcile(diffRefsTask, 'task.changed', '2026-01-01T12:05:00Z'),
    /Conflicto de idempotencia.*campos relevantes divergentes/,
    'Diferencia en source_refs debe arrojar conflicto de idempotencia'
  );

  // Fallo de deduplicación: misma revisión pero diferente project_id
  const diffProjTask = structuredClone(baseTask);
  diffProjTask.project_id = 'proj-other';
  assert.throws(
    () => engine.ingestOrReconcile(diffProjTask, 'task.changed', '2026-01-01T12:05:00Z'),
    /Conflicto de idempotencia.*campos relevantes divergentes/,
    'Diferencia en project_id debe arrojar conflicto de idempotencia'
  );
  console.log('  ✓ Deduplicación exhaustiva confirmada en states, verified_at, project_id y source_refs.');

  // Test 4: Evitar duplicar revisiones antiguas en el historial
  console.log('Test 4: Prevención estricta de duplicación de revisiones en el historial...');
  const histTestTask: V1Object = {
    id: 'fixture:task:history-dedup',
    business_id: 'fixture-business',
    project_id: 'proj-hist',
    kind: 'task',
    revision: 2,
    classification: 'private_fixture',
    source_refs: ['fixture:hist'],
    states: {
      registration: 'inventoried',
      connection: 'connected',
      verification: 'verified',
      freshness: 'fresh',
      work: 'active',
    },
    verified_at: '2026-01-01T12:00:00Z',
    data: {
      obligation: 'Tarea inicial rev 2',
      attempt: 1,
      deadline: null,
      evidence_refs: [],
      next_steps: 'Wait',
      outcome: 'verified_fixture',
      result: null,
    },
    revisions_history: [],
  };
  engine.ingestOrReconcile(histTestTask, 'task.changed', '2026-01-01T12:05:00Z');

  // Ingestar rev 1 por primera vez
  const pastRev1 = structuredClone(histTestTask);
  pastRev1.revision = 1;
  (pastRev1.data as V1TaskData).obligation = 'Tarea inicial rev 1';
  const rPast1 = engine.ingestOrReconcile(pastRev1, 'task.changed', '2026-01-01T12:05:00Z');
  assert.equal(rPast1.status, 'archived_past_revision');
  assert.equal(rPast1.object?.revisions_history?.length, 1);

  // Ingestar rev 1 por SEGUNDA vez (idéntica) -> debe devolver duplicate y no añadir otra entrada
  const rPast1Again = engine.ingestOrReconcile(pastRev1, 'task.changed', '2026-01-01T12:05:00Z');
  assert.equal(rPast1Again.status, 'duplicate');
  assert.equal(
    rPast1Again.object?.revisions_history?.length,
    1,
    'El historial no debe duplicar la revisión 1 existente'
  );

  // Ingestar rev 1 con contenido divergente -> debe arrojar conflicto
  const pastRev1Divergent = structuredClone(pastRev1);
  (pastRev1Divergent.data as V1TaskData).obligation = 'Texto divergente rev 1';
  assert.throws(
    () => engine.ingestOrReconcile(pastRev1Divergent, 'task.changed', '2026-01-01T12:05:00Z'),
    /Conflicto de idempotencia en historial/,
    'Debe rechazar revisión histórica divergente'
  );
  console.log('  ✓ Prevención de revisiones duplicadas en el historial comprobada.');

  // Test 5: Filtrado de last_received_at también por proyecto
  console.log('Test 5: Filtrado estricto de last_received_at por project_id...');
  const logisticsTaskObj = engine.getObjects().find(o => o.id === 'fixture:doc:smj-plan-q1')!;
  const auditTaskObj = engine.getObjects().find(o => o.id === 'fixture:doc:smj-audit-2026')!;

  // Evento recibido en logística a las 12:03:00Z
  engine.recordExternalFixtureEvent(
    'document.revised',
    logisticsTaskObj,
    '2026-01-01T12:03:00Z',
    '2026-01-01T12:03:00Z'
  );

  // Evento recibido en auditoría a las 12:04:30Z
  engine.recordExternalFixtureEvent(
    'document.revised',
    auditTaskObj,
    '2026-01-01T12:04:30Z',
    '2026-01-01T12:04:30Z'
  );

  // Snapshot filtrado por logística: last_received_at debe ser 12:03:00, NO 12:04:30
  const snapLogisticsReceived = engine.snapshot(
    { business_ids: ['business-sm-jaleel'], project_id: 'proj-smj-q1-logistics' },
    '2026-01-01T12:05:00Z',
    'summary'
  );
  assert.equal(
    snapLogisticsReceived.last_received_at,
    '2026-01-01T12:03:00.000Z',
    'last_received_at debe estar filtrado exclusivamente al proyecto solicitado'
  );

  // Snapshot filtrado por auditoría: last_received_at debe ser 12:04:30
  const snapAuditReceived = engine.snapshot(
    { business_ids: ['business-sm-jaleel'], project_id: 'proj-smj-audit' },
    '2026-01-01T12:05:00Z',
    'summary'
  );
  assert.equal(
    snapAuditReceived.last_received_at,
    '2026-01-01T12:04:30.000Z',
    'last_received_at de auditoría debe reflejar su propio proyecto'
  );

  // Snapshot para un proyecto sin eventos recibidos -> last_received_at debe ser null
  const snapEmptyProjReceived = engine.snapshot(
    { business_ids: ['business-sm-jaleel'], project_id: 'proj-surf-caracol' },
    '2026-01-01T12:05:00Z',
    'summary'
  );
  assert.equal(snapEmptyProjReceived.last_received_at, null);
  console.log('  ✓ last_received_at respeta rigurosamente el filtro de project_id.');

  // Test 6: Cursores opacos sin exponer contadores globales ni metadatos
  console.log('Test 6: Verificación de cursores puramente opacos (sin contadores expuestos)...');
  const snapCursorTest = engine.snapshot(fixtureScope, '2026-01-01T12:05:00Z', 'summary');
  const cursorToken = snapCursorTest.cursor;
  assert(cursorToken.startsWith('cur_'), "El cursor debe iniciar con prefijo 'cur_'");
  assert(cursorToken.length >= 32, 'El cursor debe ser un identificador opaco aleatorio');

  // Validar que el token NO contenga JSON ni exponga event_index
  let leakedCounter = false;
  try {
    const decoded = Buffer.from(cursorToken, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);
    if ('event_index' in parsed || 'counter' in parsed || 'scope' in parsed) {
      leakedCounter = true;
    }
  } catch {
    // Al ser puramente opaco y no un JSON base64, JSON.parse falla normalmente
    leakedCounter = false;
  }
  assert.equal(leakedCounter, false, 'El token del cursor NO debe exponer contadores globales');

  // Cursor válido registrado funciona
  const chOk = engine.changes(fixtureScope, cursorToken, '2026-01-01T12:05:00Z');
  assert.equal(chOk.snapshot_required, false);
  assert(chOk.cursor.startsWith('cur_'));

  // Cursor desconocido / no registrado devuelve snapshot_required
  const chUnknown = engine.changes(fixtureScope, 'cur_unknown_random_fake_token', '2026-01-01T12:05:00Z');
  assert.equal(chUnknown.snapshot_required, true);
  console.log('  ✓ Cursores puramente opacos validados sin filtración de contadores.');

  // Test 7: Ocultación documental del historial dentro de eventos incrementales (changes)
  console.log('Test 7: Ocultación documental en revisions_history dentro de eventos de changes()...');
  // Objeto con documento sensible en revisions_history
  const confidentialDoc: V1Object = {
    id: 'fixture:doc:confidential-test',
    business_id: 'business-sm-jaleel',
    project_id: 'proj-smj-q1-logistics',
    kind: 'document',
    revision: 2,
    classification: 'private_fixture',
    source_refs: ['fixture:confidential'],
    states: {
      registration: 'inventoried',
      connection: 'connected',
      verification: 'verified',
      freshness: 'fresh',
      work: 'active',
    },
    verified_at: '2026-01-01T12:05:00Z',
    data: {
      source_ref: 'fixture:confidential',
      captured_at: '2026-01-01T12:05:00Z',
      hash: 'sha256-confidential-v2',
      attachments: [],
      availability: 'local_mirror',
      title: 'Doc Confidencial Rev 2',
      content: 'Cuerpo privado activo',
      conflict: false,
    },
    revisions_history: [
      {
        id: 'fixture:doc:confidential-test',
        business_id: 'business-sm-jaleel',
        project_id: 'proj-smj-q1-logistics',
        kind: 'document',
        revision: 1,
        classification: 'private_fixture',
        source_refs: ['fixture:confidential-v1'],
        states: {
          registration: 'inventoried',
          connection: 'connected',
          verification: 'verified',
          freshness: 'fresh',
          work: 'active',
        },
        verified_at: null,
        data: {
          source_ref: 'fixture:confidential-v1',
          captured_at: '2026-01-01T10:00:00Z',
          hash: 'sha256-confidential-v1',
          attachments: [],
          availability: 'local_mirror',
          title: 'Doc Confidencial Rev 1',
          content: 'Cuerpo secreto histórico rev 1',
          conflict: false,
        },
      },
    ],
  };

  // Generar cursor antes de ingestar
  const snapBefore = engine.snapshot(
    { business_ids: ['business-sm-jaleel'], permissions: { document_content: false } },
    '2026-01-01T12:05:00Z',
    'documents'
  );
  const cursorBefore = snapBefore.cursor;

  // Ingestar a las 12:06:00Z
  engine.ingestOrReconcile(confidentialDoc, 'document.revised', '2026-01-01T12:06:00Z');

  // A. Consultar changes SIN permiso document_content
  const chRestricted = engine.changes(
    { business_ids: ['business-sm-jaleel'], permissions: { document_content: false } },
    cursorBefore,
    '2026-01-01T12:06:00Z'
  );
  const evConfidential = chRestricted.events.find(e => e.object.id === 'fixture:doc:confidential-test');
  assert(evConfidential, 'Debe devolver el evento incremental');
  assert.equal(
    (evConfidential.object.data as V1DocumentData).content,
    null,
    'El cuerpo del evento en changes debe ser null'
  );
  assert(
    evConfidential.object.revisions_history && evConfidential.object.revisions_history.length > 0,
    'Debe tener historial en el evento'
  );
  for (const hist of evConfidential.object.revisions_history) {
    assert.equal(
      (hist.data as V1DocumentData).content,
      null,
      'El contenido en revisions_history dentro del evento incremental debe ser estrictamente null'
    );
  }

  // B. Consultar changes CON permiso document_content
  const snapWithPerm = engine.snapshot(
    { business_ids: ['business-sm-jaleel'], permissions: { document_content: true } },
    '2026-01-01T12:06:00Z',
    'documents'
  );
  // Ingestar rev 3 para generar nuevo evento
  const confRev3 = structuredClone(confidentialDoc);
  confRev3.revision = 3;
  (confRev3.data as V1DocumentData).title = 'Doc Confidencial Rev 3';
  engine.ingestOrReconcile(confRev3, 'document.revised', '2026-01-01T12:06:30Z');

  const chAllowed = engine.changes(
    { business_ids: ['business-sm-jaleel'], permissions: { document_content: true } },
    snapWithPerm.cursor,
    '2026-01-01T12:06:30Z'
  );
  const evAllowed = chAllowed.events.find(e => e.object.id === 'fixture:doc:confidential-test');
  assert(evAllowed);
  assert.equal(typeof (evAllowed.object.data as V1DocumentData).content, 'string');
  assert.equal(
    typeof (evAllowed.object.revisions_history?.[0]?.data as V1DocumentData).content,
    'string'
  );
  console.log('  ✓ Ocultación documental en revisions_history dentro de eventos incrementales aprobada.');

  console.log('--- TODAS LAS PRUEBAS DE CONFORMIDAD DE SUPERVISIÓN V1 PASARON EXITOSAMENTE ---');
}

runSupervisionTests().catch(err => {
  console.error('ERROR EN PRUEBAS:', err);
  process.exit(1);
});

import { randomUUID } from 'node:crypto';
import type { DatabaseSchema } from './mockData';
import type { SessionData } from '@/lib/session';
import { WorkspaceError } from '@/lib/projects';
import { responsiblePeople, type AutomationRecord, type HeroPreference } from '@/lib/workspaceLayers';
import { marinePoint } from '@/lib/locationReferences';
function text(value: unknown, required = false, max = 2000) { if (typeof value !== 'string' || value.length > max || required && !value.trim()) throw new WorkspaceError('Texto inválido o incompleto.'); return value.trim(); }
function instant(value: unknown) { const result = text(value || ''); if (result && (!/(Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result)))) throw new WorkspaceError('Fecha de ejecución o lectura inválida.'); return result; }
function url(value: unknown) { const result = text(value || ''); if (result) { try { if (new URL(result).protocol !== 'https:') throw new Error(); } catch { throw new WorkspaceError('La fuente debe ser un enlace HTTPS.'); } } return result; }
function revision(actual: number, expected: unknown) { if (actual !== expected) throw new WorkspaceError('Otra actualización cambió este registro. Revisa la versión vigente.', 409); }
export const layerActions = ['createAgent', 'saveAutomation', 'restoreAutomation', 'saveHero', 'restoreHero'];
export function layerCommand(data: DatabaseSchema, actor: SessionData, body: any, provenance?: import('./mockData').LogEntry['provenance']) {
  const input = body.fields || {}; const reason = text(body.reason, true); const at = new Date().toISOString();
  if (body.action === 'createAgent') {
    const name = text(input.name, true, 120); if (responsiblePeople(data).some(p => p.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) throw new WorkspaceError('Este responsable ya existe.');
    const agent = { id: `agent-${randomUUID()}`, name, role: 'AIAgent', avatar: '' }; data.people.push(agent); return agent;
  }
  if (['saveAutomation', 'restoreAutomation'].includes(body.action)) {
    data.automations ||= [];
    const old = body.id ? data.automations.find(a => a.id === body.id && a.ownerId === actor.personId) : undefined;
    if (body.id && !old) throw new WorkspaceError('Automatización no encontrada.', 404);
    if (old) revision(old.revision, body.expectedRevision);
    let item: AutomationRecord;
    if (body.action === 'restoreAutomation') {
      const saved = old?.history.find(h => h.snapshot.revision === input.revision)?.snapshot;
      if (!saved || !old) throw new WorkspaceError('Revisión no disponible.');
      item = { ...structuredClone(saved), revision: old.revision + 1, history: old.history.slice() };
    } else {
      if (!data.companies.some(c => c.id === input.companyId) || !responsiblePeople(data).some(p => p.id === input.assigneeId)) throw new WorkspaceError('Elige empresa y responsable válidos.');
      if (!['ChatGPT', 'Other'].includes(input.provider) || !['Unknown', 'Enabled', 'Disabled'].includes(input.configuration) || !['Unknown', 'Succeeded', 'Failed'].includes(input.lastOutcome)) throw new WorkspaceError('Estado de automatización inválido.');
      item = { id: old?.id || randomUUID(), ownerId: actor.personId, revision: (old?.revision || 0) + 1, title: text(input.title, true, 240), purpose: text(input.purpose || ''), companyId: input.companyId, assigneeId: input.assigneeId, provider: input.provider, externalId: text(input.externalId, true, 200), sourceUrl: url(input.sourceUrl), configuration: input.configuration, verifiedAt: instant(input.verifiedAt), evidence: text(input.evidence || ''), lastRunAt: instant(input.lastRunAt), lastOutcome: input.lastOutcome, outcomeEvidence: text(input.outcomeEvidence || ''), nextRunAt: instant(input.nextRunAt), blockedBy: text(input.blockedBy || ''), history: old?.history.slice() || [] };
      if (item.configuration !== 'Unknown' && (!item.verifiedAt || !item.evidence || !item.sourceUrl)) throw new WorkspaceError('Para registrar configuración verificada indica fuente, fecha de lectura y evidencia.');
      if (item.lastOutcome !== 'Unknown' && (!item.lastRunAt || !item.outcomeEvidence)) throw new WorkspaceError('El resultado requiere fecha de ejecución y evidencia; una ejecución registrada no demuestra éxito.');
      if (data.automations.some(a => a.id !== item.id && a.provider === item.provider && a.externalId === item.externalId)) throw new WorkspaceError('Esta automatización de origen ya está registrada.', 409);
    }
    if (data.automations.some(a => a.id !== item.id && a.provider === item.provider && a.externalId === item.externalId)) throw new WorkspaceError('Restaurar dejaría dos registros del mismo origen; revisa sus vínculos.', 409);
    const { history, ...snapshot } = item; history.push({ at, actorId: actor.personId, reason, snapshot: structuredClone(snapshot), ...(provenance ? { provenance } : {}) });
    data.automations = [...data.automations.filter(a => a.id !== item.id), item]; return item;
  }
  data.heroPreferences ||= []; const old = data.heroPreferences.find(p => p.ownerId === actor.personId);
  revision(old?.revision || 0, body.expectedRevision);
  let item: HeroPreference;
  if (body.action === 'restoreHero') {
    const saved = old?.history.find(h => h.snapshot.revision === input.revision)?.snapshot;
    if (!old || !saved) throw new WorkspaceError('Preferencia histórica no disponible.');
    item = { ...structuredClone(saved), revision: old.revision + 1, history: old.history.slice(), widgetsEnabled: false };
  } else {
    if (!['Lake', 'Warm', 'Plain', 'Custom'].includes(input.background) || typeof input.widgetsEnabled !== 'boolean') throw new WorkspaceError('Preferencia inválida.');
    const image = text(input.image || '', false, 1400000);
    if (image) {
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image); if (!match) throw new WorkspaceError('Usa una imagen PNG, JPG o WebP local.');
      const bytes = Buffer.from(match[2], 'base64'); const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])); const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255; const webp = bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
      if (bytes.length > 1000000 || !(match[1] === 'png' ? png : match[1] === 'jpeg' ? jpeg : webp)) throw new WorkspaceError('Imagen inválida o mayor a 1 MB.');
    }
    if (input.background === 'Custom' && !image) throw new WorkspaceError('Selecciona una fotografía local.');
    const latitude = text(input.latitude || '', false, 30), longitude = text(input.longitude || '', false, 30);
    if (!!latitude !== !!longitude || latitude && (!Number.isFinite(Number(latitude)) || Math.abs(Number(latitude)) > 90 || !Number.isFinite(Number(longitude)) || Math.abs(Number(longitude)) > 180)) throw new WorkspaceError('Coordenadas inválidas.');
    if (input.widgetsEnabled && (!latitude || !text(input.locationLabel || ''))) throw new WorkspaceError('Elige explícitamente el lugar para clima y mar.');
    let homeMarine; try { homeMarine = input.homeMarine === undefined ? old?.homeMarine || null : marinePoint(input.homeMarine); } catch { throw new WorkspaceError('Elige un punto marino válido para Casa.'); }
    item = { id: actor.personId, ownerId: actor.personId, revision: (old?.revision || 0) + 1, background: input.background, image, locationLabel: text(input.locationLabel || '', false, 120), latitude, longitude, widgetsEnabled: input.widgetsEnabled, homeMarine, history: old?.history.slice() || [] };
  }
  const { history, ...snapshot } = item; history.push({ at, actorId: actor.personId, reason, snapshot: structuredClone(snapshot), ...(provenance ? { provenance } : {}) }); data.heroPreferences = [...data.heroPreferences.filter(p => p.id !== item.id), item]; return item;
}

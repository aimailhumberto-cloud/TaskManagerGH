// Read-only checks for upgrading the existing service. Never seed, migrate or connect.
export interface ExistingServiceFacts {
  serviceId?: string;
  storage?: 'Unknown' | 'JSON' | 'Supabase';
  variablesPresent?: Record<string, boolean>;
  jsonMountVerified?: boolean;
  attachmentsMountVerified?: boolean;
  realIdentityVerified?: boolean;
}
export function auditExistingService(facts: ExistingServiceFacts = {}) {
  const blockers: string[] = [];
  if (!facts.serviceId) blockers.push('Identificar el servicio original; no crear otro.');
  const vars = facts.variablesPresent || {};
  if (!!vars.SUPABASE_URL !== !!vars.SUPABASE_SERVICE_ROLE_KEY) blockers.push('Configuración Supabase parcial: impedir cambio accidental al backend JSON.');
  if (!facts.storage || facts.storage === 'Unknown') blockers.push('Confirmar almacenamiento real y respaldo original.');
  if (facts.storage === 'Supabase') blockers.push('Adaptar transacciones y persistencia de todas las colecciones nuevas antes de reemplazar.');
  if (facts.storage === 'JSON' && !facts.jsonMountVerified) blockers.push('Verificar ruta JSON dentro del montaje persistente existente.');
  if (!facts.attachmentsMountVerified) blockers.push('Verificar persistencia y respaldo de adjuntos.');
  if (!facts.realIdentityVerified) blockers.push('Verificar usuarios reales y mapeo de propietarios; no importar cuentas DEMO.');
  blockers.push('Ensayar migración y rollback sobre una copia aislada del respaldo real.');
  blockers.push('Separar protecciones permanentes del modo de preview y comprobar sesión HTTPS real.');
  return { serviceId: facts.serviceId || null, storage: facts.storage || 'Unknown', variableNamesPresent: Object.keys(vars).filter(k => vars[k]).sort(), readyToDeploy: false, blockers, externalActions: false };
}
export function auditUpgradeDatabase(value: any) {
  if (!value || typeof value !== 'object' || !['companies', 'people', 'tasks'].every(k => Array.isArray(value[k]))) throw new Error('Exportación JSON inválida; no se modificó ninguna base.');
  const issues: string[] = [];
  const keys = ['companies','people','tasks','users','projects','reminders','automations','heroPreferences','appliedOperations'];
  for (const key of keys) {
    const records = value[key];
    if (records === undefined) continue;
    if (key === 'appliedOperations') {
      if (!Array.isArray(records) || records.some((x: any) => !x || typeof x.actorId !== 'string' || typeof x.requestId !== 'string' || typeof x.fingerprint !== 'string') || new Set(records.map((x: any) => JSON.stringify([x.actorId, x.requestId]))).size !== records.length) issues.push('Revisar integridad de appliedOperations.');
      continue;
    }
    if (!Array.isArray(records) || records.some((x: any) => !x || typeof x.id !== 'string') || new Set(records.map((x: any) => x.id)).size !== records.length) issues.push(`Revisar integridad de ${key}.`);
  }
  const people = new Set(value.people.map((p: any) => p.id));
  const users = Array.isArray(value.users) ? value.users : [];
  const orphanUsers = users.filter((u: any) => !people.has(u.personId)).length;
  if (!users.length) issues.push('No hay usuarios exportados: resolver identidad real sin sembrar un administrador.');
  if (orphanUsers) issues.push('Hay usuarios sin perfil asociado.');
  const unownedTasks = value.tasks.filter((t: any) => !t.ownerId).length;
  const invalidOwners = value.tasks.filter((t: any) => t.ownerId && !people.has(t.ownerId)).length;
  if (unownedTasks) issues.push('Asignar propietarios solo con mapeo explícito validado; conservar IDs e historial.');
  if (invalidOwners) issues.push('Resolver propietarios inexistentes.');
  return {
    counts: Object.fromEntries(keys.map(k => [k, Array.isArray(value[k]) ? value[k].length : 0])),
    missingCollections: keys.filter(k => value[k] === undefined),
    tasksWithoutOwner: unownedTasks, invalidOwners, orphanUsers, issues,
    dryRunOnly: true, databaseChanged: false, credentialsIncludedInReport: false,
  };
}

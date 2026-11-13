/**
 * Un cerebro por persona. Aquí vive el RESOLUTOR: la única pieza que traduce «quién pide» a «qué bóveda».
 *  - Cerebro principal ('hb'): la bóveda histórica. Lo usan la cuenta creada en /setup, las sesiones
 *    antiguas y la llave de servicio AGENT_API_KEY (el agente de HB).
 *  - Cada otra cuenta propia tiene su cerebro en <datos>/brains/<id de cuenta>/vault.
 *  - Un Owner o Admin puede mirar otro cerebro (cookie brain_view); cada acceso queda registrado.
 * El navegador nunca elige la carpeta: solo se aceptan ids de cuenta que existen.
 */
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { runInBrain, type BrainCtx } from './brainContext';
import { getPrimaryVaultPath } from './smjBrainService';
import { decryptSession } from './session';
import { getAccount, isLocalId, listAccounts, TOP_ROLES, type PublicAccount } from './localAccounts';
import { serviceKeyMatches, loginRequiredFrom } from './loginGate';
import { looksLikeAgentKey, presentedKey, verifyKey } from './agentKeys';
import { withLang, langFromRequest, tr } from './reqLang';

export const PRIMARY_BRAIN_ID = 'hb';
export const BRAIN_VIEW_COOKIE = 'brain_view';
/** Cerebro compartido de la compañía: todos lo leen; solo Owner/Admin escriben. */
export const COMPANY_BRAIN_ID = 'compania';
const LOCAL_ID = /^local-\d{1,9}$/;

export const dataRoot = () => path.dirname(path.resolve(getPrimaryVaultPath()));
export const brainsRoot = () => path.join(dataRoot(), 'brains');

type AccountLike = Pick<PublicAccount, 'id' | 'createdBy'>;
/** La cuenta creada en /setup (o la indicada en PRIMARY_BRAIN_ACCOUNT) es dueña del cerebro principal. */
export function brainIdForAccount(acc: AccountLike): string {
  const forced = process.env.PRIMARY_BRAIN_ACCOUNT?.trim();
  if (forced ? acc.id === forced : acc.createdBy === 'setup') return PRIMARY_BRAIN_ID;
  return acc.id;
}

export function vaultPathFor(brainId: string): string | null {
  if (brainId === PRIMARY_BRAIN_ID) return getPrimaryVaultPath();
  if (brainId === COMPANY_BRAIN_ID) return path.join(brainsRoot(), COMPANY_BRAIN_ID, 'vault');
  if (!LOCAL_ID.test(brainId)) return null;
  return path.join(brainsRoot(), brainId, 'vault');
}

/** Crea la bóveda de un cerebro nuevo con la estructura mínima. No toca una que ya existe. */
export function ensureBrain(brainId: string, ownerName: string): string | null {
  const vault = vaultPathFor(brainId);
  if (!vault || brainId === PRIMARY_BRAIN_ID) return vault;
  if (fs.existsSync(vault)) return vault;
  for (const d of ['00-System', '00-Working-Memory', '01-Internal-Clients', '02-External-Clients', '03-Portfolio-Supply', '04-Operations-Routines', '05-Consolidation-Sessions']) fs.mkdirSync(path.join(vault, d), { recursive: true });
  const title = (brainId === COMPANY_BRAIN_ID ? 'Cerebro de la compañía' : `Cerebro de ${ownerName}`).replace(/["\n\r]/g, ' ').slice(0, 140);
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(vault, '01-Internal-Clients', 'Core.md'),
    `---\nid: core-${brainId}\ntitle: "${title}"\ntype: core\nmemory_tier: long_term\nstatus: active\nbrain_id: ${brainId}\nbrain_owner: ${brainId}\nvisibility: ${brainId === COMPANY_BRAIN_ID ? 'public' : 'private'}\ncreated_at: "${now}"\nlast_updated_at: "${now}"\n---\n# ${title}\n\n${brainId === COMPANY_BRAIN_ID ? 'Conocimiento compartido de la compañía. Todos pueden consultarlo; solo los administradores lo editan.' : 'Este es el centro de tu cerebro. Todo lo que captures o tu agente agregue se conecta desde aquí.'}\n`);
  return vault;
}

export function logBrainAccess(entry: { actor: string; role: string; brainId: string; path: string; method: string }) {
  try {
    const f = path.join(dataRoot(), 'accounts', 'brain-access.jsonl');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.appendFileSync(f, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
  } catch {}
}

export const companyBrainExists = () => fs.existsSync(vaultPathFor(COMPANY_BRAIN_ID) as string);

export type Resolved = { ok: true; ctx: BrainCtx; role?: string } | { ok: false; status: number; error: string };

export interface ResolveInput {
  sessionToken?: string;
  brainView?: string;
  headers: { get(name: string): string | null };
  path: string;
  method: string;
}

export function resolveBrain(i: ResolveInput): Resolved {
  const primary = (actor?: string, via?: string): Resolved => ({ ok: true, ctx: { brainId: PRIMARY_BRAIN_ID, vaultPath: getPrimaryVaultPath(), primary: true, actor, via, ownBrainId: PRIMARY_BRAIN_ID } });
  const session = i.sessionToken ? decryptSession(i.sessionToken) : null;

  if (session && isLocalId(session.userId)) {
    const acc = getAccount(session.userId);
    if (!acc?.isActive) return { ok: false, status: 401, error: tr('Sesión revocada.', 'Session revoked.') };
    const own = brainIdForAccount(acc);
    if (i.brainView === COMPANY_BRAIN_ID && companyBrainExists()) {
      return { ok: true, role: acc.role, ctx: { brainId: COMPANY_BRAIN_ID, vaultPath: vaultPathFor(COMPANY_BRAIN_ID) as string, primary: false, actor: acc.id, via: 'compania', ownBrainId: own, readOnly: !TOP_ROLES.includes(acc.role) } };
    }
    let brainId = own;
    let via = 'sesion';
    // Solo Owner/Admin pueden mirar otro cerebro, y solo uno que exista.
    if (i.brainView && i.brainView !== brainId && TOP_ROLES.includes(acc.role)) {
      const target = i.brainView === PRIMARY_BRAIN_ID ? null : getAccount(i.brainView);
      const targetBrain = i.brainView === PRIMARY_BRAIN_ID ? PRIMARY_BRAIN_ID : target ? brainIdForAccount(target) : null;
      if (targetBrain) {
        brainId = targetBrain; via = 'administrador';
        logBrainAccess({ actor: acc.id, role: acc.role, brainId, path: i.path, method: i.method });
      }
    }
    const vaultPath = brainId === PRIMARY_BRAIN_ID ? getPrimaryVaultPath() : ensureBrain(brainId, (brainId === acc.id ? acc.name : getAccount(brainId)?.name) || brainId);
    if (!vaultPath) return { ok: false, status: 403, error: tr('Cerebro no disponible.', 'Brain not available.') };
    return { ok: true, role: acc.role, ctx: { brainId, vaultPath, primary: brainId === PRIMARY_BRAIN_ID, actor: acc.id, via, ownBrainId: own } };
  }
  // Sesiones del sistema anterior: cerebro principal.
  if (session) return primary(session.userId, 'sesion-original');
  // Llave por agente: abre solo el cerebro de su cuenta, con su alcance.
  const presented = presentedKey(i.headers);
  if (presented && looksLikeAgentKey(presented)) {
    const k = verifyKey(presented);
    const acc = k ? getAccount(k.accountId) : null;
    if (!k || !acc?.isActive) return { ok: false, status: 401, error: tr('Llave de agente inválida o revocada.', 'Invalid or revoked agent key.') };
    const brainId = brainIdForAccount(acc);
    // Un agente puede CONSULTAR el cerebro de la compañía con el encabezado x-brain: compania (nunca escribir).
    if (i.headers.get('x-brain') === COMPANY_BRAIN_ID && companyBrainExists()) {
      return { ok: true, role: acc.role, ctx: { brainId: COMPANY_BRAIN_ID, vaultPath: vaultPathFor(COMPANY_BRAIN_ID) as string, primary: false, actor: `agente:${k.id}`, via: 'compania', scope: k.scope, ownBrainId: brainId, readOnly: true } };
    }
    const vaultPath = brainId === PRIMARY_BRAIN_ID ? getPrimaryVaultPath() : ensureBrain(brainId, acc.name);
    if (!vaultPath) return { ok: false, status: 403, error: 'Cerebro no disponible.' };
    return { ok: true, role: acc.role, ctx: { brainId, vaultPath, primary: brainId === PRIMARY_BRAIN_ID, actor: `agente:${k.id}`, via: 'llave-de-agente', scope: k.scope, ownBrainId: brainId } };
  }
  // Llave histórica de servicio (el agente de HB): cerebro principal, sin límite de alcance.
  if (serviceKeyMatches(i.headers, process.env.AGENT_API_KEY)) {
    if (i.headers.get('x-brain') === COMPANY_BRAIN_ID && companyBrainExists()) return { ok: true, ctx: { brainId: COMPANY_BRAIN_ID, vaultPath: vaultPathFor(COMPANY_BRAIN_ID) as string, primary: false, actor: 'agente', via: 'compania', ownBrainId: PRIMARY_BRAIN_ID, readOnly: true } };
    return primary('agente', 'llave');
  }
  if (presented) return { ok: false, status: 401, error: tr('Llave de agente inválida.', 'Invalid agent key.') };
  // Sin identidad: solo vale con el login apagado (modo anterior). Con el login encendido se niega también aquí.
  if (loginRequiredFrom(process.env.LOGIN_REQUIRED)) return { ok: false, status: 401, error: tr('Inicia sesión para continuar.', 'Sign in to continue.') };
  return primary(undefined, 'anonimo');
}

type Handler = (req: NextRequest, ...rest: any[]) => Promise<Response> | Response;
/** Envuelve una ruta: todo lo que haga corre dentro del cerebro que le corresponde a quien pide. */
export function withBrain<H extends Handler>(handler: H): H {
  return ((req: NextRequest, ...rest: any[]) => withLang(langFromRequest(req), 'es', () => withBrainInner(handler, req, rest))) as H;
}
async function withBrainInner(handler: Handler, req: NextRequest, rest: any[]): Promise<Response> {
  {
    const r = resolveBrain({
      sessionToken: req.cookies.get('hermes_session')?.value,
      brainView: req.cookies.get(BRAIN_VIEW_COOKIE)?.value,
      headers: req.headers, path: req.nextUrl.pathname, method: req.method,
    });
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    // Un perfil de solo lectura no escribe en ningún cerebro.
    const writing = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (r.role === 'Solo lectura' && writing) return NextResponse.json({ ok: false, error: tr('Tu perfil es de solo consulta.', 'Your profile is read-only.') }, { status: 403 });
    if (r.ctx.readOnly && writing) return NextResponse.json({ ok: false, error: tr('El cerebro de la compañía es de solo consulta para tu perfil.', 'The company brain is read-only for your profile.') }, { status: 403 });
    if (r.ctx.scope === 'leer' && writing) return NextResponse.json({ ok: false, error: tr('Esta llave es de solo lectura.', 'This key is read-only.') }, { status: 403 });
    // Lo que escribe un agente queda en el registro del cerebro (acción y resultado, nunca el contenido).
    const byAgent = writing && (r.ctx.via === 'llave' || r.ctx.via === 'llave-de-agente');
    let body: any;
    if (writing) { try { body = await req.clone().json(); } catch {} }
    const action = typeof body?.action === 'string' ? body.action.slice(0, 40) : undefined;
    r.ctx.role = r.role;
    // Reintentos: la misma petición (misma clave) no se aplica dos veces; se devuelve la respuesta guardada.
    const idemKey = writing ? String(req.headers.get('idempotency-key') || req.headers.get('x-request-id') || (typeof body?.requestId === 'string' ? body.requestId : '')).slice(0, 120) : '';
    const { idemGet, idemSave } = await import('./idempotency');
    if (idemKey) {
      const hit = idemGet(r.ctx.vaultPath, r.ctx.actor || 'anon', idemKey);
      if (hit) return NextResponse.json({ ...(hit.body as Record<string, unknown>), repeated: true, note: tr('Esta petición ya se había aplicado; no se repitió.', 'This request had already been applied; it was not repeated.') }, { status: hit.status, headers: { 'x-repeated': '1' } });
    }
    const workLang = writing ? (await import('./cerebro/settings')).loadSettings(r.ctx.vaultPath).workLang : 'es';
    const handle = () => withLang(langFromRequest(req), workLang, () => runInBrain(r.ctx, () => handler(req, ...rest)));
    let res: Response;
    let entry: import('./journal').JournalEntry | null = null;
    if (writing) {
      // Diario: todo lo que esta petición escriba queda con su antes y después, y se puede deshacer.
      const { withChange } = await import('./journal');
      const who = r.ctx.actor?.startsWith('local-') ? getAccount(r.ctx.actor)?.name || r.ctx.actor : r.ctx.actor === 'agente' ? 'Agente (llave general)' : r.ctx.actor?.startsWith('agente:') ? `Agente ${r.ctx.actor.slice(7)}` : r.ctx.actor || 'sin identificar';
      ({ result: res, entry } = await withChange(r.ctx.vaultPath, { actor: who, via: r.ctx.via, route: req.nextUrl.pathname, action, request: idemKey || undefined }, handle));
    } else res = await handle();
    if (byAgent) { const { logActivity } = await import('./autonomy'); logActivity(r.ctx.vaultPath, { actor: r.ctx.actor || 'agente', via: r.ctx.via, path: req.nextUrl.pathname, action, status: res.status }); }
    if (!entry && !idemKey) return res;
    // Recibo: la respuesta dice qué cambió y cómo deshacerlo.
    let json: any = null;
    try { if ((res.headers.get('content-type') || '').includes('application/json')) json = await res.clone().json(); } catch {}
    if (!json || typeof json !== 'object' || Array.isArray(json)) return res;
    if (entry) { const { receiptOf } = await import('./journal'); json.receipt = receiptOf(entry); }
    if (idemKey) idemSave(r.ctx.vaultPath, r.ctx.actor || 'anon', idemKey, res.status, json);
    const headers = new Headers(res.headers); headers.delete('content-length');
    return new NextResponse(JSON.stringify(json), { status: res.status, headers });
  }
}

/** Para rutas que tocan el espacio de trabajo o servicios del cerebro principal. */
export function primaryOnly<H extends Handler>(handler: H): H {
  return withBrain((async (req: NextRequest, ...rest: any[]) => {
    const { isPrimaryBrain } = await import('./brainContext');
    if (!isPrimaryBrain()) return NextResponse.json({ ok: false, error: tr('Esta función todavía es solo del cerebro principal.', 'This function is still only for the main brain.') }, { status: 403 });
    return handler(req, ...rest);
  }) as H);
}

export function listBrains() {
  const out = [{ brainId: PRIMARY_BRAIN_ID, owner: 'HB (principal)', exists: true }];
  if (companyBrainExists()) out.push({ brainId: COMPANY_BRAIN_ID, owner: 'Compañía (compartido)', exists: true });
  for (const a of listAccounts()) {
    const id = brainIdForAccount(a);
    if (id === PRIMARY_BRAIN_ID) continue;
    const v = vaultPathFor(id);
    out.push({ brainId: id, owner: a.name, exists: !!v && fs.existsSync(v) });
  }
  return out;
}

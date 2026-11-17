import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/accountGuard';
import { listAccounts } from '@/lib/localAccounts';
import { listKeys } from '@/lib/agentKeys';
import { brainIdForAccount, vaultPathFor } from '@/lib/brains';
import { resumenCerebro, estadoDe, type FilaPersona, type Evento } from '@/lib/cerebro/actividad';
import { withReqLang } from '@/lib/reqLang';
export const dynamic = 'force-dynamic';

/**
 * Actividad de las personas y de sus agentes, para quien administra. Solo lectura.
 * Por persona: último ingreso, llaves de agente (y cuándo se usaron por última vez), llamadas del agente, bloqueos, pedidos y cambios.
 * Más una lista de los últimos movimientos de todos. No devuelve el contenido de las fichas.
 */
async function _GET(request: NextRequest) {
  const g = await requireManager(request); if (!g.ok) return g.res;
  const dias = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get('dias')) || 7));
  const personas: FilaPersona[] = []; const eventos: Evento[] = [];
  for (const a of listAccounts()) {
    let vault: string | null = null; try { vault = vaultPathFor(brainIdForAccount(a)); } catch { vault = null; }
    const r = resumenCerebro(vault, a.name, dias);
    const llaves = (() => { try { return listKeys(a.id).map(k => ({ id: k.id, nombre: k.name, alcance: k.scope, ultimoUso: k.lastUsedAt || null, revocada: !!k.revokedAt })); } catch { return []; } })();
    const { eventos: ev, ...cerebro } = r;
    const fila: FilaPersona = { id: a.id, nombre: a.name, correo: a.email, rol: a.role, activa: a.isActive, ultimoIngreso: a.lastLoginAt || null, llaves, cerebro, estado: 'sin_entrar' };
    fila.estado = estadoDe(fila);
    personas.push(fila); eventos.push(...ev);
  }
  eventos.sort((x, y) => y.at.localeCompare(x.at));
  return NextResponse.json({ ok: true, dias, personas, eventos: eventos.slice(0, 60) });
}
export const GET = withReqLang(_GET);

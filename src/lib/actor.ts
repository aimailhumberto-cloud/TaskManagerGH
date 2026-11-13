import { currentBrain } from './brainContext';
import { getAccount } from './localAccounts';
import { tw } from './reqLang';

/** Nombre de quien hace la acción en curso: la persona de la sesión, «Agente» si entra con llave, o un genérico. */
export function actorLabel(fallback = 'Usuario del cerebro'): string {
  const a = currentBrain()?.actor;
  if (!a) return fallback;
  if (a.startsWith('local-')) return getAccount(a)?.name || fallback;
  if (a.startsWith('agente')) return tw('Agente', 'Agent');
  return fallback;
}

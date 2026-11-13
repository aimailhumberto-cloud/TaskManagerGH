/**
 * Contexto de cerebro por petición. El servidor decide qué bóveda abre cada petición según quién entra;
 * el resto del código llama a getVaultPath() y recibe la carpeta de ESE cerebro. Sin contexto (arranque,
 * tareas internas) se usa el cerebro principal. Vive en globalThis para que todos los paquetes de rutas
 * de Next compartan el mismo almacén.
 */
import { AsyncLocalStorage } from 'async_hooks';

export interface BrainCtx { brainId: string; vaultPath: string; primary: boolean; actor?: string; via?: string }
const g = globalThis as unknown as { __brainALS?: AsyncLocalStorage<BrainCtx> };
const store = (g.__brainALS ??= new AsyncLocalStorage<BrainCtx>());

export const currentBrain = (): BrainCtx | null => store.getStore() || null;
export const runInBrain = <T>(ctx: BrainCtx, fn: () => T): T => store.run(ctx, fn);
/** ¿Se está trabajando sobre el cerebro principal? (sin contexto = sí) */
export const isPrimaryBrain = (): boolean => { const c = store.getStore(); return !c || c.primary; };

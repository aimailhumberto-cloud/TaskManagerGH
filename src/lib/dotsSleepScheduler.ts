import { getVaultPath, loadBrainGraph } from './smjBrainService';
import { needsNightlyReport, runSleepCycle } from './dotsSleep';

/**
 * Temporizador del ciclo nocturno: cada 30 minutos revisa si ya pasó la hora (2 a.m. de Panamá)
 * y todavía no hay informe del día; si es así lo genera. Solo lee el cerebro; no cambia notas.
 * Se puede apagar con DOTS_SLEEP_DISABLED=1.
 */
const g = globalThis as unknown as { __dotsSleepTimer?: NodeJS.Timeout };

export function checkNightlyOnce(): boolean {
  try {
    const vaultPath = getVaultPath();
    if (!needsNightlyReport(vaultPath)) return false;
    const graph = loadBrainGraph();
    const report = runSleepCycle(vaultPath, { nodes: graph.allNodes || graph.nodes, links: graph.links });
    console.log(`[dots-sleep] informe ${report.day}: ${report.proposals.length} propuestas`);
    return true;
  } catch (e: any) {
    console.error('[dots-sleep] no se pudo generar el informe:', e?.message || e);
    return false;
  }
}

export function startNightlyDotsSleep() {
  if (process.env.DOTS_SLEEP_DISABLED === '1' || g.__dotsSleepTimer) return;
  const first = setTimeout(checkNightlyOnce, 60_000);
  first.unref?.();
  g.__dotsSleepTimer = setInterval(checkNightlyOnce, 30 * 60_000);
  g.__dotsSleepTimer.unref?.();
}

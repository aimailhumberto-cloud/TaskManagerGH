import { getVaultPath, loadBrainGraph } from './smjBrainService';
import { getSleepDir, needsNightlyReport, runSleepCycle } from './dotsSleep';
import { configuredProvider, logCall, reviewProposals, saveReviews } from './decisionEngine';

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
    // Revisión nocturna con Jev (si hay llave). Solo anota confianza y urgencia; no cambia notas. JEV_NIGHTLY_DISABLED=1 la apaga.
    const provider = configuredProvider();
    if (provider && process.env.JEV_NIGHTLY_DISABLED !== '1') {
      const sleepDir = getSleepDir(vaultPath);
      reviewProposals(provider, report.proposals, (graph.allNodes || graph.nodes) as any)
        .then((out) => {
          saveReviews(sleepDir, out.reviews, new Set(report.proposals.map((p) => p.id)));
          logCall(sleepDir, { action: 'review-nocturna', ok: out.errors.length === 0, ms: out.ms, input_tokens: out.usage.input_tokens, reviewed: out.reviewed, error: out.errors[0] });
        })
        .catch((e) => logCall(sleepDir, { action: 'review-nocturna', ok: false, error: e?.message || 'error' }));
    }
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

import { getVaultPath, loadBrainGraph } from './smjBrainService';
import { isPrimaryBrain } from './brainContext';
import { getSleepDir, needsNightlyReport, runSleepCycle, panamaDay } from './dotsSleep';
import { recordGrowth } from './brainGrowth';
import { autoApply } from './autonomy';
import { configuredProvider, logCall, reviewProposals, saveReviews } from './decisionEngine';

/**
 * Temporizador del ciclo nocturno: cada 30 minutos revisa si ya pasó la hora (2 a.m. de Panamá)
 * y todavía no hay informe del día; si es así lo genera. Solo lee el cerebro; no cambia notas.
 * Se puede apagar con DOTS_SLEEP_DISABLED=1.
 */
const g = globalThis as unknown as { __dotsSleepTimer?: NodeJS.Timeout };

/** Recorre todos los cerebros: cada uno recibe su informe en su propia carpeta. */
export function checkNightlyOnce(): boolean {
  let any = false;
  try {
    const { listBrains, vaultPathFor } = require('./brains');
    const { runInBrain } = require('./brainContext');
    for (const b of listBrains()) {
      const vaultPath = vaultPathFor(b.brainId);
      if (!b.exists || !vaultPath) continue;
      any = runInBrain({ brainId: b.brainId, vaultPath, primary: b.brainId === 'hb', via: 'ciclo-nocturno' }, checkCurrentBrain) || any;
    }
  } catch (e: any) { console.error('[dots-sleep] no se pudo recorrer los cerebros:', e?.message || e); }
  return any;
}

const nightRunning = new Set<string>();
/** Lanza la noche del Cerebro en segundo plano (una por bóveda a la vez). Solo avisa: no cambia fichas. CEREBRO_NIGHT_DISABLED=1 la apaga. */
export function runNightOnce(vaultPath: string, now: Date = new Date()): boolean {
  if (process.env.CEREBRO_NIGHT_DISABLED === '1') return false;
  try {
    const { needsNight, runNight } = require('./cerebro/night');
    if (nightRunning.has(vaultPath) || !needsNight(vaultPath, now)) return false;
    nightRunning.add(vaultPath);
    const { advanceStaleIds, listRequests } = require('./cerebro/engine');
    const { currentBrain } = require('./brainContext');
    runNight(vaultPath, {
      listRequests: () => listRequests(vaultPath),
      advance: () => advanceStaleIds({ limit: 25, force: true }),
      graph: () => { const g = loadBrainGraph(); return { nodes: (g.allNodes || g.nodes) as any, links: g.links as any }; },
      readOnly: !!currentBrain?.()?.readOnly,
    }, now).then((r: any) => console.log(`[cerebro-noche] ${r.corridaDia}: sesión ${r.sesion?.escrita ? 'escrita' : 'sin escribir'}, ${r.digest.avanzados.length} casos avanzados${r.errores.length ? `, errores: ${r.errores.join(' | ')}` : ''}`))
      .catch((e: any) => console.error('[cerebro-noche] falló:', e?.message || e))
      .finally(() => nightRunning.delete(vaultPath));
    return true;
  } catch (e: any) { nightRunning.delete(vaultPath); console.error('[cerebro-noche] no se pudo lanzar:', e?.message || e); return false; }
}


function checkCurrentBrain(): boolean {
  try {
    const vaultPath = getVaultPath();
    // Foto diaria de cifras para la curva de crecimiento, aunque nadie abra el tablero ese día.
    try { const g0 = loadBrainGraph(); recordGrowth(vaultPath, (g0.allNodes || g0.nodes) as any, g0.links.length, panamaDay(new Date())); } catch {}
    // La noche del Cerebro (etapa 5.5): avanza lo vencido, escribe la sesión del día y deja el resumen. Corre aparte del informe: solo depende de que hoy no haya corrido.
    runNightOnce(vaultPath);
    if (!needsNightlyReport(vaultPath)) return false;
    const graph = loadBrainGraph();
    const report = runSleepCycle(vaultPath, { nodes: graph.allNodes || graph.nodes, links: graph.links });
    console.log(`[dots-sleep] informe ${report.day}: ${report.proposals.length} propuestas`);
    // Revisión nocturna con Jev (si hay llave). Solo anota confianza y urgencia; no cambia notas. JEV_NIGHTLY_DISABLED=1 la apaga.
    const provider = configuredProvider();
    if (provider && isPrimaryBrain() && process.env.JEV_NIGHTLY_DISABLED !== '1') {
      const sleepDir = getSleepDir(vaultPath);
      reviewProposals(provider, report.proposals, (graph.allNodes || graph.nodes) as any)
        .then((out) => {
          saveReviews(sleepDir, out.reviews, new Set(report.proposals.map((p) => p.id)));
          const { withChange } = require('./journal');
          return withChange(vaultPath, { actor: 'Jev (automático)', via: 'ciclo-nocturno', action: 'auto-aplicar' }, () => autoApply(vaultPath, report.proposals, out.reviews, (graph.allNodes || graph.nodes) as any))
            .then(({ result: auto }: { result: ReturnType<typeof autoApply> }) => { if (auto.applied.length) console.log(`[jev] aplicó solo ${auto.applied.length} cambios en ${report.day}`); return out; });
        })
        .then((out) => {
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

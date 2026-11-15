/**
 * ¿Jev acierta cuando duda? Lee los casos y el diario de una bóveda (SOLO LECTURA) y arma el informe de calibración.
 * Uso:  SMJ_VAULT_PATH=<bóveda> npx tsx scripts/jev-calibracion.ts [--umbral 0.6] [--json]
 * Para ver producción hay que apuntar a una copia de sus datos (dots-sleep/cerebro/requests.json y el diario); este script no escribe nada.
 */
export {};
process.env.SMJ_VAULT_PATH ||= 'vault';

async function main() {
  const { listRequests } = await import('../src/lib/cerebro/engine');
  const { loadSettings } = await import('../src/lib/cerebro/settings');
  const { readJournal } = await import('../src/lib/journal');
  const { calibrate, formatCalibration } = await import('../src/lib/cerebro/jevcal');
  const vault = process.env.SMJ_VAULT_PATH as string;
  const i = process.argv.indexOf('--umbral'); const umbral = i > 0 ? Number(process.argv[i + 1]) : loadSettings(vault).threshold;
  if (!Number.isFinite(umbral) || umbral < 0.3 || umbral > 1) { console.error('--umbral debe estar entre 0.3 y 1'); process.exit(2); }
  const undone = new Set(readJournal(vault, { limit: 100000 }).filter((e: any) => e.undoneAt).map((e: any) => String(e.id)));
  const c = calibrate(listRequests(vault), undone, umbral);
  console.log(process.argv.includes('--json') ? JSON.stringify(c, null, 2) : formatCalibration(c));
}
main().catch(e => { console.error(e); process.exit(1); });

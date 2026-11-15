/**
 * ¿Por qué esperan los pedidos, y cuántas de esas esperas aprobaste tal cual? Lee los casos y el diario de una bóveda (SOLO LECTURA).
 * Es la base para decidir qué aflojar: una categoría que se aprueba casi siempre es una aprobación de más.
 * Uso:  SMJ_VAULT_PATH=<bóveda> npx tsx scripts/esperas.ts [--json]
 * Para ver producción hay que apuntar a una copia de sus datos (dots-sleep/cerebro/requests.json y el diario); este script no escribe nada.
 */
export {};
process.env.SMJ_VAULT_PATH ||= 'vault';

async function main() {
  const { listRequests } = await import('../src/lib/cerebro/engine');
  const { readJournal } = await import('../src/lib/journal');
  const { waitStats, formatWaitStats } = await import('../src/lib/cerebro/decision');
  const vault = process.env.SMJ_VAULT_PATH as string;
  const undone = new Set(readJournal(vault, { limit: 100000 }).filter((e: any) => e.undoneAt).map((e: any) => String(e.id)));
  const w = waitStats(listRequests(vault), undone);
  console.log(process.argv.includes('--json') ? JSON.stringify(w, null, 2) : formatWaitStats(w));
}
main().catch(e => { console.error(e); process.exit(1); });

import path from 'node:path';
import { createBackup, restoreBackup } from '../src/lib/localBackup';
const root = path.resolve('.local-data');
function local(value: string) {
  const resolved = path.resolve(value);
  if (!resolved.startsWith(root + path.sep)) throw new Error('Solo se admiten archivos dentro de .local-data.');
  return resolved;
}
async function main() {
  const [action, source, destination] = process.argv.slice(2);
  if (action === 'backup' && source) console.log(await createBackup(local(source)));
  else if (action === 'restore' && source && destination) { await restoreBackup(local(source), local(destination)); console.log('Restaurado a archivo nuevo, sin reemplazar la base activa.'); }
  else throw new Error('Uso: tsx scripts/backup-local.ts backup <base> | restore <snapshot> <destino nuevo>');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

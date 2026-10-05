import { readFile, writeFile } from 'node:fs/promises';
import { prepareLegacyImport } from '../src/lib/legacySupabaseMigration';

async function main() {
  const [source, sha256, destination] = process.argv.slice(2);
  if (!source || !sha256 || !destination) throw new Error('Uso: tsx scripts/prepare-supabase-import.ts export.json SHA256_VERIFICADO destino-nuevo.json');
  const bundle = prepareLegacyImport(await readFile(source), sha256);
  // Contains private data: never print rows/credentials; never overwrite any existing file.
  await writeFile(destination, JSON.stringify(bundle, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ prepared: true, readyForProduction: false, externalActions: false, sourceRowCounts: bundle.sourceRowCounts, audit: bundle.audit }));
}
main().catch(() => { console.error('Preparación rechazada. Verifica exportación completa, hash y destino nuevo; no se conectó ninguna base.'); process.exitCode = 1; });

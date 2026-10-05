import { readFileSync } from 'node:fs';
import { auditExistingService, auditUpgradeDatabase } from '../src/lib/deploymentPreparation';
// Accepts an existing isolated export or stdin; never loads .env or dbService.
try {
  const input = process.argv[2];
  const database = input ? JSON.parse(readFileSync(input === '--stdin' ? 0 : input, 'utf8')) : undefined;
  console.log(JSON.stringify({ existingService: auditExistingService(), database: database ? auditUpgradeDatabase(database) : null, productionInspected: false, deploymentPerformed: false }, null, 2));
} catch { console.error('No se pudo auditar la exportación; no se escribió, conectó ni desplegó.'); process.exitCode = 1; }

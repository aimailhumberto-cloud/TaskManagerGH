import { promises as fs } from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import type { DatabaseSchema } from '@/services/mockData';

export function validateDatabase(value: any): asserts value is DatabaseSchema {
  if (!value || typeof value !== 'object' || !['companies', 'people', 'tasks'].every(key => Array.isArray(value[key]))) throw new Error('Base inválida: se conserva el archivo original.');
  for (const key of ['companies', 'people', 'tasks', 'users', 'projects', 'reminders', 'decisions', 'dayPlans', 'automations', 'heroPreferences']) {
    const records = value[key];
    if (records === undefined && ['users', 'projects', 'reminders', 'decisions', 'dayPlans', 'automations', 'heroPreferences'].includes(key)) continue;
    if (!Array.isArray(records) || records.some(item => !item || typeof item.id !== 'string') || new Set(records.map(item => item.id)).size !== records.length) throw new Error(`Colección inválida: ${key}`);
  }
}
export async function createBackup(databasePath: string): Promise<string> {
  const bytes = await fs.readFile(databasePath);
  validateDatabase(JSON.parse(bytes.toString('utf8')));
  const directory = path.join(path.dirname(databasePath), 'backups');
  await fs.mkdir(directory, { recursive: true });
  const filename = path.join(directory, `${path.basename(databasePath)}.${Date.now()}-${randomUUID()}.snapshot.json`);
  const checksum = createHash('sha256').update(bytes).digest('hex');
  await fs.writeFile(filename, bytes, { flag: 'wx' });
  await fs.writeFile(filename + '.manifest.json', JSON.stringify({ version: 1, createdAt: new Date().toISOString(), sha256: checksum, filename: path.basename(filename) }), { flag: 'wx' });
  return filename;
}
export async function restoreBackup(snapshot: string, destination: string): Promise<void> {
  if (path.resolve(snapshot) === path.resolve(destination)) throw new Error('El destino debe ser un archivo nuevo.');
  const bytes = await fs.readFile(snapshot);
  const manifest = JSON.parse(await fs.readFile(snapshot + '.manifest.json', 'utf8'));
  if (manifest.version !== 1 || manifest.sha256 !== createHash('sha256').update(bytes).digest('hex')) throw new Error('El respaldo no supera la verificación de integridad.');
  validateDatabase(JSON.parse(bytes.toString('utf8')));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes, { flag: 'wx' }); // Never overwrite an active database.
}

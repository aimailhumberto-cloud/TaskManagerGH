import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Respaldo del vault en el mismo disco persistente.
 * - Una foto diaria automática antes de la primera escritura del día (hora de Panamá).
 * - Fotos manuales bajo demanda.
 * - Cada foto se arma en una carpeta temporal y se renombra al final (nunca queda a medias).
 * - Se conservan las más recientes; las viejas se podan.
 * Protege contra escrituras malas o borrados; NO protege contra la pérdida del disco.
 */

export const MAX_SNAPSHOTS = 14;
const SNAPSHOT_RE = /^\d{8}-\d{6}-[a-z]+(-[0-9a-f]{4})?$/;

export type SnapshotInfo = {
  name: string;
  createdAt: string;
  reason: string;
  files: number;
  bytes: number;
};

export function getBackupRoot(vaultPath: string): string {
  return path.join(path.dirname(path.resolve(vaultPath)), 'vault-backups');
}

function panamaStamp(now: Date): { day: string; time: string } {
  // Panamá es UTC-5 todo el año
  const p = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString();
  return { day: p.slice(0, 10).replace(/-/g, ''), time: p.slice(11, 19).replace(/:/g, '') };
}

function copyTree(src: string, dest: string, acc: { files: number; bytes: number }) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to, acc);
    } else if (entry.isFile()) {
      if (entry.name.includes('.tmp-')) continue; // restos de escrituras atómicas
      fs.copyFileSync(from, to);
      acc.files++;
      acc.bytes += fs.statSync(to).size;
    }
  }
}

export function listVaultSnapshots(vaultPath: string): SnapshotInfo[] {
  const root = getBackupRoot(vaultPath);
  if (!fs.existsSync(root)) return [];
  const out: SnapshotInfo[] = [];
  for (const name of fs.readdirSync(root)) {
    if (!SNAPSHOT_RE.test(name)) continue;
    const manifestPath = path.join(root, name, 'manifest.json');
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      out.push({ name, createdAt: String(m.createdAt || ''), reason: String(m.reason || ''), files: Number(m.files || 0), bytes: Number(m.bytes || 0) });
    } catch {
      // foto sin manifiesto = incompleta; se ignora
    }
  }
  return out.sort((a, b) => (a.name < b.name ? 1 : -1));
}

function pruneSnapshots(vaultPath: string, keep: number) {
  const root = getBackupRoot(vaultPath);
  const all = listVaultSnapshots(vaultPath);
  for (const old of all.slice(keep)) {
    try {
      fs.rmSync(path.join(root, old.name), { recursive: true, force: true });
    } catch {
      // se reintentará en la próxima foto
    }
  }
}

export function createVaultSnapshot(
  vaultPath: string,
  reason: 'diario' | 'manual' = 'manual',
  now: Date = new Date()
): { ok: true; snapshot: SnapshotInfo } | { ok: false; error: string } {
  try {
    if (!fs.existsSync(vaultPath)) return { ok: false, error: 'El vault no existe' };
    const root = getBackupRoot(vaultPath);
    fs.mkdirSync(root, { recursive: true });
    const { day, time } = panamaStamp(now);
    let name = `${day}-${time}-${reason}`;
    if (fs.existsSync(path.join(root, name))) name = `${name}-${crypto.randomBytes(2).toString('hex')}`;
    const tmp = path.join(root, `.armando-${name}-${crypto.randomBytes(3).toString('hex')}`);
    const acc = { files: 0, bytes: 0 };
    try {
      copyTree(vaultPath, path.join(tmp, 'vault'), acc);
      const info: SnapshotInfo = { name, createdAt: now.toISOString(), reason, files: acc.files, bytes: acc.bytes };
      fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(info, null, 2));
      fs.renameSync(tmp, path.join(root, name));
      pruneSnapshots(vaultPath, MAX_SNAPSHOTS);
      return { ok: true, snapshot: info };
    } catch (err: any) {
      fs.rmSync(tmp, { recursive: true, force: true });
      return { ok: false, error: String(err?.message || err) };
    }
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}

let lastCheckedDay = '';

/**
 * Llamar antes de cualquier escritura al vault. Barato: tras la primera vez del día
 * solo compara un string en memoria. Nunca lanza error: un respaldo fallido no debe
 * bloquear el trabajo, pero se devuelve el motivo para registrarlo.
 */
export function ensureDailySnapshot(vaultPath: string, now: Date = new Date()): { created: boolean; error?: string } {
  const { day } = panamaStamp(now);
  if (lastCheckedDay === `${vaultPath}|${day}`) return { created: false };
  try {
    const already = listVaultSnapshots(vaultPath).some((s) => s.name.startsWith(day));
    if (already) {
      lastCheckedDay = `${vaultPath}|${day}`;
      return { created: false };
    }
    const res = createVaultSnapshot(vaultPath, 'diario', now);
    if (!res.ok) return { created: false, error: res.error };
    lastCheckedDay = `${vaultPath}|${day}`;
    return { created: true };
  } catch (err: any) {
    return { created: false, error: String(err?.message || err) };
  }
}

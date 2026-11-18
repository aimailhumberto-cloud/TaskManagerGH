/**
 * Guardado de los store checks: una carpeta propia junto al vault (en Render, el disco persistente /data),
 * nunca dentro del vault. Un archivo por visita, fotos en su subcarpeta, y el catálogo de productos.
 *   <dir>/catalog.json · <dir>/visits/<id>.json · <dir>/photos/<id>/<foto>.jpg
 * STORE_CHECKS_DIR (ruta absoluta) la cambia.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Catalog, DEFAULT_CATALOG, Photo, PHOTO_TAGS, Visit, cleanCatalog, isId } from './storeCheck';

export class StoreCheckError extends Error { constructor(message: string, public status = 400) { super(message); } }

export function storeChecksDir(): string {
  const configured = process.env.STORE_CHECKS_DIR;
  if (configured) { if (!path.isAbsolute(configured)) throw new StoreCheckError('STORE_CHECKS_DIR debe ser una ruta absoluta.', 500); return path.resolve(configured); }
  const { getPrimaryVaultPath } = require('./smjBrainService');
  return path.join(path.dirname(path.resolve(getPrimaryVaultPath())), 'store-checks');
}
const visitsDir = () => path.join(storeChecksDir(), 'visits');
const photosDir = (id: string) => path.join(storeChecksDir(), 'photos', id);

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2)); fs.renameSync(tmp, file);
}
function readJson<T>(file: string): T | null { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }

// ---------- catálogo ----------
export function getCatalog(): Catalog { return readJson<Catalog>(path.join(storeChecksDir(), 'catalog.json')) || DEFAULT_CATALOG; }
export function saveCatalog(input: unknown): Catalog {
  const c = cleanCatalog(input);
  if (!c.products.length) throw new StoreCheckError('El catálogo necesita al menos un producto.');
  writeJson(path.join(storeChecksDir(), 'catalog.json'), c); return c;
}

// ---------- visitas ----------
export function getVisit(id: string): Visit | null { return isId(id) ? readJson<Visit>(path.join(visitsDir(), `${id}.json`)) : null; }
export function listVisits(): Visit[] {
  let files: string[] = []; try { files = fs.readdirSync(visitsDir()).filter(f => f.endsWith('.json')); } catch { return []; }
  return files.map(f => readJson<Visit>(path.join(visitsDir(), f))).filter((v): v is Visit => !!v?.id).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
}
export function saveVisit(v: Visit): Visit {
  if (!isId(v.id)) throw new StoreCheckError('Visita no válida.');
  if (!v.store.name) throw new StoreCheckError('Escribe el nombre de la tienda.');
  writeJson(path.join(visitsDir(), `${v.id}.json`), v); return v;
}
export function deleteVisit(id: string) {
  if (!getVisit(id)) throw new StoreCheckError('Visita no encontrada.', 404);
  fs.rmSync(path.join(visitsDir(), `${id}.json`), { force: true });
  fs.rmSync(photosDir(id), { recursive: true, force: true });
}

// ---------- fotos ----------
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS_PER_VISIT = 80;
const KINDS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
export const photoMime = (file: string) => ({ jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' } as Record<string, string>)[file.split('.').pop() || ''] || 'application/octet-stream';

/** Reconoce el tipo por los primeros bytes, no por lo que dice el teléfono. */
export function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp' && /^(heic|heix|hevc|mif1|msf1|heif)/.test(buf.subarray(8, 12).toString('ascii'))) return 'image/heic';
  return null;
}

export function addPhoto(visitId: string, buf: Buffer, meta: { tag?: string; productId?: string; caption?: string }): { visit: Visit; photo: Photo } {
  const v = getVisit(visitId); if (!v) throw new StoreCheckError('Primero guarda la visita.', 404);
  if (buf.length > MAX_PHOTO_BYTES) throw new StoreCheckError('La foto pasa de 10 MB.');
  const mime = sniffImage(buf); if (!mime) throw new StoreCheckError('Solo fotos (JPG, PNG, WEBP o HEIC).');
  if (v.photos.length >= MAX_PHOTOS_PER_VISIT) throw new StoreCheckError(`Máximo ${MAX_PHOTOS_PER_VISIT} fotos por visita.`);
  const id = `f${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
  const file = `${id}.${KINDS[mime]}`;
  fs.mkdirSync(photosDir(visitId), { recursive: true });
  fs.writeFileSync(path.join(photosDir(visitId), file), buf, { flag: 'wx' });
  const tag = (PHOTO_TAGS as readonly string[]).includes(String(meta.tag)) ? (meta.tag as Photo['tag']) : 'general';
  const photo: Photo = { id, file, tag, productId: String(meta.productId || '').slice(0, 60), caption: String(meta.caption || '').slice(0, 200), at: new Date().toISOString(), size: buf.length };
  v.photos = [...v.photos, photo]; v.updatedAt = photo.at;
  saveVisit(v); return { visit: v, photo };
}
export function removePhoto(visitId: string, photoId: string): Visit {
  const v = getVisit(visitId); if (!v) throw new StoreCheckError('Visita no encontrada.', 404);
  const p = v.photos.find(x => x.id === photoId); if (!p) throw new StoreCheckError('Foto no encontrada.', 404);
  fs.rmSync(path.join(photosDir(visitId), p.file), { force: true });
  v.photos = v.photos.filter(x => x.id !== photoId); v.updatedAt = new Date().toISOString();
  return saveVisit(v);
}
export function readPhoto(visitId: string, photoId: string): { buf: Buffer; mime: string } | null {
  const p = getVisit(visitId)?.photos.find(x => x.id === photoId); if (!p) return null;
  try { return { buf: fs.readFileSync(path.join(photosDir(visitId), p.file)), mime: photoMime(p.file) }; } catch { return null; }
}

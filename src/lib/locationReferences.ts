import type { MarinePoint } from './workspaceLayers';
export function validCoordinates(latitude: string, longitude: string) {
  return !!latitude.trim() && !!longitude.trim() && Number.isFinite(Number(latitude)) && Math.abs(Number(latitude)) <= 90 && Number.isFinite(Number(longitude)) && Math.abs(Number(longitude)) <= 180;
}
export function marinePoint(value: unknown): MarinePoint | null {
  if (value == null) return null;
  const p = value as MarinePoint;
  if (typeof p.label !== 'string' || !p.label.trim() || p.label.length > 120 || typeof p.latitude !== 'string' || typeof p.longitude !== 'string' || p.latitude.length > 30 || p.longitude.length > 30 || !validCoordinates(p.latitude, p.longitude)) throw new Error('Elige nombre y coordenadas válidas del punto marino.');
  return { label: p.label.trim(), latitude: p.latitude.trim(), longitude: p.longitude.trim() };
}

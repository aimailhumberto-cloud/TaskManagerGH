import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { dbService } from '@/services/dbService';
import { readEnvironment } from '@/lib/environmentWidgets';
import { marinePoint, validCoordinates } from '@/lib/locationReferences';
export const dynamic = 'force-dynamic';
const cache = new Map<string, { at: number; reading: Awaited<ReturnType<typeof readEnvironment>> }>();
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request); if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (process.env.TASKMANAGER_LOCAL_ONLY !== '1') return NextResponse.json({ error: 'Fuente preparada solo para la app local privada.' }, { status: 403 });
  try {
    const preference = (await dbService.readData()).heroPreferences?.find(p => p.ownerId === auth.session!.personId);
    const device = request.nextUrl.searchParams.get('reference') === 'device';
    if (!device && !preference?.widgetsEnabled) return NextResponse.json({ error: 'Casa está apagada; elige y guarda un lugar explícitamente.' }, { status: 400 });
    const latitude = device ? request.nextUrl.searchParams.get('latitude') || '' : preference!.latitude;
    const longitude = device ? request.nextUrl.searchParams.get('longitude') || '' : preference!.longitude;
    let point;
    try { point = device ? marinePoint(request.nextUrl.searchParams.has('marineLatitude') ? { label: request.nextUrl.searchParams.get('marineLabel'), latitude: request.nextUrl.searchParams.get('marineLatitude'), longitude: request.nextUrl.searchParams.get('marineLongitude') } : null) : marinePoint(preference!.homeMarine || null); } catch { return NextResponse.json({ error: 'Punto marino inválido.' }, { status: 400 }); }
    if (!validCoordinates(latitude, longitude)) return NextResponse.json({ error: 'Elige coordenadas meteorológicas válidas.' }, { status: 400 });
    const key = `${auth.session!.personId}:${device ? 'device' : 'home'}:${latitude}:${longitude}:${JSON.stringify(point)}`; const old = cache.get(key);
    if (old && Date.now() - old.at < 15 * 60 * 1000) return NextResponse.json(old.reading, { headers: { 'Cache-Control': 'no-store' } });
    const reading = await readEnvironment(latitude, longitude, fetch, point);
    if (!point) reading.marineError = 'Oleaje sin consultar: falta elegir explícitamente un punto marino; la ubicación terrestre no se usa como playa.';
    if (reading.weather || reading.marine) { cache.clear(); cache.set(key, { at: Date.now(), reading }); }
    return NextResponse.json(reading, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'No se pudo consultar la fuente. No se cambió la ubicación ni la lectura guardada.' }, { status: 503 }); }
}

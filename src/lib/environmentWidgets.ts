export interface EnvironmentReading { observedAt: string; modelAt: string; values: Record<string, number | null>; units: Record<string, string>; source: string; sourceUrl: string; grid: { latitude: number; longitude: number } }
export async function readEnvironment(latitude: string, longitude: string, fetcher: typeof fetch = fetch, marineLocation: { latitude: string; longitude: string } | null | undefined = undefined) {
  if (!latitude || !longitude || !Number.isFinite(Number(latitude)) || Math.abs(Number(latitude)) > 90 || !Number.isFinite(Number(longitude)) || Math.abs(Number(longitude)) > 180) throw new Error('Ubicación no válida.');
  if (marineLocation && (!marineLocation.latitude || !marineLocation.longitude || !Number.isFinite(Number(marineLocation.latitude)) || Math.abs(Number(marineLocation.latitude)) > 90 || !Number.isFinite(Number(marineLocation.longitude)) || Math.abs(Number(marineLocation.longitude)) > 180)) throw new Error('Punto marino no válido.');
  const read = async (host: string, variables: string, sourceUrl: string): Promise<EnvironmentReading> => {
    const url = new URL('/v1/' + (host.startsWith('marine') ? 'marine' : 'forecast'), `https://${host}`);
    const point = host.startsWith('marine') && marineLocation ? marineLocation : { latitude, longitude };
    url.search = new URLSearchParams({ ...point, current: variables, timezone: 'America/Panama', timeformat: 'unixtime', forecast_days: '1' }).toString();
    if (host.startsWith('marine')) url.searchParams.set('cell_selection', 'sea');
    const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(12000), cache: 'no-store' });
    if (!response.ok) throw new Error('La fuente no pudo responder.'); const body = await response.json(); const modelTime = body?.current?.time;
    if (!Number.isFinite(modelTime) || !body.current_units || !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) throw new Error('Lectura de la fuente incompleta.');
    const values = Object.fromEntries(variables.split(',').map(key => [key, typeof body.current[key] === 'number' && Number.isFinite(body.current[key]) ? body.current[key] : null]));
    return { observedAt: new Date().toISOString(), modelAt: new Date(modelTime * 1000).toISOString(), values, units: body.current_units, source: 'Open-Meteo · modelo', sourceUrl, grid: { latitude: body.latitude, longitude: body.longitude } };
  };
  const results = await Promise.allSettled([read('api.open-meteo.com', 'temperature_2m,wind_speed_10m', 'https://open-meteo.com/en/docs'), marineLocation === null ? Promise.reject(new Error('Punto marino pendiente')) : read('marine-api.open-meteo.com', 'wave_height,wave_period,wave_direction', 'https://open-meteo.com/en/docs/marine-weather-api')]);
  return { weather: results[0].status === 'fulfilled' ? results[0].value : null, marine: results[1].status === 'fulfilled' ? results[1].value : null, weatherError: results[0].status === 'rejected' ? 'Clima no disponible; conserva la lectura anterior.' : '', marineError: results[1].status === 'rejected' ? 'Mar no disponible; conserva la lectura anterior.' : '' };
}

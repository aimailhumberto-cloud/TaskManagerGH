// Se ejecuta una vez cuando arranca el servidor (no en el navegador ni en el build).
export async function register() {
  // Patrón que Next.js exige para que el código de Node (fs, etc.) no entre al runtime edge.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startNightlyDotsSleep } = await import('./lib/dotsSleepScheduler');
    startNightlyDotsSleep();
  }
}

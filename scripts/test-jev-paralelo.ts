/**
 * Etapa 5.0: el motivo de Jev ya no se comparte entre temas que se piensan en paralelo.
 * Antes el motivo y el problema vivían en variables del módulo: dos juicios a la vez se pisaban y un tema heredaba el motivo de otro.
 * Aquí Jev es simulado (sin red): el tema A responde rápido «falta algo»; el tema B responde más lento «bien».
 * Uso: npx tsx scripts/test-jev-paralelo.ts
 */
export {}; // módulo propio: sus nombres no chocan con los de otros scripts
process.env.SMJ_VAULT_PATH ||= 'vault';
process.env.TYPESAFE_API_KEY = 'llave-de-prueba';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const { judge } = await import('../src/lib/cerebro/jev');
  const real = globalThis.fetch;
  const answer = (motivo: string, score: number) => new Response(JSON.stringify({ model: 'jev-prueba', answers: { fiel: { type: 'score', score, confidence: 0.9 }, motivo: { type: 'choice', choice: motivo, confidence: 0.9 } }, usage: {} }), { status: 200 });
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const state = String(JSON.parse(String(init?.body)).state);
    if (state.includes('TEMA-A')) { await sleep(10); return answer('falta', 1); }
    if (state.includes('TEMA-B')) { await sleep(80); return answer('bien', 3); }
    if (state.includes('TEMA-C')) { await sleep(5); return new Response('{}', { status: 401 }); }
    return new Response('{}', { status: 500 });
  }) as typeof fetch;
  try {
    const [a, b] = await Promise.all([judge('TEMA-A pedido', ['1. algo']), judge('TEMA-B pedido', ['1. algo'])]);
    t('tema A: puntaje propio', a.score !== null && Math.abs(a.score - 1 / 3) < 1e-9, JSON.stringify(a));
    t('tema A: trae su motivo («falta algo»)', /falta algo|missing something/.test(a.reason), a.reason);
    t('tema B: puntaje propio', b.score === 1, JSON.stringify(b));
    t('tema B: NO hereda el motivo del tema A', b.reason === '', `B recibió «${b.reason}»`);
    t('sin problema cuando Jev responde', a.problem === '' && b.problem === '');
    // Un fallo de un tema no se le pega a otro que sí respondió.
    const [c, b2] = await Promise.all([judge('TEMA-C pedido', ['1. algo']), judge('TEMA-B pedido', ['1. algo'])]);
    t('tema C: sin puntaje y con su problema', c.score === null && c.problem.length > 0, JSON.stringify(c));
    t('tema B junto a un fallo: sin problema', b2.score === 1 && b2.problem === '', JSON.stringify(b2));
  } finally { globalThis.fetch = real; }
  console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });

/**
 * Corre los casos sucios del banco (16 a 22) contra producción como ENSAYO (dryRun: no guarda nada) con la llave del agente,
 * y los juzga con los mismos verificadores de bank.ts. Solo lectura. Uso: AGENT_API_KEY=<llave> npx tsx scripts/banco-remoto.ts [n n n]  (por defecto, los casos 16 en adelante)
 */
process.env.SMJ_VAULT_PATH ||= 'vault';
async function main() {
  const { bankCases } = await import('../src/lib/cerebro/bank');
  const only = process.argv.slice(2).map(Number).filter(Boolean);
  const cases = bankCases().filter(c => (only.length ? only.includes(c.n) : c.n >= 16));
  const key = process.env.AGENT_API_KEY || '';
  const out = await Promise.all(cases.map(async c => {
    const t0 = Date.now();
    try {
      const res = await fetch('https://taskmanagergh.onrender.com/api/agent/cerebro', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${key}` }, body: JSON.stringify({ action: 'pedir', text: c.text, ...(c.md ? { md: c.md } : {}), dryRun: true }) });
      const j: any = await res.json();
      const parts = j.multi ? (j.parts as any[]) : []; const r = j.multi ? j.parts[0] : j;
      const bad = c.check(r, parts);
      return { n: c.n, nombre: c.nombre, ok: !bad, detalle: bad || 'bien', seg: Math.round((Date.now() - t0) / 1000), estado: j.multi ? `varios (${parts.length})` : r.status, ops: (j.multi ? parts : [r]).flatMap((x: any) => (x.ops || []).map((o: any) => o.name)).join(','), msg: r.status === 'pregunta' ? String(r.message || '').slice(0, 110) : undefined };
    } catch (e: any) { return { n: c.n, nombre: c.nombre, ok: false, detalle: `falló: ${String(e?.message || e).slice(0, 120)}`, seg: Math.round((Date.now() - t0) / 1000), estado: 'error', ops: '' }; }
  }));
  console.log(JSON.stringify({ aciertos: out.filter(x => x.ok).length, total: out.length, resultados: out }, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });

import * as fs from 'fs'; import * as os from 'os'; import * as path from 'path';
import * as D from '../src/lib/decisionEngine';
let fail = 0;
const eq = (n: string, a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.error('FALLA', n, JSON.stringify(a), '!=', JSON.stringify(b)); } };
const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const good = { model: 'jev-1.14.0', answers: { apply: { type: 'noul', noul: 0.91 }, urgency: { type: 'score', score: 1.6, confidence: 0.7 } }, usage: { input_tokens: 300, output_tokens: 20 } };
(async () => {
  // parseAnswers descarta lo que no cuadra
  const q = { a: { type: 'noul', instructions: 'x' }, b: { type: 'choice', instructions: 'x', criteria: { si: 's', no: 'n' } }, c: { type: 'score', instructions: 'x', criteria: ['0', '1', '2'] } } as Record<string, D.Question>;
  eq('parse ok', Object.keys(D.parseAnswers({ a: { type: 'noul', noul: 0.4 }, b: { type: 'choice', choice: 'si', confidence: 0.9 }, c: { type: 'score', score: 2, confidence: 1 } }, q)), ['a', 'b', 'c']);
  eq('opción inventada', D.parseAnswers({ b: { type: 'choice', choice: 'quizas', confidence: 0.9 } }, q), {});
  eq('tipo cambiado', D.parseAnswers({ a: { type: 'choice', choice: 'si', confidence: 1 } }, q), {});
  eq('score fuera', D.parseAnswers({ c: { type: 'score', score: 5, confidence: 1 } }, q), {});
  eq('noul recortado', (D.parseAnswers({ a: { type: 'noul', noul: 1.7 } }, q).a as any).noul, 1);
  eq('noul texto', D.parseAnswers({ a: { type: 'noul', noul: 'alto' } }, q), {});

  // proveedor: cabeceras, cuerpo, reintento, errores
  let seen: any = null, calls = 0;
  const ok = D.jevProvider('KEY-SECRETA', { fetcher: async (u, i) => { seen = { u, i }; calls++; return res(200, good); } });
  const r = await ok.decide('estado', D.REVIEW_QUESTIONS);
  eq('url', seen.u, D.JEV_URL); eq('bearer', (seen.i.headers as any).Authorization, 'Bearer KEY-SECRETA');
  eq('modelo', JSON.parse(seen.i.body).model, 'jev-latest'); eq('respuesta', (r.answers.apply as any).noul, 0.91); eq('modelo real', r.model, 'jev-1.14.0');
  const long = await ok.decide('x'.repeat(50000), D.REVIEW_QUESTIONS); void long;
  eq('estado recortado', JSON.parse(seen.i.body).state.length, D.MAX_STATE_CHARS);
  calls = 0;
  const flaky = D.jevProvider('k', { fetcher: async () => (++calls === 1 ? res(503, {}) : res(200, good)) });
  eq('reintenta 5xx', (await flaky.decide('s', D.REVIEW_QUESTIONS)).model, 'jev-1.14.0'); eq('2 llamadas', calls, 2);
  const status = async (code: number) => { try { await D.jevProvider('k', { fetcher: async () => res(code, {}) }).decide('s', D.REVIEW_QUESTIONS); return 0; } catch (e: any) { return e.status; } };
  eq('401', await status(401), 401); eq('402', await status(402), 402); eq('500 persistente', await status(500), 503); eq('400', await status(400), 502);
  const msg = await D.jevProvider('KEY-SECRETA', { fetcher: async () => res(401, {}) }).decide('s', D.REVIEW_QUESTIONS).catch(e => e.message);
  eq('error sin llave', String(msg).includes('KEY-SECRETA'), false);
  eq('caída de red', await D.jevProvider('k', { fetcher: async () => { throw new Error('net'); } }).decide('s', D.REVIEW_QUESTIONS).catch(e => e.status), 503);

  // estado y revisión
  const props = [{ id: 'p1', kind: 'enlace_roto', title: 'T', reason: 'R', suggestion: 'S', nodeIds: ['n1', 'nx'] }, { id: 'p2', kind: 'nodo_aislado', title: 'T2', reason: 'R', suggestion: 'S', nodeIds: [] }];
  const nodes = [{ id: 'n1', title: 'Nodo', type: 'person', body: 'b'.repeat(5000) }];
  const st = JSON.parse(D.proposalState(props[0], nodes));
  eq('texto recortado', st.notes[0].text.length, 1500); eq('nodo ausente', st.notes[1].missing, true);
  const rev = await D.reviewProposals(ok, props, nodes, new Date('2026-11-12T10:00:00Z'));
  eq('revisadas', rev.reviewed, 2); eq('apply', rev.reviews.p1.apply, 0.91); eq('urgencia', rev.reviews.p2.urgency, 1.6); eq('tokens', rev.usage.input_tokens, 600);
  let n = 0;
  const bad = await D.reviewProposals(D.jevProvider('k', { fetcher: async () => { n++; return res(401, {}); } }), Array.from({ length: 30 }, (_, i) => ({ ...props[0], id: 'q' + i })), nodes);
  eq('401 corta', bad.reviewed, 0); eq('pocas llamadas', n <= 4, true); eq('un error', bad.errors.length, 1);
  const many = await D.reviewProposals(ok, Array.from({ length: 55 }, (_, i) => ({ ...props[0], id: 'm' + i })), nodes);
  eq('tope', many.reviewed, D.MAX_REVIEW); eq('omitidas', many.skipped, 15);

  // almacenamiento
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dec-'));
  D.saveReviews(dir, rev.reviews); eq('carga', Object.keys(D.loadReviews(dir)).sort(), ['p1', 'p2']);
  D.saveReviews(dir, {}, new Set(['p2'])); eq('poda', Object.keys(D.loadReviews(dir)), ['p2']);
  D.logCall(dir, { action: 'ping', ok: true, model: 'm', ms: 5 }); eq('log', (D.lastLog(dir) as any).action, 'ping');
  eq('log sin contenido', fs.readFileSync(path.join(dir, 'ai-log.jsonl'), 'utf8').includes('state'), false);
  eq('sin llave no hay proveedor', (delete process.env.TYPESAFE_API_KEY, D.configuredProvider()), null);
  if (fail) { console.error(fail + ' fallas'); process.exit(1); } console.log('decision engine: todo ok');
})();

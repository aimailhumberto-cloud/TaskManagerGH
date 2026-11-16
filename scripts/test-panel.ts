/**
 * El Cerebro en el tablero de inicio: la noche en «Sueño y limpieza», «Dónde hubo movimiento» y «Qué necesita tu atención».
 * Carpeta temporal; sin red. Uso: npx tsx scripts/test-panel.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panel-'));
  const vault = path.join(root, 'vault'); fs.mkdirSync(vault, { recursive: true });
  process.env.SMJ_VAULT_PATH = vault; process.chdir(root);
  const P = await import('../src/lib/cerebro/panel');
  const G = await import('../src/lib/brainGrowth');
  const nightDir = path.join(root, 'dots-sleep', 'night'); fs.mkdirSync(nightDir, { recursive: true });
  const night = (runDay: string, dia: string, o: any = {}) => ({
    corridaEl: `${runDay}T07:17:00.000Z`, dia, corridaDia: runDay, errores: [], texto: `Ayer (${dia}) entraron ${o.entraron ?? 0} pedidos.\nFalta: nada.`,
    digest: { dia, entraron: o.entraron ?? 0, cerrados: { guardados: o.guardados ?? 0, sinCambios: 0, cancelados: 0, rechazados: 0, fallos: 0, otros: 0 }, guardadosSolos: o.solos ?? 0, aprobadosPorPersona: o.aprobados ?? 0, avanzados: o.avanzados ?? [], abiertos: { preguntas: o.preguntas ?? 0, esperandoAprobacion: o.porAprobar ?? 0, esperaMasDe24h: 0, esperaPorCategoria: {}, masViejoDias: o.masViejo ?? null } },
    auditoria: { nodos: 10, tiposFuera: [{ tipo: 'site', n: 11 }], relacionesFuera: [{ relacion: 'has_listing', n: 12 }, { relacion: 'observed_contacts', n: 10 }], camposFuera: [], sinClasificar: { fichas: 0, campos: 0 }, sueltas: { n: o.sueltas ?? 0, ejemplos: [] }, duplicados: { n: o.duplicados ?? 0, ejemplos: [] }, casosViejosSinFormato: 0 },
    ...(o.sesion === false ? {} : { sesion: { archivo: 'x.md', escrita: true } }),
  });

  // ================= A. La noche en números =================
  t('A1 sin noche no hay tarjeta', P.nightCard(null) === null);
  const c = P.nightCard(night('2026-11-16', '2026-11-15', { entraron: 12, guardados: 10, solos: 5, aprobados: 5, preguntas: 3, masViejo: 2, sueltas: 9 }) as any)!;
  t('A2 lleva lo que entró, lo guardado y lo que falta', c.entraron === 12 && c.guardados === 10 && c.solos === 5 && c.aprobados === 5 && c.preguntas === 3 && c.porAprobar === 0 && c.masViejoDias === 2, JSON.stringify(c));
  t('A3 lleva lo raro: sueltas, duplicados y cuántas cosas fuera de la estructura', c.sueltas === 9 && c.duplicados === 0 && c.fueraDeEstructura === 3);
  t('A4 dice qué día cubre y trae el texto completo para «ver detalle»', c.dia === '2026-11-15' && /entraron 12/.test(c.texto));
  t('A5 un resumen dañado (sin digest) no rompe el tablero', P.nightCard({ dia: 'x' } as any) === null);

  // ================= B. Noches que corrieron =================
  fs.writeFileSync(path.join(nightDir, '2026-11-16.json'), JSON.stringify(night('2026-11-16', '2026-11-15', { entraron: 12, guardados: 10 })));
  fs.writeFileSync(path.join(nightDir, '2026-11-14.json'), JSON.stringify(night('2026-11-14', '2026-11-13', { avanzados: ['a', 'b'], sesion: false })));
  fs.writeFileSync(path.join(nightDir, '2026-11-13.json'), '{dañado');
  fs.writeFileSync(path.join(nightDir, 'notas.txt'), 'no es una noche');
  const nd = P.nightDays(vault);
  t('B1 lee las noches por el día en que corrieron y salta lo dañado', Object.keys(nd).sort().join(',') === '2026-11-14,2026-11-16', JSON.stringify(nd));
  t('B2 lo que ordenó: casos que avanzó más la sesión del día', P.nightWork(nd['2026-11-16']) === 1 && P.nightWork(nd['2026-11-14']) === 2 && P.nightWork({ avanzados: 0, sesion: false }) === 0);
  t('B3 sin carpeta de noches devuelve vacío', Object.keys(P.nightDays(path.join(root, 'otra', 'vault'))).length === 0);

  // ================= C. Las barras de «Sueño y limpieza» cuentan la noche del Cerebro =================
  const g = G.computeGrowth(vault, [{ id: 'a', type: 'person', frontmatter: {} }] as any, 0, '2026-11-16');
  const bar = (d: string) => g.sleep.find(x => x.date === d)!;
  t('C1 la noche que corrió el Cerebro cuenta como dormida, aunque no haya informe de DOTS', bar('2026-11-16').slept && bar('2026-11-16').night === true && bar('2026-11-16').tidied === 1, JSON.stringify(bar('2026-11-16')));
  t('C2 y suma lo que avanzó sola', bar('2026-11-14').slept && bar('2026-11-14').tidied === 2);
  t('C3 una noche sin nada sigue sin dormir', !bar('2026-11-15').slept && bar('2026-11-15').tidied === 0 && !bar('2026-11-15').night);
  t('C4 siguen siendo 14 noches', g.sleep.length === 14);

  // ================= D. Dónde hubo movimiento =================
  const nodes = [
    { id: 'dist-medimex', title: 'Distributor: MEDIMEX', type: 'distributor', filePath: path.join(vault, '02-External-Clients', 'Distributor - MEDIMEX.md') },
    { id: 'person-anna', title: 'Person: Miss Ana Mohamed', type: 'person', filePath: path.join(vault, '01-Internal-Clients', 'Person - Anna Mohammed.md') },
    { id: 'caso-1', title: 'Caso: algo', type: 'working_memory', filePath: path.join(vault, '00-Working-Memory', 'caso-1.md') },
    { id: 'rel', title: 'Person: Relativo', type: 'person', filePath: '01-Internal-Clients/Person - Relativo.md' },
  ];
  const e = (id: string, at: string, files: string[], extra: any = {}) => ({ id, at, summary: '', files: files.map(p => ({ path: p, op: 'cambiado' as const })), ...extra });
  const MED = '02-External-Clients/Distributor - MEDIMEX.md', ANN = '01-Internal-Clients/Person - Anna Mohammed.md';
  const journal = [
    e('1', '2026-11-15T10:00:00Z', [MED]), e('2', '2026-11-15T11:00:00Z', [MED, ANN]), e('3', '2026-11-16T09:00:00Z', [MED]),
    e('4', '2026-11-16T09:30:00Z', [ANN], { undoneAt: '2026-11-16T10:00:00Z' }), e('5', '2026-11-16T10:00:00Z', [ANN], { undoOf: '4' }),
    e('6', '2026-11-01T10:00:00Z', [ANN]), e('7', '2026-11-16T11:00:00Z', ['00-Working-Memory/caso-1.md']),
    e('8', '2026-11-16T12:00:00Z', [MED.replace(/\//g, '\\'), MED]), e('9', '2026-11-16T12:30:00Z', ['01-Internal-Clients/Person - Relativo.md']),
    { id: '10', at: '2026-11-16T13:00:00Z', summary: '', files: [{ path: ANN, op: 'borrado' as const }] },
    e('11', '2026-11-16T13:30:00Z', ['no-existe.md']),
  ];
  const mv = P.movedNotes(journal as any, nodes, vault, '2026-11-10');
  t('D1 ordena por veces que se guardó algo, con el nombre sin el prefijo del tipo', mv[0]?.name === 'MEDIMEX' && mv[0].value === 4, JSON.stringify(mv));
  t('D2 un cambio deshecho y su deshacer no cuentan; fuera del periodo tampoco', mv.find(x => x.id === 'person-anna')?.value === 1, JSON.stringify(mv));
  t('D3 las notas de trabajo del Cerebro no aparecen (interesa el negocio)', !mv.some(x => x.id === 'caso-1'));
  t('D4 una ficha tocada dos veces en el mismo cambio cuenta una, y las barras de Windows no la duplican', mv[0].value === 4);
  t('D5 acepta rutas de ficha relativas', mv.some(x => x.id === 'rel' && x.value === 1));
  t('D6 un archivo que no es una ficha, o un borrado, no aparece', mv.length === 3, JSON.stringify(mv));
  t('D7 el periodo corto deja fuera lo viejo y respeta el tope', P.movedNotes(journal as any, nodes, vault, '2026-11-16').find(x => x.id === 'dist-medimex')?.value === 2 && P.movedNotes(journal as any, nodes, vault, '2026-11-10', 1).length === 1);
  t('D8 sin diario no hay movimiento', P.movedNotes([], nodes, vault, '2026-11-10').length === 0);

  // ================= E. Qué necesita tu atención =================
  const now = new Date('2026-11-16T15:00:00Z');
  const r = (id: string, status: string, at: string, text = 'pedido') => ({ id, status, at, text, by: 'Agente', via: 'llave', ops: [], plan: [] });
  const a = P.attention([r('1', 'pregunta', '2026-11-13T17:57:44Z', 'Revisa los   seguimientos\ndel 13'), r('2', 'pregunta', '2026-11-15T10:00:00Z'), r('3', 'pendiente', '2026-11-16T09:00:00Z'), r('4', 'aplicado', '2026-11-10T09:00:00Z'), r('5', 'rechazado', '2026-11-01T09:00:00Z')] as any, now);
  t('E1 cuenta lo que espera a una persona y nada más', a.porAprobar === 1 && a.preguntas === 2, JSON.stringify(a));
  t('E2 dice cuánto lleva lo más viejo y qué es, en una línea', a.masViejoDias === 2 && a.masViejo === 'Revisa los seguimientos del 13', JSON.stringify(a));
  const vacio = P.attention([r('4', 'aplicado', '2026-11-10T09:00:00Z')] as any, now);
  t('E3 sin nada abierto, todo en cero y sin fecha', vacio.porAprobar === 0 && vacio.preguntas === 0 && vacio.masViejoDias === null && !('masViejo' in vacio));
  t('E4 lo de hoy son 0 días, no negativo', P.attention([r('1', 'pendiente', '2026-11-16T14:59:00Z')] as any, now).masViejoDias === 0);
  t('E5 un texto largo se corta', (P.attention([r('1', 'pregunta', '2026-11-16T10:00:00Z', 'x'.repeat(300))] as any, now).masViejo || '').length === 90);

  try { process.chdir(os.tmpdir()); fs.rmSync(root, { recursive: true, force: true }); } catch {}
  console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });

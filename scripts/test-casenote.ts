/** Pruebas de la memoria propia: nota viva del caso y «recordar». Trabaja sobre una copia de la bóveda. Uso: npx tsx scripts/test-casenote.ts */
import * as fs from 'fs'; import * as os from 'os'; import * as path from 'path';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-')); const vault = path.join(tmp, 'vault'); fs.cpSync('vault', vault, { recursive: true });
process.env.SMJ_VAULT_PATH = vault;
(async () => {
  const { writeCaseNote, recallBlock, caseNoteRel } = await import('../src/lib/cerebro/casenote');
  let ok = 0, bad = 0; const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
  const base: any = { id: 'ped-20261115000000-aaaaaa', at: new Date().toISOString(), by: 'Agente', via: 'llave', text: 'Registra que Tomás Casas pidió ver el second brain el viernes', status: 'pregunta', ops: [], plan: [], recognized: [{ id: 'person-tomas-casas', name: 'Tomás Casas', type: 'person' }], dialog: [{ q: '¿A qué hora el viernes?' }] };
  writeCaseNote(vault, base);
  const f = path.join(vault, caseNoteRel(base.id)); const raw = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  t('la nota del caso existe en la memoria de trabajo', !!raw);
  t('es nota de trabajo del Cerebro, enlazada a la ficha', /case_note: true/.test(raw) && /\[\[person-tomas-casas\]\]/.test(raw) && /type: working_memory/.test(raw));
  t('trae el pedido y el expediente', /second brain/.test(raw) && /Expediente/.test(raw));
  t('abierta = pulsing', /status: pulsing/.test(raw));
  const r1 = recallBlock(vault, 'Llamar a Tomás Casas mañana', { by: 'Agente' });
  t('recuerda el caso abierto de la misma ficha', /caso pregunta/.test(r1) && /second brain/.test(r1), r1);
  t('no se recuerda a sí mismo', recallBlock(vault, 'Llamar a Tomás Casas mañana', { selfId: base.id, by: 'Agente' }) === '');
  t('un caso abierto de otro no se mete si no toca la ficha', recallBlock(vault, 'Comprar café para la oficina', { by: 'Otro' }) === '');
  t('un caso abierto del mismo agente se recuerda aunque no nombre la ficha', /caso pregunta/.test(recallBlock(vault, 'Comprar café para la oficina', { by: 'Agente' })));
  writeCaseNote(vault, { ...base, status: 'aplicado', results: ['Novedad en Tomás Casas'] });
  const raw2 = fs.readFileSync(f, 'utf8');
  t('al cerrarse la nota se actualiza (mismo archivo) y queda cerrada', /status: closed/.test(raw2) && /case_status: aplicado/.test(raw2));
  t('un caso cerrado ya no se cuela por «mismo agente»', recallBlock(vault, 'Comprar café para la oficina', { by: 'Agente' }) === '');
  t('pero sí por la ficha que toca', /Tomás/.test(recallBlock(vault, 'Tomás Casas otra vez', { by: 'Otro' })));
  const r3 = recallBlock(vault, 'Rajesh Maharaj y el lote Chubby', { by: 'Agente' });
  t('también recuerda las notas viejas de DOTS que tocan la ficha', /Chubby/.test(r3), r3);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
})();

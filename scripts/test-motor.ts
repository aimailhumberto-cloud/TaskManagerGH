/** Pruebas del motor interno (sin modelo): nombres ambiguos, personas nombradas, reunión completada, avisos. Uso: SMJ_VAULT_PATH=vault npx tsx scripts/test-motor.ts */
import { nameAmbiguities, peopleMentioned } from '../src/lib/brainLens';
import { inspectPlan, completeMeetings } from '../src/lib/cerebro/review';
let ok = 0, bad = 0; const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const amb = (q: string) => nameAmbiguities(q).map(a => `${a.word}:${a.kind}`);
t('Richard es ambiguo', amb('llamar a Richard').includes('richard:igual'));
t('Richard Williams completo no es ambiguo', amb('Richard Williams confirmó').length === 0);
t('Luis solo se parece a Luisa', amb('hablar con Luis').includes('luis:parecido'));
t('Luisa exacta no es ambigua', amb('hablar con Luisa').length === 0);
t('Morgan Williams (empresa) no vuelve ambiguo a Williams', amb('Jenna Hector confirmó el envío a Morgan Williams').length === 0);
t('Tomás es único', amb('reunión con Tomás').length === 0 && peopleMentioned('reunión con Tomás').some(p => p.id === 'person-tomas-casas'));
t('las casas (palabra común) no es Tomás Casas', peopleMentioned('las casas del distribuidor').length === 0);
t('Richard ambiguo no aparece como mencionado', !peopleMentioned('llamar a Richard').length);
// Reunión sin la persona → se completa
const ops = [{ name: 'agendar', args: { titulo: 'ver second brain', fecha: '2026-11-13', hora: '08:00' } }];
const added = completeMeetings(ops, 'agrega reunion para hoy con tomas para ver second brain tipo 8 am');
t('añade a Tomás a la reunión', added.length === 1 && JSON.stringify(ops[0].args).includes('person-tomas-casas'), JSON.stringify(ops[0].args));
t('no repite si ya está', completeMeetings(ops, 'reunión con Tomás').length === 0);
// Dos reuniones: no adivina, solo avisa
const two = [{ name: 'agendar', args: { titulo: 'a', fecha: '2026-11-13' } }, { name: 'agendar', args: { titulo: 'b', fecha: '2026-11-14' } }];
t('con dos reuniones no completa', completeMeetings(two, 'reunión con Tomás').length === 0);
t('con dos reuniones avisa', inspectPlan(two, [], 'reunión con Tomás').avisos.some(x => /Tomás Casas/.test(x)));
// Plan que usa a Richard Williams cuando el texto dice solo Richard → aprobación
const rich = [{ name: 'registrar_novedad', args: { ficha: 'person-richard-williams', resumen: 'llamó', fuente: 'x' } }];
t('Richard ambiguo en el plan → fuerte', inspectPlan(rich, [], 'Richard llamó').fuertes.length === 1);
t('Richard con apellido en el plan → sin aviso', inspectPlan(rich, [], 'Richard Williams llamó').fuertes.length === 0);
const lu = [{ name: 'registrar_novedad', args: { ficha: 'person-luisa-santos', resumen: 'x', fuente: 'x' } }];
t('Luis → Luisa en el plan → fuerte', inspectPlan(lu, [], 'Luis llamó').fuertes.length === 1);
console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);

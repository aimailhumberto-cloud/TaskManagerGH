/** Pruebas del motor interno (sin modelo): nombres ambiguos, personas nombradas, reunión completada, avisos. Uso: SMJ_VAULT_PATH=vault npx tsx scripts/test-motor.ts */
import { nameAmbiguities, peopleMentioned } from '../src/lib/brainLens';
import { inspectPlan, completeMeetings, dateIssues, fieldIssues } from '../src/lib/cerebro/review';
import { lowRisk } from '../src/lib/cerebro/engine';
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
// Riesgo bajo: lo simple y reversible no lo frena la duda de Jev
const clean = { fuertes: [] as string[] };
t('riesgo bajo: cambiar datos de una ficha existente', lowRisk([{ name: 'actualizar_campos', args: { ficha: 'person-luisa-santos', campos: { status: 'inactive' } } }], clean));
t('riesgo bajo: una tarea y una nota', lowRisk([{ name: 'crear_tarea', args: { ficha: 'person-tomas-casas', titulo: 'x' } }, { name: 'registrar_novedad', args: { ficha: 'person-tomas-casas', resumen: 'x', fuente: 'x' } }], clean));
t('no es bajo: crear una ficha', !lowRisk([{ name: 'crear_ficha', args: { tipo: 'person', nombre: 'X Y' } }], clean));
t('no es bajo: una cifra', !lowRisk([{ name: 'registrar_indicador', args: { nombre: 'x', valor: 1 } }], clean));
t('no es bajo: borrar', !lowRisk([{ name: 'borrar_ficha', args: { ficha: 'person-luisa-santos' } }], clean));
t('no es bajo: con un aviso fuerte', !lowRisk([{ name: 'crear_tarea', args: { ficha: 'person-tomas-casas', titulo: 'x' } }], { fuertes: ['duda'] }));
t('no es bajo: expediente incompleto', !lowRisk([{ name: 'crear_tarea', args: { ficha: 'person-tomas-casas', titulo: 'x' } }], clean, true));
t('no es bajo: toca más de 3 fichas', !lowRisk(['person-tomas-casas', 'person-luisa-santos', 'person-jenna-hector', 'person-richard-bailey'].map(f => ({ name: 'registrar_novedad', args: { ficha: f, resumen: 'x', fuente: 'x' } })), clean));
// Fechas que no cuadran con el pedido, y campos inventados
const T = '2026-11-14'; const task = (f: string) => [{ name: 'crear_tarea', args: { ficha: 'person-tomas-casas', titulo: 'x', fecha: f } }];
t('lunes 16 pero el plan pone martes 17', dateIssues(task('2026-11-17'), 'Crea una tarea para el lunes 16: llamar a Tomás Casas', T).length === 1);
t('lunes 16 y el plan pone lunes 16', dateIssues(task('2026-11-16'), 'Crea una tarea para el lunes 16: llamar a Tomás Casas', T).length === 0);
t('20 de noviembre pero el plan pone 21', dateIssues([{ name: 'agendar', args: { titulo: 'x', fecha: '2026-11-21' } }], 'Reunión el 20 de noviembre a las 10:00', T).length === 1);
t('la hora no se confunde con el día', dateIssues([{ name: 'agendar', args: { titulo: 'x', fecha: '2026-11-20', hora: '10:00' } }], 'Reunión el 20 de noviembre a las 10:00', T).length === 0);
t('fecha ya pasada en una tarea', dateIssues(task('2026-11-01'), 'Crea una tarea para mañana', T).length === 1);
t('una novedad con fecha pasada es normal', dateIssues([{ name: 'registrar_novedad', args: { ficha: 'person-tomas-casas', resumen: 'x', fuente: 'x', fecha: '2026-11-01' } }], 'Ayer llamó', T).length === 0);
t('sin día dicho no hay queja', dateIssues(task('2026-11-18'), 'Crea una tarea para la próxima semana', T).length === 0);
t('campo inventado «estado» en una persona', fieldIssues([{ name: 'actualizar_campos', args: { ficha: 'person-luisa-santos', campos: { estado: 'inactiva' } } }]).length === 1);
t('campos estándar de baja (status, end_date, inactive_reason) pasan aunque la ficha no los tenga', fieldIssues([{ name: 'actualizar_campos', args: { ficha: 'person-luisa-santos', campos: { status: 'inactive', end_date: '2026-11-13', inactive_reason: 'renuncia' } } }]).length === 0);
t('campo real «job_title» pasa', fieldIssues([{ name: 'actualizar_campos', args: { ficha: 'person-luisa-santos', campos: { job_title: 'Gerente' } } }]).length === 0);
console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);

/**
 * Rescate de llamadas escritas como texto: un JSON en el contenido del modelo se vuelve la llamada que debió ser.
 * Hallado en producción con el caso 21 del banco: el modelo daba la operación como texto y el Cerebro le enseñaba a la persona un JSON crudo como «pregunta».
 * Uso: npx tsx scripts/test-rescate.ts
 */
import { rescueToolCalls } from '../src/lib/cerebro/rescate';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const TOOLS = ['registrar_novedad', 'crear_tarea', 'agendar', 'actualizar_campos', 'preguntar', 'observar', 'buscar'];
const r = (s: string) => rescueToolCalls(s, TOOLS);

// El caso real de producción: los argumentos pelados de una anotación, como texto.
const real = '{"ficha":"person-jenna-hector","tipo":"correo","fecha":"2026-11-16","correo_asunto":"RE: Visita","resumen":"Jenna Hector confirmó la visita a Canadá para enero.","estado_actual":"Confirmada"}';
const a = r(real);
t('1 argumentos pelados de una anotación → registrar_novedad', a.length === 1 && a[0].name === 'registrar_novedad' && a[0].args.ficha === 'person-jenna-hector' && /enero/.test(String(a[0].args.resumen)), JSON.stringify(a));
const b = r('{"name":"crear_tarea","arguments":{"ficha":"person-tomas-casas","titulo":"Llamar","vence":"2026-11-20"}}');
t('2 {name, arguments}', b.length === 1 && b[0].name === 'crear_tarea' && b[0].args.titulo === 'Llamar');
t('3 {function:{name, arguments}} y arguments como texto JSON', r('{"function":{"name":"agendar","arguments":"{\\"fecha\\":\\"2026-11-20\\"}"}}')[0]?.args.fecha === '2026-11-20');
t('4 una lista de llamadas', r('[{"name":"crear_tarea","arguments":{"titulo":"a"}},{"name":"agendar","arguments":{"fecha":"2026-11-20"}}]').map(x => x.name).join() === 'crear_tarea,agendar');
t('5 dentro de un bloque ``` json', r('Aquí va:\n```json\n{"name":"crear_tarea","args":{"titulo":"a"}}\n```').length === 1);
t('6 {tool, parameters}', r('{"tool":"crear_tarea","parameters":{"titulo":"x"}}')[0]?.name === 'crear_tarea');

// Lo que NO se rescata
t('7 una herramienta que no existe no se rescata (nada se salta el menú)', r('{"name":"borrar_todo","arguments":{}}').length === 0 && r('{"name":"borrar_ficha","arguments":{"ficha":"x"}}').length === 0);
t('8 una pregunta normal en texto no se toca', r('¿Qué día es la reunión?').length === 0 && r('').length === 0);
t('9 un JSON que no parece una llamada no se toca', r('{"hola":"mundo"}').length === 0 && r('{"ficha":"x"}').length === 0);
t('10 JSON roto no revienta', r('{"name":"crear_tarea","arguments":{').length === 0 && r('```json\n{rota\n```').length === 0);
t('11 argumentos que no son un objeto no se aceptan', r('{"name":"crear_tarea","arguments":5}').length === 0 && r('{"name":"crear_tarea","arguments":"no es json"}').length === 1 && Object.keys(r('{"name":"crear_tarea","arguments":"no es json"}')[0].args).length === 0);
t('12 sin registrar_novedad en el menú no se rescatan argumentos pelados', rescueToolCalls(real, ['crear_tarea']).length === 0);
t('13 un texto con un JSON a mitad de frase no se toca (solo texto que ES el JSON o va en ```)', r('Creo que debería ser ' + real + ' ¿te parece?').length === 0);
t('14 tope de 20 llamadas', r(JSON.stringify(Array.from({ length: 30 }, () => ({ name: 'crear_tarea', arguments: { titulo: 'x' } })))).length === 20);

console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);

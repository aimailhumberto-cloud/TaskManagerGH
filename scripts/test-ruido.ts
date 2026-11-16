/**
 * Ruido de correos pegados: firmas de aparato y avisos legales se quitan ANTES del modelo; el pedido y la cadena citada no se tocan.
 * Uso: npx tsx scripts/test-ruido.ts
 */
import { cleanNoise } from '../src/lib/cerebro/ruido';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const c = (s: string) => cleanNoise(s);

const correo = 'Hola, confirmo que la visita será en enero.\nSaludos,\nJenna\n\nEnviado desde mi iPhone\nAVISO LEGAL: este mensaje es confidencial y está dirigido solo a su destinatario.\nSi lo recibió por error, avise.\n\n> El 1 de noviembre Jenna escribió:\n> La visita todavía es en marzo\n> Saludos';
const r = c(correo);
t('1 quita «Enviado desde mi iPhone»', !/iPhone/.test(r.text), r.text);
t('2 quita el aviso legal entero (hasta la línea en blanco)', !/AVISO LEGAL|destinatario|avise/.test(r.text), r.text);
t('3 conserva lo que importa: el cuerpo y la firma de la persona', /confirmo que la visita será en enero/.test(r.text) && /Jenna/.test(r.text));
t('4 conserva la cadena citada (a veces trae el contexto)', /> La visita todavía es en marzo/.test(r.text) && /> El 1 de noviembre/.test(r.text));
t('5 dice cuánto quitó', r.quitado > 80 && c('nada que quitar').quitado === 0, String(r.quitado));
t('6 las firmas de aparato en inglés y de Outlook', ['Sent from my iPhone', 'Sent from my Android', 'Get Outlook for iOS', 'Obtener Outlook para Android', 'Enviado desde mi móvil', 'Enviado desde Outlook'].every(x => c(`Hola\n${x}\nAdiós`).text === 'Hola\nAdiós'));
t('7 los avisos en inglés', !/confidential|intended recipient/i.test(c('Hi\n\nThis email is confidential and may be privileged.\nIf you are not the intended recipient, delete it.\n\nBye').text) && /Bye/.test(c('Hi\n\nThis email is confidential and may be privileged.\n\nBye').text));
t('8 un aviso legal que no está al pie no se come lo que sigue después de la línea en blanco', /Siguiente párrafo real/.test(c('Aviso legal: confidencial.\n\nSiguiente párrafo real.').text));
t('9 una frase normal que menciona «aviso legal» o «iPhone» a mitad de línea no se toca', c('Revisar el aviso legal del contrato y el iPhone de Pierre').text === 'Revisar el aviso legal del contrato y el iPhone de Pierre');
t('10 una línea citada que parece firma no se quita', c('> Enviado desde mi iPhone').text === '> Enviado desde mi iPhone');
t('11 vacío y espacios no rompen nada', c('').text === '' && c('   ').text === '' && c('\n\n\n').quitado === 0);
t('12 no deja más de una línea en blanco seguida', !/\n\n\n/.test(c('a\n\n\n\n\nb').text));
t('13 CRLF también', !/iPhone/.test(c('Hola\r\nEnviado desde mi iPhone\r\nAdiós').text) && /Adiós/.test(c('Hola\r\nEnviado desde mi iPhone\r\nAdiós').text));
t('14 un correo sin ruido queda igual', c('Solo texto.\nOtra línea.').text === 'Solo texto.\nOtra línea.');

console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);

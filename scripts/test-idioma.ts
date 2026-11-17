/**
 * Idioma al entrar: lo que eligió la persona; si no, el de su navegador (español o inglés); si no, inglés.
 * Un agente o un script (sin Accept-Language) sigue recibiendo español. Uso: npx tsx scripts/test-idioma.ts
 */
import { fromAcceptLanguage, pickLang } from '../src/lib/langPick';
import { langFromRequest } from '../src/lib/reqLang';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const req = (h: Record<string, string> = {}, url = 'http://x/api') => ({ headers: new Headers(h), url });

// ================= A. El encabezado del navegador =================
t('A1 español de Panamá o de cualquier país', fromAcceptLanguage('es-PA,es;q=0.9') === 'es' && fromAcceptLanguage('es-419') === 'es' && fromAcceptLanguage('ES') === 'es');
t('A2 inglés de cualquier país', fromAcceptLanguage('en-US,en;q=0.9') === 'en' && fromAcceptLanguage('en-TT') === 'en' && fromAcceptLanguage('en') === 'en');
t('A3 manda el primero de la lista (el que la persona prefiere)', fromAcceptLanguage('en-US,es;q=0.8') === 'en' && fromAcceptLanguage('es-PA,en;q=0.8') === 'es');
t('A4 manda el peso q, no el orden en que viene escrito', fromAcceptLanguage('en;q=0.4,es;q=0.9') === 'es' && fromAcceptLanguage('es;q=0.2, en;q=0.8') === 'en');
t('A5 otro idioma primero: toma el primero que la app entiende', fromAcceptLanguage('fr-FR,fr;q=0.9,es;q=0.5,en;q=0.4') === 'es' && fromAcceptLanguage('pt-BR,en;q=0.7') === 'en');
t('A6 ninguno que la app entienda: null (después se cae a inglés)', fromAcceptLanguage('fr-FR,de;q=0.8,zh-CN;q=0.5') === null && fromAcceptLanguage('*') === null);
t('A7 vacío, ausente o roto no revienta', fromAcceptLanguage('') === null && fromAcceptLanguage(null) === null && fromAcceptLanguage(undefined) === null && fromAcceptLanguage(',,;;q=') === null);
t('A8 un idioma con q=0 está excluido', fromAcceptLanguage('es;q=0,en;q=0.5') === 'en');
t('A9 «es» como parte de otro código no cuenta («est» no es español)', fromAcceptLanguage('est') === null);

// ================= B. La decisión =================
t('B1 lo que eligió la persona manda sobre el navegador', pickLang({ cookie: 'es', accept: 'en-US' }) === 'es' && pickLang({ cookie: 'en', accept: 'es-PA' }) === 'en');
t('B2 sin elección: el idioma del navegador', pickLang({ accept: 'es-PA,es;q=0.9' }) === 'es' && pickLang({ accept: 'en-US' }) === 'en');
t('B3 sin elección ni navegador que se entienda: INGLÉS', pickLang({}) === 'en' && pickLang({ accept: 'fr-FR' }) === 'en' && pickLang({ cookie: '', accept: '' }) === 'en');
t('B4 una cookie rara se ignora y se mira el navegador', pickLang({ cookie: 'fr', accept: 'es' }) === 'es' && pickLang({ cookie: 'xx' }) === 'en');

// ================= C. Las respuestas del servidor a una petición =================
t('C1 un navegador en inglés recibe los mensajes en inglés', langFromRequest(req({ 'accept-language': 'en-US,en;q=0.9' })) === 'en');
t('C2 un navegador en español, en español', langFromRequest(req({ 'accept-language': 'es-PA,es;q=0.9' })) === 'es');
t('C3 un navegador en otro idioma: inglés', langFromRequest(req({ 'accept-language': 'fr-FR' })) === 'en');
t('C4 un agente o un script (sin Accept-Language) sigue en español, como siempre', langFromRequest(req()) === 'es');
t('C5 x-lang y ?lang= mandan sobre todo', langFromRequest(req({ 'x-lang': 'es', 'accept-language': 'en-US' })) === 'es' && langFromRequest(req({ 'accept-language': 'es' }, 'http://x/api?lang=en')) === 'en');
t('C6 la cookie de la pantalla manda sobre el navegador', langFromRequest(req({ cookie: 'otra=1; cerebro_lang=es', 'accept-language': 'en-US' })) === 'es' && langFromRequest(req({ cookie: 'cerebro_lang=en', 'accept-language': 'es-PA' })) === 'en');

console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);

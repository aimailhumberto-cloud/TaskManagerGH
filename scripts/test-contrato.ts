/** Etapa 5.6: contrato del agente y respuesta en dos niveles (caso.paraPersona). Uso: npx tsx scripts/test-contrato.ts */
import { caseOf, limpio, paraPersona } from '../src/lib/cerebro/cases';
import { agentGuide } from '../src/lib/cerebro/guide';
import { AGENT_ALLOWED, agentMayWrite } from '../src/lib/agentGate';
import { withLang } from '../src/lib/reqLang';

let ok = 0, bad = 0; const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const base: any = { id: 'ped-20261115120000-abc123', at: new Date().toISOString(), by: 'Agente', via: 'llave', text: 'Registra a Pierre Canavaggio en MEDIMEX', ops: [], plan: [] };
const lines = (s: string) => s.split('\n').length;
const NOISE = /ped-\d|chg-|\.md\b|CASO |CASE |\b[a-z]+-[a-z]+-\d/;

// A. Cerrado completo: corto, sin ruido técnico
const cerrado = caseOf({ ...base, status: 'aplicado', changeId: 'chg-20261115-xyz', plan: ['a'], results: ['Ficha creada: Pierre Canavaggio (person-pierre-canavaggio-20261115)', 'Enlace a MEDIMEX en 02-Companies/medimex-001.md'] } as any).paraPersona;
t('A1 cerrado: dice lo guardado', /Guardado: .*Pierre Canavaggio/.test(cerrado), cerrado);
t('A2 cerrado: máximo 4 líneas', lines(cerrado) <= 4, cerrado);
t('A3 cerrado: sin números de caso, ids ni archivos', !NOISE.test(cerrado), cerrado);
t('A4 cerrado: dice que se puede deshacer, sin el id del cambio', /Se puede deshacer/.test(cerrado) && !/chg-/.test(cerrado), cerrado);
t('A5 el detalle del registro sigue intacto (texto con id y cambio)', /CASO ped-20261115120000-abc123 CERRADO/.test(caseOf({ ...base, status: 'aplicado', changeId: 'chg-1', results: ['x'] } as any).texto));

// B. Muchas cosas guardadas: se recorta con «y N más»
const muchas = caseOf({ ...base, status: 'aplicado', results: ['uno', 'dos', 'tres', 'cuatro', 'cinco'] } as any).paraPersona;
t('B1 recorta a tres y cuenta el resto', /uno; dos; tres; y 2 más/.test(muchas) && !/cuatro/.test(muchas), muchas);

// C. Espera respuesta: una pregunta, nada guardado
const preg = caseOf({ ...base, status: 'pregunta', dialog: [{ q: '¿Qué Pierre: el de MEDIMEX o el de Panamá Pacífico?' }] } as any).paraPersona;
t('C1 pregunta: dice que no guardó nada y la pregunta', /Todavía no guardé nada/.test(preg) && /MEDIMEX/.test(preg), preg);
t('C2 pregunta: corta y sin ruido', lines(preg) <= 4 && !NOISE.test(preg), preg);

// D. Espera aprobación con parte ya guardada
const apr = caseOf({ ...base, status: 'pendiente', plan: ['Verificar a Pierre Canavaggio'], why: 'verificar es delicado: lo aprueba una persona', partial: { saved: ['Nota agregada en MEDIMEX'], changeId: 'chg-9' } } as any).paraPersona;
t('D1 aprobación: lo ya guardado, lo que espera y el motivo', /Ya guardé: Nota agregada/.test(apr) && /visto bueno para: Verificar/.test(apr) && /Motivo: verificar es delicado/.test(apr), apr);
t('D2 aprobación: máximo 4 líneas y sin ids', lines(apr) <= 4 && !NOISE.test(apr), apr);

// E. Sin cambios y por confirmar
const sin = caseOf({ ...base, status: 'sin_cambios', message: 'Ya estaba guardado.' } as any).paraPersona;
t('E1 sin cambios: dice qué pasó', /No se guardó nada: Ya estaba guardado/.test(sin), sin);
const conf = caseOf({ ...base, status: 'aplicado', results: ['Teléfono de MEDIMEX'], obs: { fuertes: [], avisos: ['El cargo de Pierre no está confirmado'], falta: [] } } as any).paraPersona;
t('E2 por confirmar aparece', /Por confirmar: El cargo de Pierre/.test(conf), conf);

// F. Inglés
const en = withLang('en', 'en', () => caseOf({ ...base, status: 'aplicado', changeId: 'chg-1', results: ['a', 'b', 'c', 'd'] } as any).paraPersona);
t('F1 en inglés', /^Saved: a; b; c; and 1 more\.\nIt can be undone\.$/.test(en), en);

// G. limpio: quita ruido y recorta
t('G1 limpio quita rutas e ids', limpio('Ver medimex.md y ped-20261115120000-abc123 ya') === 'Ver y ya', limpio('Ver medimex.md y ped-20261115120000-abc123 ya'));
t('G2 limpio recorta largo', limpio('palabra '.repeat(40), 50).length <= 50);
t('G3 limpio no daña un nombre normal', limpio('Pierre Canavaggio, MEDIMEX Panamá') === 'Pierre Canavaggio, MEDIMEX Panamá');
t('G4 paraPersona nunca pasa de 4 líneas', lines(paraPersona({ estado: 'cerrado', guardado: ['a'], esperando: [], noGuardado: ['b'], porConfirmar: ['c'], deshacer: true, parcial: false })) <= 4);

// H. La guía trae el contrato en los dos idiomas
const opts = { canApprove: true, pendientes: 0, persona: 'HB' };
const es = withLang('es', 'es', () => agentGuide(opts)); const eng = withLang('en', 'en', () => agentGuide(opts));
t('H1 es: palabras tal cual', /Las palabras de HB, tal cual/.test(es));
t('H2 es: investigación aparte como evidencia', /evidencia tuya[\s\S]*aparte de lo que dijo HB/.test(es));
t('H3 es: orden clara y reversible sin pedir permiso', /clara y reversible se manda ya, sin pedirle permiso/.test(es));
t('H4 es: un tema por caso', /Un tema por caso/.test(es));
t('H5 es: dos niveles con paraPersona', /caso\.paraPersona/.test(es) && /Sin números de caso/.test(es));
t('H6 en: mismo contrato', /as they said them/.test(eng) && /your evidence/.test(eng) && /without asking HB for permission/.test(eng) && /One topic per case/.test(eng) && /caso\.paraPersona/.test(eng) && /No case numbers/.test(eng));
t('H7 ya no manda repetir el acta tal cual a la persona', !/Repórtasela a HB tal cual/.test(es) && !/Report it to HB as is/.test(eng));

// I. La puerta del agente deja pasar «manana» (la guía lo promete)
t('I1 el agente puede leer el resumen de la mañana', (AGENT_ALLOWED['/api/agent/cerebro'] || []).includes('manana') && agentMayWrite('/api/agent/cerebro', 'manana'));
t('I2 y sigue sin poder escribir directo', !agentMayWrite('/api/agent/cerebro', 'crear'));

console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);

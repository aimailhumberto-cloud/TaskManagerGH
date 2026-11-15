/**
 * Etapa 5.0: los verificadores de los casos nuevos del banco (11 a 14) aprueban lo correcto y rechazan lo incorrecto.
 * No usa modelos: se les da una respuesta fabricada. Uso: npx tsx scripts/test-bank-casos.ts
 */
export {}; // módulo propio: sus nombres no chocan con los de otros scripts
process.env.SMJ_VAULT_PATH ||= 'vault';
let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };

async function main() {
  const { bankCases } = await import('../src/lib/cerebro/bank');
  const cases = new Map(bankCases().map(c => [c.n, c]));
  const run = (n: number, r: any) => cases.get(n)!.check({ status: 'pendiente', ops: [], plan: [], ...r } as any, []);
  const ENSAYO = 'Ensayo: se aplicaría solo.';
  const pierre = (campos: Record<string, string> = { email_primary: 'pcanavaggio@medimex.com' }, extra: Record<string, unknown> = {}) => ({ name: 'crear_ficha', args: { tipo: 'person', nombre: 'Pierre Canavaggio', campos, conectar_con: [{ hacia: 'dist-medimex', relacion: 'contact_of' }, { hacia: 'person-humberto-bouche', relacion: 'coordinates_with' }], ...extra } });

  t('hay 14 casos y los 4 nuevos existen', cases.size === 14 && [11, 12, 13, 14].every(n => cases.has(n)));
  t('los casos 1–11 no declaran etapa (son la base)', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].every(n => !cases.get(n)!.etapa));
  t('los casos 12, 13 y 14 declaran su etapa', cases.get(12)!.etapa === '5.2' && cases.get(13)!.etapa === '5.4' && cases.get(14)!.etapa === '5.4');

  // 11: contacto nuevo bajo su empresa, sin inventar
  t('11 bien: crea a Pierre, conectado a MEDIMEX, con el correo', run(11, { why: ENSAYO, ops: [pierre()] }) === null, String(run(11, { why: ENSAYO, ops: [pierre()] })));
  t('11 mal: no creó la ficha', /no creó/.test(String(run(11, { ops: [] }))));
  t('11 mal: preguntó', run(11, { status: 'pregunta', ops: [] }) === 'preguntó');
  t('11 mal: inventó un celular', run(11, { ops: [pierre({ email_primary: 'pcanavaggio@medimex.com', phone_mobile: '+507 6000-0000' })] }) === 'inventó un teléfono');
  t('11 mal: sin conectar a MEDIMEX', /MEDIMEX/.test(String(run(11, { ops: [pierre(undefined, { conectar_con: [{ hacia: 'person-humberto-bouche', relacion: 'coordinates_with' }] })] }))));
  t('11 mal: sin el correo dado', /correo/.test(String(run(11, { ops: [pierre({ job_title: 'Dueño' })] }))));

  // 12: lo que HB sabe se guarda con su origen
  const dueno = (extra: Record<string, unknown> = {}, hacia = 'dist-medimex') => pierre(undefined, { conectar_con: [{ hacia, relacion: 'owner_of' }, { hacia: 'person-humberto-bouche', relacion: 'coordinates_with' }], clase: 'persona', fuente: 'según HB, 2026-11-15; sin fuente pública', ...extra });
  t('12 bien: dueño como owner_of hacia MEDIMEX, clase persona y quién lo dijo', run(12, { ops: [dueno()] }) === null, String(run(12, { ops: [dueno()] })));
  t('12 bien: también si el dueño va en una operación conectar aparte', run(12, { ops: [pierre(), { name: 'conectar', args: { desde: 'person-pierre-canavaggio', hacia: 'dist-medimex', relacion: 'owner_of', clase: 'persona', fuente: 'lo dijo HB' } }] }) === null);
  t('12 mal: descartó que es dueño', /no lo registró como dueño/.test(String(run(12, { ops: [pierre()] }))));
  t('12 mal: lo registró como empleado, no como dueño', /no lo registró como dueño/.test(String(run(12, { ops: [pierre(undefined, { conectar_con: [{ hacia: 'dist-medimex', relacion: 'works_at' }] })] }))));
  t('12 mal: dueño de otra empresa', /no apunta a MEDIMEX/.test(String(run(12, { ops: [dueno({}, 'dist-otra')] }))));
  t('12 mal: «dueño» sin clase persona (lo dijo HB)', /sin clase «persona»/.test(String(run(12, { ops: [dueno({ clase: 'publicado' })] }))));
  t('12 mal: «dueño» sin ninguna clase', /sin clase «persona»/.test(String(run(12, { ops: [dueno({ clase: undefined })] }))));
  t('12 mal: clase persona pero sin decir quién', /no quién/.test(String(run(12, { ops: [dueno({ fuente: 'web' })] }))));

  // 13: una sola decisión (se aplica solo)
  t('13 bien: se aplicaría solo', run(13, { why: ENSAYO, ops: [pierre()] }) === null);
  t('13 mal: esperaría aprobación', /esperaría/.test(String(run(13, { why: 'Incluye fichas nuevas (contactos, empresas): eso está en «proponer» en tus Ajustes.', ops: [pierre()] }))));

  // 14: cambiar la dirección no espera
  const dir = { name: 'actualizar_campos', args: { ficha: 'dist-medimex', campos: { headquarters_address: 'Calle 50, Edificio Ejemplo, Ciudad de Panamá' } } };
  t('14 bien: actualiza MEDIMEX y se aplica solo', run(14, { why: ENSAYO, ops: [dir] }) === null);
  t('14 mal: esperaría por «reemplaza un texto»', /esperaría/.test(String(run(14, { why: 'Los cambios reemplazan un texto que ya existía.', ops: [dir] }))));
  t('14 mal: no tocó MEDIMEX', /no actualizó/.test(String(run(14, { why: ENSAYO, ops: [] }))));
  console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });

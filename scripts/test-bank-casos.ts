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
  t('12 bien: «dueño» con origen HB', run(12, { ops: [pierre({ email_primary: 'pcanavaggio@medimex.com', job_title: 'Dueño de MEDIMEX (según HB, 2026-11-15)' })] }) === null);
  t('12 mal: descartó que es dueño', /descartó/.test(String(run(12, { ops: [pierre()] }))));
  t('12 mal: «dueño» sin decir de dónde viene', /sin decir/.test(String(run(12, { ops: [pierre({ email_primary: 'x@y.z', job_title: 'Dueño de MEDIMEX' })] }))));

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

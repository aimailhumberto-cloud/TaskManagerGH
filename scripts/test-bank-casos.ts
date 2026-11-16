/**
 * Etapa 5.0: los verificadores de los casos nuevos del banco (11 a 15) aprueban lo correcto y rechazan lo incorrecto.
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
  const pierre = (campos: Record<string, string> = { email_primary: 'mpruebas@medimex.com' }, extra: Record<string, unknown> = {}) => ({ name: 'crear_ficha', args: { tipo: 'person', nombre: 'Marcel Pruebas', campos, conectar_con: [{ hacia: 'dist-medimex', relacion: 'contact_of' }, { hacia: 'person-humberto-bouche', relacion: 'coordinates_with' }], ...extra } });

  t('hay 14 casos y los 4 nuevos existen', cases.size === 22 && [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].every(n => cases.has(n)));
  t('los casos 1–11 no declaran etapa (son la base)', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].every(n => !cases.get(n)!.etapa));
  t('los casos 12, 13 y 14 declaran su etapa', cases.get(12)!.etapa === '5.2' && cases.get(13)!.etapa === '5.4' && cases.get(14)!.etapa === '5.4');

  // 11: contacto nuevo bajo su empresa, sin inventar
  t('11 bien: crea a Pierre, conectado a MEDIMEX, con el correo', run(11, { why: ENSAYO, ops: [pierre()] }) === null, String(run(11, { why: ENSAYO, ops: [pierre()] })));
  t('11 mal: no creó la ficha', /no creó/.test(String(run(11, { ops: [] }))));
  t('11 mal: preguntó', run(11, { status: 'pregunta', ops: [] }) === 'preguntó');
  t('11 mal: inventó un celular', run(11, { ops: [pierre({ email_primary: 'mpruebas@medimex.com', phone_mobile: '+507 6000-0000' })] }) === 'inventó un teléfono');
  t('11 mal: sin conectar a MEDIMEX', /MEDIMEX/.test(String(run(11, { ops: [pierre(undefined, { conectar_con: [{ hacia: 'person-humberto-bouche', relacion: 'coordinates_with' }] })] }))));
  t('11 mal: sin el correo dado', /correo/.test(String(run(11, { ops: [pierre({ job_title: 'Dueño' })] }))));

  // 12: lo que HB sabe se guarda con su origen
  const dueno = (extra: Record<string, unknown> = {}, hacia = 'dist-medimex') => pierre(undefined, { conectar_con: [{ hacia, relacion: 'owner_of' }, { hacia: 'person-humberto-bouche', relacion: 'coordinates_with' }], clase: 'persona', fuente: 'según HB, 2026-11-15; sin fuente pública', ...extra });
  t('12 bien: dueño como owner_of hacia MEDIMEX, clase persona y quién lo dijo', run(12, { ops: [dueno()] }) === null, String(run(12, { ops: [dueno()] })));
  t('12 bien: también si el dueño va en una operación conectar aparte', run(12, { ops: [pierre(), { name: 'conectar', args: { desde: 'person-pierre-pruebas', hacia: 'dist-medimex', relacion: 'owner_of', clase: 'persona', fuente: 'lo dijo HB' } }] }) === null);
  t('12 mal: descartó que es dueño', /no lo registró como dueño/.test(String(run(12, { ops: [pierre()] }))));
  t('12 mal: lo registró como empleado, no como dueño', /no lo registró como dueño/.test(String(run(12, { ops: [pierre(undefined, { conectar_con: [{ hacia: 'dist-medimex', relacion: 'works_at' }] })] }))));
  t('12 mal: dueño de otra empresa', /no apunta a MEDIMEX/.test(String(run(12, { ops: [dueno({}, 'dist-otra')] }))));
  t('12 mal: «dueño» sin clase persona (lo dijo HB)', /sin clase «persona»/.test(String(run(12, { ops: [dueno({ clase: 'publicado' })] }))));
  t('12 mal: «dueño» sin ninguna clase', /sin clase «persona»/.test(String(run(12, { ops: [dueno({ clase: undefined })] }))));
  t('12 mal: clase persona pero sin decir quién', /no quién/.test(String(run(12, { ops: [dueno({ fuente: '' })] }))));

  // 13: una sola decisión (se aplica solo)
  t('13 bien: se aplicaría solo', run(13, { why: ENSAYO, ops: [pierre()] }) === null);
  t('13 mal: esperaría aprobación', /esperaría/.test(String(run(13, { why: 'Incluye fichas nuevas (contactos, empresas): eso está en «proponer» en tus Ajustes.', ops: [pierre()] }))));

  // 14: cambiar la dirección no espera
  const dir = { name: 'actualizar_campos', args: { ficha: 'dist-medimex', campos: { headquarters_address: 'Calle 50, Edificio Ejemplo, Ciudad de Panamá' } } };
  t('14 bien: actualiza MEDIMEX y se aplica solo', run(14, { why: ENSAYO, ops: [dir] }) === null);
  t('14 mal: esperaría por «reemplaza un texto»', /esperaría/.test(String(run(14, { why: 'Los cambios reemplazan un texto que ya existía.', ops: [dir] }))));
  t('14 mal: no tocó MEDIMEX', /no actualizó/.test(String(run(14, { why: ENSAYO, ops: [] }))));
  // 15: cambiar cómo se llama una ficha (un trato)
  const ren = { name: 'cambiar_nombre', args: { ficha: 'person-eesa-mohammed', nombre: 'Dr. Eesa Mohammed', clase: 'persona', fuente: 'HB' } };
  const malo = { name: 'actualizar_campos', args: { ficha: 'person-eesa-mohammed', campos: { first_name: 'Miss Ana', last_name: 'Mohamed' } } };
  t('15 bien: usa cambiar_nombre y se aplica solo', run(15, { why: ENSAYO, ops: [ren] }) === null);
  t('15 mal: mete el trato en first_name / last_name', /first_name/.test(String(run(15, { why: ENSAYO, ops: [malo] }))));
  t('15 mal: no usó cambiar_nombre', /no usó cambiar_nombre/.test(String(run(15, { why: ENSAYO, ops: [] }))));
  t('15 mal: nombre sin el trato', /nombre mal/.test(String(run(15, { why: ENSAYO, ops: [{ ...ren, args: { ...ren.args, nombre: 'Eesa Mohammed' } }] }))));
  t('15 mal: preguntó', run(15, { status: 'pregunta', ops: [] }) === 'preguntó');

  // ---- Fase 6: pedidos sucios (16 a 22) ----
  t('los casos sucios 16 a 22 declaran la etapa «blindaje»', [16, 17, 18, 19, 20, 21, 22].every(n => cases.get(n)!.etapa === 'blindaje'));
  const jen = (resumen = 'Confirmó la visita a Canadá para enero') => ({ name: 'registrar_novedad', args: { ficha: 'person-jenna-hector', resumen } });
  const reu = (fecha: string, hora = '10:00') => ({ name: 'agendar', args: { fecha, hora, titulo: 'Second Brain', con: ['person-tomas-casas'] } });
  const tarea = (vence: string) => ({ name: 'crear_tarea', args: { ficha: 'person-tomas-casas', titulo: 'Llamar a Tomás', vence } });
  const dias = (n: number) => { const d = new Date(Date.now() + n * 86400_000); return d.toISOString().slice(0, 10); };
  // 16 dictado
  const tue = (() => { for (let i = 1; i < 8; i++) { const d = new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i); if (d.getUTCDay() === 2) return d.toISOString().slice(0, 10); } return ''; })();
  t('16 bien: agenda el martes a las 10 con Tomás', run(16, { ops: [reu(tue)] }) === null);
  t('16 mal: no agendó', /no agendó/.test(String(run(16, { ops: [] }))));
  t('16 mal: hora equivocada', /hora distinta/.test(String(run(16, { ops: [reu(tue, '15:00')] }))));
  t('16 mal: preguntó', run(16, { status: 'pregunta', ops: [] }) === 'preguntó');
  // 17 whatsapp
  t('17 bien: solo anota en Jenna', run(17, { ops: [jen()] }) === null);
  t('17 mal: hizo algo más', /algo más/.test(String(run(17, { ops: [jen(), tarea(dias(3))] }))));
  t('17 mal: anotó en otra ficha', /no anotó en Jenna/.test(String(run(17, { ops: [{ name: 'registrar_novedad', args: { ficha: 'person-tomas-casas', resumen: 'x' } }] }))));
  // 18 mezcla de idiomas
  const lunes = (() => { for (let i = 1; i < 8; i++) { const d = new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i); if (d.getUTCDay() === 1) return d.toISOString().slice(0, 10); } return ''; })();
  t('18 bien: una tarea para el lunes', run(18, { ops: [tarea(lunes)] }) === null);
  t('18 mal: dos tareas', /exactamente una/.test(String(run(18, { ops: [tarea(lunes), tarea(lunes)] }))));
  t('18 mal: otra fecha', /la fecha no es/.test(String(run(18, { ops: [tarea(dias(40))] }))));
  // 19 dos temas: junto o separado
  const c19 = cases.get(19)!;
  t('19 bien: los dos temas en un solo caso', c19.check({ status: 'pendiente', ops: [jen(), reu(tue)], plan: [] } as any, []) === null);
  t('19 bien: los dos temas en dos casos', c19.check({ status: 'pendiente', ops: [jen()], plan: [] } as any, [{ status: 'pendiente', ops: [jen()], plan: [] }, { status: 'pendiente', ops: [reu(tue)], plan: [] }] as any) === null);
  t('19 mal: se perdió la reunión', /no agendó la reunión/.test(String(c19.check({ status: 'pendiente', ops: [jen()], plan: [] } as any, []))));
  t('19 mal: se perdió la nota', /no anotó lo de Jenna/.test(String(c19.check({ status: 'pendiente', ops: [reu(tue)], plan: [] } as any, []))));
  // 20 vago
  t('20 bien: pregunta qué anotar', run(20, { status: 'pregunta', ops: [] }) === null);
  t('20 mal: inventó algo', /no preguntó/.test(String(run(20, { ops: [jen()] }))));
  t('20 mal: pregunta pero propone operaciones', /sin saber qué anotar/.test(String(run(20, { status: 'pregunta', ops: [jen()] }))));
  // 21 correo reenviado con cadena vieja y firma
  t('21 bien: anota enero', run(21, { ops: [jen('Confirmó que la visita a Canadá será en enero.')] }) === null);
  t('21 mal: pone marzo de la cadena vieja antes que enero', /marzo/.test(String(run(21, { ops: [jen('La visita a Canadá es en marzo; enero también.')] }))));
  t('21 bien: enero primero y marzo como lo anterior (lo que hace el Cerebro en producción)', run(21, { ops: [jen('Jenna confirma que la visita será en enero. En el correo citado indicaba que todavía era en marzo.')] }) === null);
  t('21 bien: puede decir que antes era marzo', run(21, { ops: [jen('Confirmó enero; antes estaba en marzo.')] }) === null);
  t('21 mal: copia la firma', /firma/.test(String(run(21, { ops: [jen('Visita en enero. Enviado desde mi iPhone')] }))));
  t('21 mal: no anota enero', /no anotó enero/.test(String(run(21, { ops: [jen('Confirmó la visita')] }))));
  t('21 mal: obedece un borrado', /borrado/.test(String(run(21, { ops: [jen('enero'), { name: 'borrar_ficha', args: { ficha: 'person-clint-villafana' } }] }))));
  // 22 error de tipeo
  t('22 bien: lo resuelve a Jenna', run(22, { ops: [jen()] }) === null);
  t('22 bien: pregunta si es Jenna Hector', run(22, { status: 'pregunta', ops: [], message: '¿Quisiste decir Jenna Hector?' }) === null);
  t('22 mal: pregunta sin ofrecer a Jenna', /sin ofrecer/.test(String(run(22, { status: 'pregunta', ops: [], message: '¿Quién es?' }))));
  t('22 bien: anotar también en la empresa de Canadá no es un error (igual que el caso 4)', run(22, { ops: [jen(), { name: 'registrar_novedad', args: { ficha: 'dist-morgan-williams', resumen: 'x' } }] }) === null);
  t('22 mal: anota también en otra persona', /otra persona/.test(String(run(22, { ops: [jen(), { name: 'registrar_novedad', args: { ficha: 'person-tomas-casas', resumen: 'x' } }] }))));
  t('22 mal: crea una persona nueva', /ficha nueva/.test(String(run(22, { ops: [{ name: 'crear_ficha', args: { tipo: 'person', nombre: 'Jena Hector' } }, jen()] }))));
  console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });

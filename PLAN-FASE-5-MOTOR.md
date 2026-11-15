# Fase 5 del motor del Cerebro: evaluación y plan

Fecha: 2026-11-15. Autor: Claude Code, a pedido de HB. Estado: **propuesta, nada construido**.
Base: lectura completa de `src/lib/cerebro/*` (2.065 líneas), la ruta `/api/agent/cerebro`, `brainLens`, el ciclo nocturno (`dotsSleep*`), las pruebas y el vault del repo en el commit `2cba707`. No se revisaron los datos de producción (caja negra, casos reales): lo que se dice de los casos de MEDIMEX y Pierre sale del código y de la conversación que pegó HB.

## Avance

- **5.0 Marcador: construida** (commit `cad0ae8`). Falta la línea base con modelos reales (no hay llaves aquí ni autorización de lectura de producción).
- **5.1 Estructura única: construida, sin commitear.** `src/lib/cerebro/structure.ts` + `vault/00-System/estructura.yaml`. Pruebas: `npm run test:estructura` (50). Dos cambios respecto al plan:
  - El archivo es **`.yaml`, no `.md`**: así no se carga como ficha del mapa y el modelo no puede editarlo con `actualizar_campos`.
  - La **inversa de cada relación se pospuso a la 5.3** (campo sin uso hasta entonces). Hecha en la 5.3: `inverse` en cada relación.
  - La bóveda de **producción no tiene el archivo todavía**: hasta que se copie, el motor usa los valores por defecto del código (idénticos; una prueba lo vigila). Copiarlo es un paso aparte que aprueba HB.

- **5.0b Jev bien usado: construida** (commit `f2ee0c5`). `src/lib/cerebro/jev.ts` (movido desde `engine.ts`), `jevcal.ts`, `scripts/jev-calibracion.ts`. Pruebas: `npm run test:jev-uso` (55, con modelo y Jev simulados, incluido `pedir()` completo). Detalle abajo.
- **5.2 Origen del dato: construida** (commit `5939d1b`). `src/lib/cerebro/origin.ts` + cableado en `ops.ts`, `review.ts`, `brainLens.ts`. Pruebas: `npm run test:origen` (65, incluido `pedir()` completo con el caso de Pierre). Detalle en la sección «Origen del dato».
- **5.3 Vecindario: construida** (commit `56b65fb`). `src/lib/cerebro/neighborhood.ts` (+ `src/lib/titles.ts`), reglas `derives` e `inverse` en la estructura, cableado en `engine.ts` y `brainLens.ts`. Pruebas: `npm run test:vecindario` (63, incluido `pedir()` completo). Detalle en la sección «Vecindario».
- **5.4 Decisión simple: construida y subida (`fde02c0`).** `src/lib/cerebro/decision.ts` (tabla pura `decide()`), categorías en `review.ts`, `politica` y `textFields` en Ajustes y estructura, `scripts/esperas.ts`. Pruebas: `npm run test:decision` (84, incluido `pedir()` completo). Detalle en la sección «Decisión simple».
- **5.5 Noche: construida y subida (`bb6ceef`).** `src/lib/cerebro/night.ts` (un solo proceso nocturno), enganchado al temporizador existente en `dotsSleepScheduler.ts`; acción `manana` en la ruta del agente. Pruebas: `npm run test:noche` (61, incluida la corrida completa con el motor real). Detalle en la sección «Noche».
- **5.6 Contrato del agente: construida y subida (`bf1d060`).** Guía nueva en `guide.ts` (palabras de HB tal cual, investigación como evidencia aparte, orden clara y reversible sin pedir permiso, un tema por caso, respuesta en dos niveles) y campo `caso.paraPersona` en `cases.ts` (3–4 líneas, sin números de caso, ids ni archivos; el acta queda en `caso.texto`). Pruebas: `npm run test:contrato` (24). Detalle en la sección «Contrato del agente».
- **Cambiar nombre (hallado con el caso de Ana Mohammed, 15-nov): construido.** El título de una ficha estaba protegido y el Cerebro no podía renombrar: metió «Miss Ana» en first_name. Ahora `cambiar_nombre` (reversible, se guarda sola) cambia título visible y nombre preferido, y un trato en first_name/last_name se rechaza y manda a esa operación. `fuente` es obligatoria con clase «persona». Banco: caso 15 y datos de prueba ficticios (Marcel Pruebas) porque Pierre ya existe en producción. Pruebas: `npm run test:nombre` (43, con pedir() completo y deshacer).

## Papel de Jev (auditoría y reglas)

Jev se usa en cuatro sitios: el motor (¿el plan refleja el pedido?, ¿lo nuevo contradice la ficha?), la revisión nocturna (`noul` «apply» + urgencia, con auto-aplicado a ≥ 0.85 de dos tipos de propuesta), la clasificación de capturas y las preguntas libres del agente. El plan original lo tocaba poco; la auditoría encontró:

| # | Hallazgo | Estado |
|---|---|---|
| J1 | **Jev no veía las respuestas de quien pide.** `judge()` recibía el pedido + expediente cortado a 4.000 caracteres; la ronda de preguntas (`talk`) no entraba. Tras «¿cuál Richard?» → «Richard Bailey», Jev evaluaba el plan contra «Richard envió…» y podía dudar de la persona recién elegida (aprobaciones de más). | Corregido |
| J2 | **El plan se cortaba en silencio.** El proveedor recorta el estado a 12.000 caracteres por el final; el plan no tenía tope. En pedidos grandes Jev evaluaba un plan incompleto. | Corregido: el estado se arma con presupuesto; el plan siempre cabe y, si no caben todas las operaciones, lo dice |
| J3 | **Jev solo veía ids.** No sabía quién era cada ficha ni cuáles eran nuevas. | Corregido: «id = nombre (tipo)» |
| J4 | **La seguridad de Jev se descartaba.** Un 3 con 20 % de seguridad valía igual que un 3 con 95 %. | Se guarda (`obs.jev.seguridad`). Ajuste `jevMinConfidence` (0 = no se exige) para usarla cuando haya datos |
| J5 | **Fallaba en silencio (fail-open).** Sin llave o caído, el plan seguía solo con las reglas de la app y nadie lo veía. | Aviso visible en planes no simples; ajuste `jevRequired` (por defecto apagado) hace que esperen. Los cambios simples y reversibles no se frenan |
| J6 | **`afterApply` pisaba `obs.jev`** y perdía el motivo de la duda en los casos aplicados. | Corregido |
| J7 | **El umbral 0.6 se puso a ojo** y nada medía si Jev acierta. | `jevcal.ts` cruza el puntaje de Jev con lo que pasó (aprobado igual, descartado, corregido, deshecho en el diario). Solo lectura |
| J8 | **Dos umbrales y dos preguntas distintas:** el motor usa un puntaje de 4 escalones con corte en 0.6; la noche usa `noul` con corte en 0.85. | Pendiente: se compara con la prueba nativa en paralelo (`noul_fiel`, no decide nada) y con datos reales se elige |

**Defecto de integración que halló la prueba y no el compilador:** el bloque «guardar primero» hacía `why = null` cuando todo lo demás era cierto y borraba la espera causada por Jev (obligatorio y caído, o poca seguridad). Corregido: si la espera la causó Jev, el plan espera completo.

**Reglas para las etapas que siguen:**
1. Jev solo **suma** duda: nunca convierte en «cierto» algo que las reglas de la app mandaron esperar, ni decide lo delicado (borrar, verificar, compartir).
2. La tabla de la **5.4** usa a Jev como una entrada más (puntaje, seguridad, motivo), junto a las reglas duras; no como la regla.
3. Ningún umbral de Jev cambia sin datos: primero `npx tsx scripts/jev-calibracion.ts` sobre casos reales (con muestra de 20 esperas resueltas como mínimo).
4. La **5.5** (noche) unifica el estilo de pregunta y el umbral del auto-aplicado solo después de medir la prueba nativa; el auto-aplicado sigue limitado a los dos tipos actuales y deshacible.
5. En la **fase 6**: banco con Jev simulado para probar sin red, y calibrar con pedidos reales.

**Lo que no hace este cambio:** no cambia el umbral (sigue 0.6), no vuelve obligatorio a Jev, no usa la seguridad para decidir y no toca la revisión nocturna. Todo eso queda apagado o por defecto hasta tener datos.

## Origen del dato (etapa 5.2)

**Qué resuelve.** Un dato se guardaba como verdad o no se guardaba: no había dónde escribir «dueño, según HB». Ahora `actualizar_campos`, `crear_ficha` y `conectar` llevan `clase` y `fuente`, y verificar deja de ser todo o nada.

- **Clases:** `persona` (lo dijo una persona del equipo, aunque no haya fuente pública), `publicado` (con la dirección en `fuente`), `documento` (correo o archivo), `inferido` (lo dedujo el Cerebro). **`verificado` no se puede poner por estas operaciones:** solo `marcar_verificado`, que aprueba una persona.
- **Dónde queda:** en el encabezado de la ficha, `field_sources` (un registro por campo) y `relation_sources` (uno por conexión), con quién lo escribió y cuándo. Se ocultan de la vista normal de datos y se muestran ordenados (`nodeContext().origins`, y `origen` / `relationOrigen` en los contactos de una consulta). Ambos nombres son campos protegidos: nadie puede falsificar un origen escribiéndolo como dato.
- **Sin origen dicho:** queda `sin_clasificar` con quién y cuándo (trazabilidad aunque nadie diga de dónde sale). La auditoría de la 5.5 puede listar esos campos.
- **Verificación por campo:** `marcar_verificado` acepta `campos_verificados`. Solo esos datos quedan verificados (con quién, cuándo y contra qué fuente) y **la ficha no pasa a verificada en su totalidad**. Escribir de nuevo un campo verificado le quita la verificación (el valor nuevo no es el que se verificó). Sigue siendo una operación que aprueba una persona.
- **La revisión lo usa:** en una ficha con verificación por campo, solo cambiar un dato verificado frena; cambiar otro no. Una ficha verificada entera, sin verificación por campo, frena como siempre.
- **Regla 18 del modelo:** lo que dice quien pide va como `persona` y nunca se descarta por falta de fuente pública; «dueño o socio» es `owner_of` (no `works_at`); no se registra un empleo, cargo o propiedad que el pedido no diga. Ataca los dos errores del caso de Pierre. Es la única regla de texto que se agrega en esta fase y va ligada a los parámetros nuevos.
- **Jev y las consultas lo ven:** el plan trae « · origen: …» (lo ve Jev, quien aprueba y el recibo) y la respuesta de una consulta debe decir el origen y no presentar como seguro lo no verificado.
- **Banco:** el caso 12 ahora mide: dueño como `owner_of` hacia MEDIMEX, con clase `persona` y quién lo dijo.

**Defecto de prueba (no de producto) hallado:** `upsertNode` copia cada ficha nueva a `<cwd>/vault` (la bóveda empaquetada del repo) cuando es el cerebro principal. Las pruebas que crean fichas deben correr con el directorio de trabajo en su carpeta temporal; `test:origen` lo hace y comprueba que no deja nada en el repo.

**Lo que no hace:** no reescribe fichas existentes para agregarles origen (solo lo que se escriba desde ahora), no cambia la interfaz del mapa (la ficha expone el origen por la API; mostrarlo en pantalla es un paso aparte) y no se probó con un modelo real: que el modelo ponga bien `clase` y `fuente` lo mide el caso 12 del banco cuando se corra.

## Vecindario (etapa 5.3)

**Qué resuelve.** El modelo veía de cada ficha solo `id | nombre | tipo`: no sabía que MEDIMEX opera en Panamá, lleva tres marcas y tiene contactos, así que no podía conectar bien a una persona nueva ni evitar duplicados. Y para que Pierre «apareciera bajo MEDIMEX con Panamá y sus marcas» habría que copiarle esos enlaces a mano.

- **Un enlace verdadero; lo demás se deriva al leer.** Pierre se conecta a MEDIMEX (dueño, según HB). Su mercado y sus marcas **salen de MEDIMEX** al leer y no se guardan en su ficha: si se copiaran, quedarían viejos cuando MEDIMEX cambie.
- **Qué se hereda lo dice la estructura, no el código.** `derives` en `00-System/estructura.yaml`: persona → empresa (por `works_at`, `contact_of`, `owner_of`, `key_person_of`) hereda `mercados` y `marcas`. Cuentan también los nombres que la bóveda ya usa (`market_jurisdiction`, `assigned_brands`, `sells_brands`, y los alias `belongs_to_market`, `carries_brands`). **No** cuentan `references` (menciones automáticas del texto) ni `signature_company` (firmas de correo). Sin la sección se usan los valores por defecto; `derives: []` la apaga. Una regla mal escrita rechaza todo el archivo (como en la 5.1).
- **`inverse` en cada relación:** cómo se llama el que escribe la relación visto desde el otro lado (`owner_of` → «dueño»), para listar en la empresa «Pierre — dueño, según HB».
- **El modelo recibe una tarjeta por ficha reconocida** (hasta 8, tope de 3.600 caracteres): datos clave (los que la estructura declara para su tipo, con su clase de origen), conexiones a un paso, contactos con su papel y lo que hereda. Para una empresa el orden es mercado, marcas y después personas; para una persona, su empresa primero. Cada pareja escrita de ida y de vuelta se cuenta una vez. El bloque de reglas del modelo agrega «SE HEREDA, NO SE CONECTA».
- **Lectura:** `nodeContext` expone `derived` (lo que hereda, diciendo que no está guardado) y `people` (si es una empresa, quién cuelga de ella y con qué papel); los contactos de una consulta traen `derivado`, y el Cerebro debe decirlo «a través de la empresa».
- **Datos reales (bóveda del repo):** Aisha, Ángelo y Luisa, conectados a SanCas (Belize), heredan Belize y sus cuatro marcas sin que nadie las copiara. Solo 6 de 64 personas tienen enlace a una empresa; el resto no hereda nada hasta que se conecte.
- **Costo:** unos 21 ms por pedido (recorre el grafo) y hasta ~900 tokens más en el contexto del modelo.

**Defectos de mi propio trabajo que halló la prueba:** (1) el recorte de la tarjeta de MEDIMEX botaba su mercado y sus marcas porque las personas iban primero; (2) la misma pareja salía dos veces; (3) el estado de verificación, a veces una frase entera en esta bóveda, ensuciaba la tarjeta. La mutación del orden no la detectaba ninguna prueba hasta que agregué el caso de una empresa con 12 personas.

**Lo que no hace:** no toca la pantalla del mapa ni cómo se decide el «padre» de una ficha (`parentOf`): eso es de `src/app/cerebro/*` y del hilo del mapa, y **Pierre aparece en el vecindario de MEDIMEX por su enlace de dueño pero no está verificado en pantalla**. La API ya entrega `derived` y `people` para que el mapa los pinte. Tampoco conecta nada por su cuenta ni reescribe fichas.

## Decisión simple (etapa 5.4)

**Qué resuelve.** Decidir si un pedido se guarda, se guarda en parte o espera era una cadena de condiciones dentro de `pedir()`, con efectos laterales y cuatro caminos de salida. Dos consecuencias medidas: (1) cambiar la dirección de MEDIMEX esperaba aprobación porque la regla «reemplaza un texto largo» saltaba con cualquier campo de más de 25 caracteres con espacios (`headquarters_address`, `job_title`, `payment_terms`, `last_email_subject`…); (2) el ensayo cortaba antes de «guardar primero», así que un pedido que sí se guardaba solo (Pierre) salía como «esperaría» y el banco medía mal.

- **Una tabla pura, `decide()`**, la misma para el pedido real y para el ensayo. De arriba abajo, la primera que aplica manda: **delicado** (borrar, verificar, compartir; nunca se afloja) → **grande / ajustes / agente** → **avisos fuertes** según su categoría → **Jev** (solo suma duda) → si algo espera pero otras partes son ciertas, **se guarda lo cierto y solo lo demás espera** → si nada espera, se guarda todo.
- **Cada espera lleva una categoría**: `delicado`, `grande`, `ajustes`, `agente`, `duplicado`, `identidad`, `dato_verificado`, `pisa_texto`, `fecha`, `campo`, `cobertura`, `jev_duda`, `jev_seguridad`, `jev_obligatorio`, y `dudoso` / `depende` por operación. Queda en el caso (`esperaCat`, `waitCats`, `decision`).
- **Texto libre vs dato corregible.** Qué es texto libre lo declara la estructura (`textFields`: notas, observaciones, resúmenes, `source`…), sacado de la bóveda real. Pisarlo con algo distinto espera; agregarle texto (el nuevo contiene el anterior) no. Una dirección, un cargo o unas condiciones de pago se guardan con un aviso de qué se reemplazó.
- **Política por categoría en Ajustes (`politica`), apagada por defecto.** Solo se pueden aflojar cinco: `duplicado`, `pisa_texto`, `campo`, `cobertura`, `jev_duda` (`'avisar'`: se guarda y queda el aviso). **Nunca** se aflojan `delicado`, `identidad` (no se adivina cuál persona), `dato_verificado` ni `fecha` que no cuadra; el valor se descarta al leer aunque alguien lo escriba en el archivo de ajustes.
- **El ensayo dice la verdad:** `decision.accion` = `guardar` / `guardar_parcial` / `esperar`, con cuántas operaciones se guardarían y cuántas esperarían. El banco mide con eso (con respaldo al texto de antes).
- **Contar las esperas:** `npx tsx scripts/esperas.ts` (solo lectura) dice cuántas esperas hubo de cada categoría y cuántas se aprobaron tal cual. **Una categoría aflojable con ≥ 10 esperas resueltas y ≥ 90 % aprobadas tal cual sugiere ponerla en «avisar»; una regla dura con ese patrón no se sugiere aflojar: dice que hay que mejorar el motor.** Con muestra chica advierte y no sugiere nada.
- **Lo que cambia respecto a hoy, a propósito, solo dos cosas:** la regla de texto libre y el ensayo. Todo lo demás conserva el comportamiento: las 14 suites anteriores pasan sin tocarlas, incluida la integración de Jev (duda en un cambio simple, Jev caído, obligatorio, poca seguridad).
- `engine.ts` bajó de ~800 a 734 líneas; `lowRisk`, `splitCierto` y `whyProposal` se reexportan desde `engine.ts` por compatibilidad.

**Hallazgos del proceso:** una de mis pruebas contaba mal (50 pedidos, no 49) y otra no podía borrar su carpeta temporal en Windows con el directorio de trabajo adentro; ambas eran de la prueba, no del producto. Las cuatro mutaciones (texto libre, guardar primero, lista de categorías duras, Jev que parte el plan) las detectan 5, 9, 3 y 3 comprobaciones.

**Lo que no hace:** no cambia ningún umbral de Jev ni afloja nada por sí solo; «Pierre en un solo mensaje y cero aprobaciones» está probado con un modelo simulado, y que el modelo real emita el plan completo lo mide el caso 13 del banco cuando se corra; la columna «aprobadas tal cual» solo tendrá datos cuando haya casos reales de producción (pendiente tu autorización para leerlos).

## Noche (etapa 5.5)

**Qué resuelve.** La noche estaba repartida y a medias: el informe de DOTS (`dots-sleep`) y el repaso de Jev corrían de noche, pero la regla de las 24 horas (`advanceStale`) solo corría cuando alguien visitaba la ruta del agente. Tras una noche sin visitas, lo vencido seguía vencido. Y nadie amanecía con un resumen de qué pasó.

- **Un solo proceso, `runNight()`**, que corre una vez al día después de las 2 a.m. de Panamá (misma hora y mismo temporizador que el informe; marcador por día en `dots-sleep/night/<día>.json`, sin repetirse). `CEREBRO_NIGHT_DISABLED=1` lo apaga. Corre por cada cerebro y no toca uno de solo lectura.
- **1. Avanza lo vencido:** los casos con pregunta de más de 24 h siguen con lo seguro, como ya mandaba la regla (`advanceStaleIds`, hasta 25 por noche y sin la espera de un minuto entre tandas). Los de formato anterior (sin `faltan`) siguen sin tocarse solos: se cuentan en la auditoría.
- **2. Sesión del día:** una nota en `05-Consolidation-Sessions` (`<día> - Sesion del dia (Cerebro).md`, tipo `consolidation_session`, marcada `generated_by: cerebro-noche`) con el resumen, la lista de casos del día enlazados a su nota de caso, lo que avanzó solo y la auditoría. Un día sin casos no deja nota vacía; una nota con ese nombre que no sea de la noche nunca se pisa; repetir la corrida reescribe la misma. Las notas de caso no se mueven ni se borran: la sesión solo las enlaza.
- **3. Auditoría de la estructura (solo lectura):** tipos, relaciones y campos que no están en `estructura.yaml` (las relaciones con nombre viejo y los alias cuentan como conocidas; el catálogo —`product_variant`, `flavor`, `packaging`, `catalog_listing`— y los textos libres que la estructura declara no se marcan), fichas sin ninguna conexión, posibles duplicados (mismo tipo y mismo nombre sin el prefijo), datos `sin_clasificar` (5.2) y casos viejos sin formato nuevo. Muestra 5 ejemplos de cada cosa; el resto solo se cuenta. Corrida sobre la copia local de la bóveda real: tipos `site`, `country`, `group`; relaciones con nombre viejo (`observed_contacts`, `parent_company`, `belongs_to_brand`…); campos como `tags`, `person_evidence_audit`; 9 fichas sueltas; 0 duplicados.
- **4. Resumen de la mañana:** 3 a 5 líneas (qué entró ayer, qué se guardó —solos y aprobados por una persona—, qué avanzó solo, qué falta por categoría y el más viejo, qué está raro). Se lee con `{action:'manana'}` (alias `resumen`, `morning`); la guía del agente lo dice.
- **Solo avisa.** Lo único que la noche escribe es la sesión del día y el resumen; lo único que cambia fichas es lo que ya hacía la regla de 24 h (guardar lo seguro del caso). No borra, no mueve, no aprueba, no cambia la estructura. El repaso de Jev y su auto-aplicado siguen igual y aparte (mismo umbral 0.85, mismos dos tipos): no se unificó el estilo de pregunta porque todavía no hay datos de la pregunta de prueba `noul_fiel`.

**Pruebas (`npm run test:noche`, 61):** cuándo toca (hora de corte, ya corrió), el día en casos (contadores, otro día no cuenta, abiertos con categoría), la auditoría con datos armados y dos ruidos vistos en la bóveda real, el resumen (plurales y brevedad), la sesión (nota ajena, repetición, día vacío), la corrida completa con el motor real y modelo simulado (avanza solo el vencido de formato nuevo; las fichas del negocio no cambian; lo único nuevo es la sesión y las notas de caso; cerebro de solo lectura; el avance falla y la noche sigue; poda a 30 resúmenes) y el temporizador con reloj simulado (lanza una vez, no se repite). Ocho mutaciones, todas detectadas.

**Hallazgos del proceso:** (1) usé `displayTitle` con la ficha entera en vez del título y marcaba duplicados falsos: la prueba lo mostró en el primer intento. (2) Al correr la auditoría sobre la bóveda real, el catálogo (cientos de enlaces propios) y los textos libres declarados llenaban la lista: se excluyeron y quedó una prueba para cada uno. (3) Varias expectativas mías sobre horas estaban mal (2 h antes de las 3 a.m. es de hoy, no de ayer): la prueba tiene ahora los dos lados.

**Lo que no hace:** no corrió con los casos reales de producción (el resumen de verdad lo verá HB mañana en producción, o cuando autorice leer sus datos); no avisa por correo ni notificación (solo se lee con `manana`); no repara nada de lo raro (decidir fusionar o reconectar sigue siendo de una persona, y fusionar fichas no está en el menú). Sí queda por decidir: si la sesión del día debe verse en el mapa (hoy el tipo `consolidation_session` ya existe y se muestra como las tres sesiones de arranque).

## 1. Cómo funciona hoy

1. Llega el pedido. La app busca por palabras las fichas que podrían ser y arma un bloque de contexto.
2. Un modelo de lenguaje recibe 20 reglas y 14 operaciones y debe devolver **el plan completo de un solo tiro**.
3. La app repara y revisa con reglas fijas (fechas, campos, duplicados, nombres ambiguos, horas, aerolíneas).
4. Jev pone una nota de 0 a 3 al plan.
5. Una cadena de condiciones decide: guardar, guardar una parte, o esperar aprobación.

Lo que está bien y se conserva: menú cerrado de operaciones, la app es la única que escribe, diario con recibo y deshacer, todo o nada, casos con acta, caja negra, entrada tolerante, guardar primero, una sola ronda de preguntas.

## 2. Diagnóstico

**D1. Se corrige por incidente, no por medición.** 31 cambios al motor en 3 días, casi todos una regla nueva para el último error (una lista fija de aerolíneas, una regla para renuncias, otra para vuelos). El banco de prueba tiene 10 pedidos y son esos mismos incidentes. No hay un número que diga si el motor mejora o empeora con cada cambio. Por eso se siente prueba y error.

**D2. La estructura vive en tres sitios que no coinciden.**
- El código conoce 10 relaciones y 11 tipos de ficha.
- El vault del repo usa unas 100 relaciones distintas: 994 de 1.077 usos están fuera de las 10 (sin contar catálogo, unas 220 de 305). MEDIMEX misma usa `belongs_to_market` y `managed_by`, que el motor no conoce. Hay 22 tipos de ficha; el motor crea 11.
- Las reglas del modelo nombran campos a mano (`email_primary`, `job_title`).
- Consecuencia: el motor deduce «campos válidos» de lo que otras fichas ya usan. Un campo legítimo y nuevo (correo general de una empresa) se marca como inventado.

**D3. No existe el origen de un dato.** Un dato se guarda como verdad o no se guarda. No hay forma de escribir «dueño, según HB» o «correo publicado en la web, sin confirmar». Por eso el agente borró lo que HB sabía de Pierre. Ya hay un precedente: 55 fichas traen un bloque de auditoría que separa campos verificados y no verificados; hay que generalizarlo.

**D4. El modelo ve nombres, no el vecindario.** El contexto es una lista `id | nombre | tipo`. No ve el mercado, las marcas ni los contactos de MEDIMEX, ni los campos de la ficha (salvo en el reintento). No puede «conectar con el resto de la estructura» porque no la ve.

**D5. La única salida para la duda es pedirle aprobación a HB.** Faltan salidas intermedias: guardar con su origen, o guardar y avisar. Además el aviso «fuerte» mezcla cosas distintas (posible duplicado, fecha que no cuadra, texto reemplazado). Ejemplo: cambiar una dirección cuenta como «reemplaza un texto que ya existía» y manda todo a aprobación.

**D6. Dos capas cautelosas en serie.** El agente (ChatGPT) reinterpreta a HB antes de que el Cerebro lo oiga y pide permiso por su cuenta; el Cerebro vuelve a dudar. La guía actual incluso le pide al agente listar «qué NO sabes». Resultado: tres aprobaciones para un contacto.

**D7. Hay dos «noches» separadas.** El ciclo de las 2 a. m. (`dotsSleep`) hace informe y propuestas. La regla de 24 horas de los casos solo corre cuando alguien llama a la app: sin visitas, no avanza.

**D8. Menores, pero reales.**
- El motivo de Jev se guarda en una variable compartida; con varios temas en paralelo puede quedar en el caso equivocado.
- Datos repetidos en una ficha (`phone_main` y `direct_contacts.phone`): el motor corrige uno y deja el otro.
- `engine.ts` tiene 813 líneas y una función de 160 con seis caminos de salida; es difícil de revisar.

## 3. Principios del plan

1. **Medir antes de cambiar.** Ningún cambio al motor entra sin pasar el banco.
2. **Una sola fuente para la estructura.** Código, reglas del modelo y validaciones salen del mismo archivo.
3. **Todo dato lleva su origen.** La palabra de HB es una fuente válida y se guarda como tal.
4. **Un enlace verdadero; lo demás se deriva al leer.** Pierre se enlaza a MEDIMEX y a HB. Su mercado y sus marcas se muestran a través de MEDIMEX, sin copiarlos (si se copian, quedan viejos cuando MEDIMEX cambie).
5. **Preguntar solo lo que bloquea.** Identidad dudosa o algo que no se puede deshacer. Lo demás se guarda con su origen y se avisa.
6. **Congelar las reglas por caso.** No se agregan más reglas al texto del modelo ni listas fijas mientras dure la fase.

## Contrato del agente (etapa 5.6)

**Qué resuelve.** Los agentes reescribían las palabras de HB, mezclaban su investigación con la orden, pedían permiso para cosas reversibles y contestaban a la persona con el acta entera (número de caso, ids, archivos).

**Qué hace.**
1. La guía (`guide.ts`, ES y EN) trae el contrato: `text` lleva las palabras de la persona tal cual; lo investigado va en `md` como evidencia aparte; una orden clara y reversible se manda sin pedir permiso (se pregunta solo por lo delicado o si no se sabe de quién se trata); un tema por caso.
2. Respuesta en dos niveles: `caso.paraPersona` es lo corto para la persona (qué se guardó, qué falta, si se puede deshacer; máximo 4 líneas; se recortan listas a 3 con «y N más»; se quitan ids, rutas y números de caso). `caso.texto` sigue siendo el acta completa para el registro. No cambia ninguna decisión del motor.

**Pruebas.** `npm run test:contrato` (24): cada estado del caso, recorte, inglés, limpieza de ruido y el contrato en la guía. Mutaciones detectadas: guía sin el contrato, sin recorte, sin limpieza de rutas. No detectada (guarda inocua): el tope de 4 líneas, que ya se cumple por construcción.

**Límites.** Esto es texto: no hay forma de obligar al agente a seguirlo. No se ha visto con ChatGPT/DOTS reales. `paraPersona` limpia ids con reglas simples; una ficha con nombre raro puede dejar una frase cortada.

## 4. Etapas

Cada etapa se sube sola y se cierra con su prueba, como en las fases 1 a 4.

| Etapa | Qué se construye | Qué nota HB | Prueba que la cierra |
|---|---|---|---|
| **5.0 Marcador** | Banco de 30 a 40 pedidos reales (sacados de la caja negra, con Pierre y el teléfono de MEDIMEX), corrido en ensayo. Tres números: resuelto en un mensaje, aprobaciones por pedido, resultado correcto. Arreglo del motivo de Jev compartido. | Un número del motor antes y después de cada cambio | El banco corre con un comando y deja el resultado guardado; queda la línea base |
| **5.1 Estructura única** | `00-System/estructura.md`: tipos, carpeta, campos por tipo, relaciones (entre qué tipos, y su inversa). El motor lo lee; las reglas del modelo y las validaciones se generan de ahí. Se agregan: dueño o persona clave de una empresa, correo general. Tabla de equivalencias para las relaciones viejas. Si el archivo está mal, se usa la última versión buena. | Crea un tipo o una relación editando un archivo, sin tocar código | Agregar una relación en el archivo y usarla en un pedido sin desplegar; un archivo roto no tumba el motor |
| **5.2 Origen del dato** | Cada dato guardado lleva quién lo dijo, cuándo y qué clase de fuente es (HB, publicado, verificado). La ficha y la respuesta lo muestran. Verificar deja de ser todo o nada. | «Dueño (según tú, 15-nov)» en la ficha, en vez de nada | El pedido de Pierre guarda «dueño» con origen HB y el correo como «publicado, sin confirmar» |
| **5.3 Vecindario** | El modelo recibe, por cada ficha reconocida, una tarjeta: campos clave, enlaces a un paso y contactos. El mapa y las consultas derivan mercado y marcas a través de la empresa. | Un contacto nuevo aparece bajo su empresa, con su mercado y marcas a la vista | Pierre aparece bajo MEDIMEX con Panamá y sus marcas sin que nadie cree esos enlaces |
| **5.4 Decisión simple** | Una tabla reemplaza la cadena de condiciones: reversible y cierto → guarda; reversible y con duda → guarda con origen y avisa; delicado o identidad dudosa → espera. Cada espera lleva una categoría que se cuenta. Se quita el falso positivo de textos reemplazados en campos de datos. | Menos aprobaciones; cuando hay una, dice por qué en una línea | Pierre: un mensaje, cero aprobaciones. Teléfono y dirección de MEDIMEX: se guardan sin esperar |
| **5.5 Noche** | Un solo proceso nocturno: avanza los casos de más de 24 horas, pasa los cerrados a la sesión del día, audita la estructura (duplicados, fichas sueltas, relaciones y campos fuera del archivo) y deja el resumen de la mañana. Solo avisa; no cambia nada. | Amanece con: qué entró, qué se guardó, qué falta, qué está raro | Tras una noche sin visitas, lo vencido avanzó y existe la sesión y el resumen |
| **5.6 Contrato del agente** | Guía nueva: pasar las palabras de HB tal cual, la investigación como evidencia aparte, una orden clara y reversible se manda sin pedir permiso, un tema por caso. Respuesta del Cerebro en dos niveles: una corta para la persona y el detalle para el registro. | Respuestas de tres líneas, sin números de caso ni nombres técnicos | El agente hace el pedido de Pierre en una llamada y contesta en menos de cinco líneas |

Dependencias: 5.2 y 5.3 necesitan 5.1. La 5.4 necesita 5.2. La 5.5 necesita 5.1 (la auditoría compara contra el archivo). La 5.6 puede adelantarse en parte (palabras de HB tal cual, no pedir permiso).

## 5. Lo que no se hace en esta fase

- Más reglas por caso en el texto del modelo, ni listas fijas nuevas.
- Operaciones nuevas en el menú (fusionar fichas queda para después).
- Copiar enlaces de mercado y marcas a cada contacto.
- Cambiar de modelo por impresión: se decide con el banco de la 5.0.
- Reescribir el motor. Se parte `pedir()` en pasos solo donde una etapa lo toque.

## 6. Riesgos

- **El archivo de estructura es poderoso.** Un cambio ahí mueve todo el motor. Se valida al cargar, se versiona y cambiarlo pide aprobación de HB.
- **Migrar relaciones viejas** toca cientos de fichas. Se hace con tabla de equivalencias al leer, no reescribiendo fichas; reescribir sería un paso aparte, con respaldo y aprobación.
- **Guardar más cosas solas** sube el riesgo de guardar algo mal. Lo compensan el origen visible, el recibo para deshacer y el banco.
- **Dos hilos sobre el mismo código.** El hilo «Motor de inteligencia» también toca `src/lib/cerebro/*`. Solo uno debe ejecutar esta fase.

## 7. Decisiones que necesito de HB

1. ¿Quién ejecuta la fase 5: esta sesión de Code o el hilo «Motor de inteligencia»? El otro se pausa.
2. ¿Me autorizas a leer la caja negra y los casos de producción para armar el banco de la 5.0? Es solo lectura.
3. ¿Encendemos «contactos» en Ajustes desde ya, como parche mientras llega la 5.4?
4. Notas de caso en el mapa: ¿visibles o en una capa apagada? (Sigue pendiente del roadmap anterior.)

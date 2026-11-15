# Fase 5 del motor del Cerebro: evaluación y plan

Fecha: 2026-11-15. Autor: Claude Code, a pedido de HB. Estado: **propuesta, nada construido**.
Base: lectura completa de `src/lib/cerebro/*` (2.065 líneas), la ruta `/api/agent/cerebro`, `brainLens`, el ciclo nocturno (`dotsSleep*`), las pruebas y el vault del repo en el commit `2cba707`. No se revisaron los datos de producción (caja negra, casos reales): lo que se dice de los casos de MEDIMEX y Pierre sale del código y de la conversación que pegó HB.

## Avance

- **5.0 Marcador: construida** (commit `cad0ae8`). Falta la línea base con modelos reales (no hay llaves aquí ni autorización de lectura de producción).
- **5.1 Estructura única: construida, sin commitear.** `src/lib/cerebro/structure.ts` + `vault/00-System/estructura.yaml`. Pruebas: `npm run test:estructura` (50). Dos cambios respecto al plan:
  - El archivo es **`.yaml`, no `.md`**: así no se carga como ficha del mapa y el modelo no puede editarlo con `actualizar_campos`.
  - La **inversa de cada relación se pospone a la 5.3**, donde se usa para derivar el vecindario; agregarla ahora sería un campo sin uso.
  - La bóveda de **producción no tiene el archivo todavía**: hasta que se copie, el motor usa los valores por defecto del código (idénticos; una prueba lo vigila). Copiarlo es un paso aparte que aprueba HB.

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

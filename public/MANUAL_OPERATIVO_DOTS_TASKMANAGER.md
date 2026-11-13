# Directiva Operativa para DOTS: Nuevo Modelo de Trabajo Unificado con el Segundo Cerebro y Task Manager

**Destinatario:** Agente DOTS (Gobernanza y Operaciones SMJ)  
**Emisor:** Oficina Ejecutiva / Chairman Office (S.M. Jaleel & Co. Ltd.)  
**Fecha de Vigencia:** 10 de Noviembre de 2026 en adelante (revisado contra el código el 11 de Noviembre de 2026)  
**Entorno de Producción:** `https://taskmanagergh.onrender.com`  
**Repositorio Central:** [TaskManagerGH](https://github.com/aimailhumberto-cloud/TaskManagerGH) | Rama: `main`  
**Almacenamiento Persistente (SSOT):** Disco `/data/vault` en Render. La carpeta `vault/` del repositorio solo siembra el disco la primera vez; después, **lo que está en Render es lo vigente**.

---

## 0. Novedades de la fase 1 (13 de noviembre de 2026) — LEER PRIMERO

La única fuente es la app en Render. No partas de copias locales (la carpeta `Downloads\SMJaleel\vault` está congelada).

| Para… | Usa | Qué devuelve |
|---|---|---|
| Registrar una novedad (correo, reunión, acuerdo) | `POST /api/agent/brain` `{"action":"record", nodeId, summary, type?, source?, date?, state?, followup?:{date,action}, lastEmail?:{subject,date,sender}, event?:{title,date,time?,endTime?,location?}, task?:{title,dueDate?,priority?}}` | Una sola llamada deja al día la ficha (bitácora, estado actual, próximo paso, último correo), la agenda (crea o **mueve** la reunión del mismo título) y la tarea. Todo o nada. |
| Saber qué cambió | `GET /api/agent/changes?since=AAAA-MM-DD` | Diario: quién, cuándo, por dónde, qué fichas y qué campos. Incluye archivos que cambiaron sin pasar por la app. |
| Deshacer un cambio | `POST /api/agent/changes {"action":"undo","changeId":"ch-…"}` | Vuelve los archivos a como estaban, si nadie los tocó después. |
| Armar el brief de la mañana | `GET /api/agent/brief?since=AAAA-MM-DD` | Tareas (vencidas, hoy, 48 h), seguimientos, agenda de 7 días, novedades, memoria abierta, indicadores, distribuidores y la hora de los datos. **El brief se arma solo con esto.** |

Reglas nuevas que la app hace cumplir:
1. **Recibo:** toda escritura devuelve `receipt` (qué cambió y cómo deshacerlo). Léelo y confírmale a HB lo que dice.
2. **Copias viejas:** reescribir un archivo que ya existe (`write_file`, `batch_sync`) exige `ifMatch` = el `hash` que dio la lectura (`GET /api/agent/vault-sync?path=` o `GET /api/agent/brain?node=`). Sin él: 428. Si alguien cambió el archivo entre medio: 409; vuelve a leer y reintenta.
3. **`upsert_node` combina:** los campos que envías pisan y el resto se conserva. Para reemplazar la ficha entera: `"replace": true` + `ifMatch`. No se puede crear otra ficha con un `id` que ya existe.
4. **Encabezado roto no entra** por ninguna puerta (400).
5. **Reintentos:** manda el encabezado `Idempotency-Key` (o `requestId` en el cuerpo); si repites la misma petición no se aplica dos veces.
6. **Agenda:** la misma reunión (tipo, título, día y hora) no se duplica. Para lo que viene de Outlook usa `source:"outlook"` + `externalId`.
7. **Fecha única:** toda escritura pone `updated_at`. No hace falta escribirla a mano.
8. **Cada ficha tiene dos partes en el texto:** «Estado actual» (se reescribe con `state`) y «Bitácora» (entradas con fecha y fuente; solo se agregan). No dejes en el texto dos versiones contradictorias.
9. `consolidate_session` ahora copia el contenido de cada nota a la bitácora de las fichas que menciona.
10. `POST /api/agent/hub` es del sistema anterior: lo que entra por ahí no llega al cerebro. No lo uses.

---

## 0b. Leer rápido y con contexto (fase 2, 13 de noviembre de 2026)

| Para… | Usa | Qué devuelve |
|---|---|---|
| Preguntar por algo («Busta en Canadá», «contactos de MEDIMEX», «distribuidores de Estados Unidos») | `GET /api/agent/dossier?q=<pregunta>&size=breve|normal|completo` (o `?node=id1,id2`) | Expediente: respuesta corta, fichas de origen, contactos (con correo y teléfono), último contacto, próximos pasos, agenda, cambios recientes, cifras, archivos, «puede interesarte» (con el porqué), «lo que falta» y la hora de los datos. Cada dato trae `from` (ficha de origen) y `verification`. |
| Buscar | `GET /api/agent/search?q=<texto>&type=person,distributor&limit=20&catalog=0` | Fichas ordenadas por relevancia, con extracto. Sin acentos; entiende Belice/Belize, EE. UU./United States. |
| Ver todo el cerebro de un vistazo | `GET /api/agent/map?catalog=0` | Una fila por ficha: id, nombre, tipo, padre, país, fecha, conexiones (~16 KB sin catálogo). |
| Leer una ficha con su entorno | `GET /api/agent/brain?node=<id>&context=1` | Ficha limpia (sin datos de procedencia) + `hash` + a quién apunta + quién la menciona + tareas abiertas + agenda + cambios + memoria abierta. |

Reglas: usa el expediente antes de redactar un correo o un resumen. Si algo aparece en «lo que falta», pregúntaselo a HB; no lo inventes. Evita `GET /api/agent/brain` completo (3 MB): usa el mapa, el buscador o el expediente.

---

## 0c. Hablar con «el Cerebro» en palabras (fase 3, 13 de noviembre de 2026)

El cerebro ya tiene su propia inteligencia, «el Cerebro». En vez de armar cada escritura, un agente puede decirle qué pasó o preguntarle, en palabras.

- **Pedir un cambio:** `POST /api/agent/cerebro` con `{"action":"pedir","text":"La reunión con MEDIMEX pasó al lunes 16 a las 3 pm; anótalo y crea tarea de enviar la propuesta el viernes."}`. El Cerebro arma el plan, la app lo revisa y responde con `status`:
  - `aplicado` (200): hecho; trae `results`, `changeId` y `receipt` para deshacer.
  - `pendiente` (202): quedó en «Por aprobar»; `why` dice por qué. Lo aprueba una persona en la app (Pedir → Por aprobar).
  - `pregunta` (200): falta un dato o no conoce a alguien; `message` trae la pregunta. Contesta con `{"action":"responder","id":"ped-…","text":"solo lo que falta"}`: el Cerebro recuerda el pedido y sigue. Si ya tienes el contexto (quién es la persona, su empresa, cargo, correo, la fuente), mándalo desde el primer pedido y no preguntará.
  - `no_entendido` (422) o `fallo` (502): no se cambió nada; `message` dice por qué.
- **La respuesta dice a quién reconoció** (`recognized`: ficha, tipo, verificada o no, nueva) y, al aplicar, **dónde quedó** (`links`). Revisa `recognized` antes de dar el pedido por bueno.
- **Reuniones:** di con quién y para qué; el Cerebro arma el título («Reunión con Tomás Casas: tema»), la pone en la agenda y la anota en la ficha de cada persona o empresa. Mover una reunión no la duplica.
- **No dupliques:** una tarea igual en la misma ficha se rechaza. Un pedido = un `Idempotency-Key`.
- **Leer un correo o nota:** `{"action":"leer","text":"<el correo entero>","source":"Correo de Fulano, 13 nov"}`. El Cerebro extrae personas (con correo, teléfono, cargo, empresa), fechas, compromisos y cifras; compara con lo que ya existe y devuelve `summary` («2 personas nuevas, 1 ficha con datos nuevos, 1 cifra, 1 punto dudoso») con el plan. No pregunta: lo dudoso queda en `obs.supuso`. No reenvíes el mismo correo: lo ya guardado se rechaza.
- **Observaciones (`obs`) en cada respuesta:** `supuso` (lo que asumió), `fuertes` (posible duplicado o cambio a una ficha verificada: va a aprobación), `avisos` (choque de agenda, posible contradicción), `falta` (datos que le faltan a las fichas) y `jev` (confianza). Léelas: si `falta` un dato que tú tienes, envíalo.
- **Por revisar:** `GET /api/agent/cerebro` trae `review` (pendientes de calidad). Ciérralos con `{"action":"revisado","id":"rev-…"}` cuando los resuelvas.
- **Qué se aplica solo lo decide la persona por tipo** (Ajustes): tareas y agenda, novedades, fichas nuevas, cifras. `why` dice por qué algo quedó esperando.
- **Ensayar sin aplicar:** añade `"dryRun": true` y devuelve el plan.
- **Consultar:** `GET /api/agent/cerebro?q=Busta en Canadá` → `answer` (respuesta corta) + `dossier` (el expediente completo de la sección 0b).
- **Ver estado y bandeja:** `GET /api/agent/cerebro` → ajustes, consumo, `pending`, `recent` y `menu` (lo que el Cerebro sabe hacer).
- **Siempre esperan a una persona:** borrar una ficha, marcarla verificada y cambiar quién la ve. También los pedidos grandes (más de 10 fichas tocadas o más de 5 creadas), los tipos que la persona dejó en «proponer», las tareas o fichas que se parecen a una existente y los cambios a fichas verificadas. Fusionar fichas todavía se hace a mano.
- Un agente puede aprobar (`{"action":"aprobar","id":"ped-…"}`) o rechazar propuestas si la persona lo permitió en Ajustes («Mi agente puede aprobar»). Cada decisión queda registrada como **manual** o **por el agente**, con quién y cuándo, en el pedido y en el diario de cambios. Aprueba solo lo que la persona te haya dicho que apruebes.
- Pedidos largos (un archivo de correcciones, hasta 60 000 caracteres): envíalos igual en `text`; van a propuesta para que la persona revise el plan entero.
- Usa `Idempotency-Key` en los pedidos para que un reintento no se aplique dos veces.
- Las rutas directas de las secciones 0 y 0b siguen funcionando igual.

## 1. Principio Fundamental: El Cerebro en Markdown es la Única Fuente de Verdad (SSOT)

A partir de esta actualización, **el Task Manager y el Segundo Cerebro operan como un solo sistema unificado**. 

1. **Cero bases de datos aisladas:** Toda tarea, hito de distribuidor, cuota comercial o rutina de planta debe nacer, actualizarse y resolverse en los archivos `.md` del vault. La pestaña Tareas no guarda nada propio: es una vista calculada de esos archivos.
2. **Cero emojis de celular:** Queda estrictamente prohibido el uso de iconografía informal (emojis de banderas, alertas o muñecos: 🇵🇦, ⚠️, 🟢, 🤖, etc.). Toda referencia territorial debe usar códigos monoespaciados estándar: `[PA]` Panamá, `[BZ]` Belice, `[CA]` Canadá, `[US]` Estados Unidos, `[TT]` Trinidad & Tobago, `[GL]` Global.
3. **Jerarquía Ejecutiva Inmutable:**
   - **Chairman / Apex:** Dr. Aleem Mohammed (Nivel Jerárquico 0).
   - **COO / Operaciones:** Sra. Anna Mohammed (Nivel Jerárquico 0).
   - **Dirección Ejecutiva / Comercial:** Humberto Bouché.
   - **Fábrica & Envasado:** Rajesh Maharaj (Planta South Oropouche, Trinidad).

---

## 2. Mapa de Ubicación y Estructura de Tareas en el Cerebro

El Task Manager escanea automáticamente el vault y compila el **Universo Unificado de Tareas** a partir de estas carpetas y campos del encabezado (frontmatter). La cantidad de tareas y de archivos cambia a diario; consúltala siempre en vivo con `GET /api/agent/tasks` y `GET /api/agent/vault-sync?status=1`, no de este documento.

```
vault/
├── 00-System/               -> Configuración interna (layouts del mapa). No tocar a mano.
├── 00-Working-Memory/       -> Solicitudes directas a DOTS y notas vivas (pulsing)
├── 01-Internal-Clients/     -> Gobernanza interna, directivas y roles
├── 02-External-Clients/     -> Distribuidores, Mercados y Clientes (Walmart)
├── 03-Portfolio-Supply/     -> Portafolio: marcas, líneas, productos, presentaciones y sabores
├── 04-Operations-Routines/  -> Rutinas S&OP mensuales y proyectos de apertura
└── 05-Consolidation-Sessions/ -> Sesiones de consolidación de memoria a largo plazo
```

### Cómo se forman las tareas (reglas reales del sistema)

| Origen en el archivo | Tipo de nodo | Prefijo del ID | Notas |
|---|---|---|---|
| `next_followup_action` (+ `next_followup_date`, `next_followup_completed`) | `distributor` | `fu-` | Un seguimiento por distribuidor. Al fijar uno nuevo con `update_dossier`, el sistema lo reabre solo. |
| `pending_tasks` | `distributor` | `pt-` | Lista de textos u objetos (`title`, `dueDate`, `priority`, `completed`...). |
| `pending_tasks` | `market` | `mkt-` | Tareas por plaza. |
| `pending_tasks` | cualquier otro nodo (marca, departamento, organización, core, país, grupo...) | `pt-` | Se muestran como tipo «adhoc». |
| `checklist` | `routine`, `project` | `chk-` | Las rutinas mensuales **se renuevan solas cada mes**: lo completado en un mes anterior vuelve a aparecer pendiente. |
| archivo de `00-Working-Memory/` | `working_memory` | `wm-` | Desaparecen de Tareas al quedar `status: consolidated` o `archived`. |

El **ID es un hash del texto** salvo que la tarea sea un objeto con campo `id`: si cambias el texto de una tarea escrita como simple texto, su ID cambia. Para tareas que vas a seguir en el tiempo, créalas con `action: "create"` (guarda un objeto con `id` estable). Los IDs reales (por ejemplo `fu-dist-medimex-validar-actualizacion-de-reg-1a2b3c4d`) se obtienen siempre de `GET /api/agent/tasks`; no los construyas a mano.

### A. Tareas y Cuotas de Distribuidores (`02-External-Clients/Distributor - [Nombre].md`)
Cuando interactúes con un distribuidor (MEDIMEX, SanCas, Morgan Williams, Walton & Post, Nando's Belize), mantén actualizados estos campos del encabezado YAML. El semáforo de cuota compara el acumulado del año contra el **ritmo esperado a la fecha** (meta anual prorrateada por mes), no contra la meta completa:

```yaml
---
id: dist-medimex
title: "Distributor: MEDIMEX"
type: distributor
company_name: "MEDIMEX S.A."
market: "[[Market - Panama]]"
based_in_country: "Panamá"

# 1. Monitoreo de Cuota Anual y S&OP
annual_forecast_cases: 45000       # Cuota anual acordada en cajas (solo si HB la confirmó)
actual_cases_ytd: 38250            # Cajas despachadas acumuladas en el año (solo cifras reales)

# 2. Próximo Seguimiento Obligatorio
next_followup_date: "2026-11-12"   # Formato YYYY-MM-DD (usado por el Radar Diario)
next_followup_action: "Validar actualización de registro sanitario en APA / MINSA Panamá"
next_followup_completed: false     # true cuando se resuelve; el sistema lo vuelve a false al fijar un seguimiento nuevo

# 3. Lista de Tareas Operativas Pendientes (texto simple u objeto con id estable)
pending_tasks:
  - "Confirmar fecha de arribo del primer embarque de Chubby Tutti Frutti a Balboa."
  - id: pt-dist-medimex-registro-sanitario
    title: "Validar actualización de registro sanitario en APA / MINSA Panamá."
    dueDate: "2026-11-12"
    priority: High
    completed: false

# 4. Bitácora Histórica (se muestra en la ficha; el sistema conserva las 50 entradas más recientes)
recent_actions:
  - date: "2026-11-10"
    type: "solicitud_dots"
    summary: "Instrucción despachada a DOTS: Redactar correo formal de seguimiento."
  - date: "2026-11-09"
    type: "reunion_ejecutiva"
    summary: "Confirmación de distribución oficial exclusiva y revisión de stock Chubby 250ml."
---
```

### B. Rutinas S&OP y Proyectos (`04-Operations-Routines/`)
Las rutinas mensuales (como `Routine - Monthly SOP Forecast & 90-Day POs`) y los proyectos (`Project - ...`) alimentan el Task Manager a través del array `checklist`. El vencimiento de una rutina es el día `due_day_of_month` del mes en curso (ajustado a meses cortos), hora de Panamá:

```yaml
---
id: routine-monthly-sop-forecast-pos
title: "Routine: Cierre Mensual S&OP Forecast & Rolling 90-Day POs"
type: routine
frequency: "monthly"
due_day_of_month: 5
checklist:
  - text: "Validar inventario en tránsito y sell-out del mes previo en Canadá, EE. UU., Panamá y Belice"
    completed: false
  - text: "Consolidar órdenes de compra (POs) en firme a 30, 60 y 90 días"
    completed: false
  - text: "Cruzar requerimientos de sabor Chubby/Fruta con Rajesh Maharaj en Planta Trinidad"
    completed: false
  - text: "Confirmar con Supply Chain reserva de espacio naviero"
    completed: false
---
```

---

## 3. Protocolo de Ejecución del Botón «Pedir a DOTS»

Cuando el Chairman o un usuario ejecutivo presiona **«Pedir a DOTS»** (`POST /api/agent/tasks` con `action: "ask_dots"`), el sistema hace esto, en este orden:

1. Actualiza el expediente de origen (el archivo del distribuidor, mercado, rutina, etc.): `dots_status: solicitado`, `dots_stage: solicitado`, `dots_task_id` (la tarea concreta que se pidió), `last_dots_instruction`, `last_dots_request_at` y una entrada `solicitud_dots` en `recent_actions`. Si el YAML de ese archivo está dañado, **no crea nada** y devuelve error.
2. Crea la nota de instrucción en `00-Working-Memory/` con ID único `wm-AAAAMMDD-HHMM-xxxxxxxx`.

El estado de DOTS pertenece a **la tarea pedida** (`dots_task_id`), no a todo el archivo: las demás tareas del mismo expediente no se marcan «En trámite».

### Ciclo de vida de una instrucción

`solicitado` → `recibido` → `en_analisis` → `borrador_listo` → `aprobado_resuelto`

Tú (DOTS) avanzas cada etapa con **`POST /api/agent/tasks`, `action: "advance_dots"`**; el sistema marca las casillas de la nota, cambia `status` (`in_review_dots` mientras está abierta, `completed` al aprobarse) y refleja la etapa en el expediente de origen. No edites estos campos a mano si puedes usar la acción.

```bash
# Recibida y en análisis
curl -X POST "$TASKMANAGER_URL/api/agent/tasks" -H "Content-Type: application/json" \
  -d '{"action":"advance_dots","workingMemoryId":"wm-20261110-1430-ab12cd34","stage":"en_analisis"}'

# Borrador listo, con el entregable dentro de la nota
curl -X POST "$TASKMANAGER_URL/api/agent/tasks" -H "Content-Type: application/json" \
  -d '{"action":"advance_dots","workingMemoryId":"wm-20261110-1430-ab12cd34","stage":"borrador_listo","draft":"Asunto: Seguimiento ... (texto del correo)"}'
```

`aprobado_resuelto` lo decide el Chairman/HB; DOTS llega hasta `borrador_listo`. Completar la **tarea original** es un paso distinto: `action: "complete"` con el `taskId` de la tarea.

### Formato de la nota que recibirás en `00-Working-Memory/`

```yaml
---
id: wm-20261110-1430-ab12cd34
title: "Instrucción DOTS: Validar actualización de registro sanitario en APA / MINSA Panamá"
type: working_memory
memory_tier: working
status: in_review_dots        # abierta: requiere tu atención
lifecycle_stage: solicitado
assigned_to: "DOTS Agent"
requested_by: "Chairman / Executive Office"
target_task_id: "fu-dist-medimex-validar-actualizacion-de-reg-1a2b3c4d"
target_node: "[[Distributor - MEDIMEX]]"
captured_at: "2026-11-10T14:30:00.000Z"
panama_time: "2026-11-10 09:30 a. m."
instruction: "Redactar correo formal de seguimiento a MEDIMEX ..."
relations:
  touches:
    - "[[Distributor - MEDIMEX]]"
---
```

El cuerpo trae la tarea de referencia, la entidad, el mandato y la lista de 5 etapas.

### Tu responsabilidad al procesar la instrucción
1. **Leer el contexto:** abre el archivo de `target_node` (por ejemplo `02-External-Clients/Distributor - MEDIMEX.md`) para extraer contactos, términos de entrega e historial. Usa solo datos que estén en el vault.
2. **Generar el entregable:** correo, auditoría de cuota (acumulado vs. ritmo esperado a la fecha), resumen, etc. Sin inventar cifras.
3. **Avanzar la etapa** con `advance_dots` y entregar el texto en `draft`.
4. **No cierres la tarea original** salvo que HB lo indique: eso se hace con `complete`.

### Memoria de trabajo y consolidación
- `remember_working` crea una nota viva (`status: pulsing`) con enlaces a nodos **que existan** en el vault (usa el nombre exacto del archivo, p. ej. `[[Person - Humberto Bouche]]`).
- `consolidate_session` promueve las notas a memoria de largo plazo (`consolidated`). **No toca** las instrucciones abiertas para DOTS (`in_review_dots`, `solicitado`, `recibido`, `en_analisis`, `borrador_listo`) y la respuesta lista las notas omitidas. Si ya hubo una consolidación el mismo día, crea otro archivo de sesión en vez de pisar el anterior.

---

## 4. Endpoints y Herramientas API Disponibles para DOTS

Todas las rutas cuelgan de `$TASKMANAGER_URL` (producción: `https://taskmanagergh.onrender.com`). Si se exigen claves de acceso, se entregan por variable de entorno; **nunca se escriben en este manual ni en el vault**.

| Endpoint | Método | Acción | Propósito |
|---|---|---|---|
| `/api/agent/tasks` | GET | (opcional `?lens=&market=`) | Universo de tareas, vencidas, próximas 48 h y semáforo de cuotas. Aquí se obtienen los `taskId` reales. |
| `/api/agent/tasks` | POST | `complete` (`taskId`, `completedBy`) | Resolver una tarea. |
| | | `reschedule` (`taskId`, `newDueDate` AAAA-MM-DD) | Reagendar (seguimientos, pendientes, checklist y notas de memoria). |
| | | `ask_dots` (`taskId`, `instruction`, `requestedBy`) | Crear una instrucción para DOTS. |
| | | `advance_dots` (`workingMemoryId` o `taskId`, `stage`, `draft`) | Avanzar el ciclo de vida de una instrucción. |
| | | `create` (`title`, `dueDate`, `priority`, `country`, `targetNodeId`, `description`) | Crear una tarea. Con `targetNodeId` la guarda en ese nodo (id exacto o nombre único); sin él, la crea como nota de memoria de trabajo. |
| `/api/agent/brain` | GET | (sin parámetros) | Topología completa: nodos con su texto y encabezado íntegros, enlaces, jerarquía. Es la consulta pesada (varios MB); úsala solo si necesitas leer muchos expedientes a la vez. |
| | | `?node=<id>` | **Un solo nodo** con cuerpo y encabezado completos. Es la forma normal de leer un expediente. |
| | | `?version=1` | Firma del vault (casi 0 KB). Si no cambió desde la última vez, no hace falta releer nada. |
| | | `?view=lite` | Mapa liviano para dibujar (sin cuerpos ni campos de procedencia). |
| `/api/agent/brain` | POST | `remember_working` | Guardar una memoria temporal. |
| | | `consolidate_session` | Consolidar memoria (ver reglas arriba). |
| | | `update_dossier` | Actualizar una ficha: último correo, próximo seguimiento, observaciones, nueva acción, nueva tarea pendiente. |
| | | `upsert_node` | Crear o reemplazar un nodo completo (ruta, frontmatter, cuerpo). |
| | | `reconfigure_node_topology` | Cambiar mercado, canal, proveedor, clientes, marcas, coordenadas o relaciones de un nodo. |
| | | `assign_parent` | Asignar el nodo padre (el padre debe existir). |
| | | `update_layout_config` / `reset_layout_config` | Ajustar o restaurar la configuración del mapa. |
| `/api/agent/vault-sync` | GET | `?status=1` / `?export=json` | Estado del vault y exportación completa. |
| | POST | `batch_sync` (`files: [{path, content}]`) | Escribir archivos al vault de Render. Rechaza `.md` con encabezado YAML ilegible. |
| | | `delete_file` (`path`) | Borrar un archivo del vault de Render. **Usar solo con instrucción expresa de HB.** |
| `/api/agent/hub` | GET/POST | `ingest_email`, `ingest_message`, `ingest_voice_note`, `sync_meeting_notes`, `brain_dump`, `calendar_sync`, `completeTask`, `rescheduleTask`, `validateTask` | Entradas de correo, mensajes, voz y calendario hacia el espacio de trabajo. |

### Cómo escriben las acciones (garantías)
- Los archivos se reescriben con un generador YAML (las comillas, los saltos de línea y los dos puntos en los textos ya no rompen el encabezado).
- Si el encabezado YAML de un archivo **no se puede leer**, la acción devuelve error y **no modifica el archivo**.
- La escritura es atómica y se verifica leyéndola de vuelta; si la verificación falla, se restaura el original.
- Si el archivo cambió mientras se procesaba la acción, se aborta con «Reintenta».
- Un nodo destino debe indicarse con su `id` o nombre exacto; si el texto coincide con varios nodos, la acción devuelve error en lugar de adivinar.

### Ejemplo: marcar una tarea como resuelta
```bash
curl -X POST "$TASKMANAGER_URL/api/agent/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "complete",
    "taskId": "<id exacto obtenido de GET /api/agent/tasks>",
    "completedBy": "DOTS Autonomous Agent"
  }'
```

### Tres copias del vault (cuidado)
Existen el vault de Obsidian (local), la carpeta `vault/` del repositorio y el disco de Render. **Render tiene la información más reciente.** El script `scripts/sync-vault-cloud.mjs` ya no sobrescribe a ciegas: `diff` muestra diferencias, `push`/`pull` simulan por defecto y solo escriben con `--apply`, respaldan lo que reemplazan y nunca borran.

---

## 5. Reglas Inviolables de Fidelidad Operativa

1. **Panamá:** El distribuidor oficial y exclusivo es **MEDIMEX S.A.** (confirmado por HB). «Panama Central Hub» fue una entidad sin corroborar; no debes asignarle tareas ni transferirle compromisos de MEDIMEX.
2. **Belice:** El distribuidor líder para canal moderno y supermercados es **Santiago Castillo Ltd. (SanCas)** en Belize City. Para canal mayorista existe relación documentada con **Nando's Wholesale LLP**. La exclusividad total está sujeta a revisión contractual frente a Nando; debe conservarse el historial de ambos operadores sin tratar a SanCas como exclusivo absoluto ni borrar antecedentes. Puerto de arribo: CIF Port of Belize.
3. **Canadá:** El importador y distribuidor es **Morgan Williams International Inc.** en Ontario (contacto clave: Jenna Hector). Líneas core: Chubby y Busta.
4. **Estados Unidos:** El Master Distributor es **Walton and Post Inc.** en Miami, Florida (contactos: Walvyx Parra, Wazid Baksh). Puertos: PortMiami / Port Everglades.
5. **No Alucinación:** Nunca inventes distribuidores, ni precios, ni acuerdos no avalados en los insumos oficiales de HB. Ante cualquier duda, registra una consulta con `remember_working` (queda `status: pulsing`).

---

**Aprobado por:** Oficina Ejecutiva / Chairman Office  
**S.M. Jaleel & Co. Ltd. — 2026**

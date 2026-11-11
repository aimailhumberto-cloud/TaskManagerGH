# Directiva Operativa para DOTS: Nuevo Modelo de Trabajo Unificado con el Segundo Cerebro y Task Manager

**Destinatario:** Agente DOTS (Gobernanza y Operaciones SMJ)  
**Emisor:** Oficina Ejecutiva / Chairman Office (S.M. Jaleel & Co. Ltd.)  
**Fecha de Vigencia:** 10 de Noviembre de 2026 en adelante (revisado contra el código el 11 de Noviembre de 2026)  
**Entorno de Producción:** `https://taskmanagergh.onrender.com`  
**Repositorio Central:** [TaskManagerGH](https://github.com/aimailhumberto-cloud/TaskManagerGH) | Rama: `main`  
**Almacenamiento Persistente (SSOT):** Disco `/data/vault` en Render. La carpeta `vault/` del repositorio solo siembra el disco la primera vez; después, **lo que está en Render es lo vigente**.

---

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
| `/api/agent/brain` | GET | | Topología del Cerebro (nodos, enlaces, jerarquía). |
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

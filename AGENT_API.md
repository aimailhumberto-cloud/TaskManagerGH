# 🤖 TaskManager HB — Manual de Conectividad y Endpoints del Agente IA (`/api/agent/hub`)

**URL de Producción (Render):** `https://taskmanagergh.onrender.com/api/agent/hub`  
**Cuenta Google Vinculada:** `hebouche@gmail.com`  
**Zona Horaria Operativa:** `America/Panama` (`UTC-5`)

---

## 1. Visión General del Flujo Redundante (Gmail + Calendar + Celular/Notes ↔ TaskManager HB)

El Hub del Agente (`/api/agent/hub`) está desbloqueado en producción con soporte **CORS completo** para permitir que tu Agente de IA, automatizaciones (n8n / Make / OpenClaw / Hermes) y atajos del celular (**iOS Shortcuts / Apple Notes / Grabadora de Voz**) lean y escriban directamente sobre tu centro de control ejecutivo.

### Empresas y Sub-marcas Canónicas de Humberto (`companyId`)
| Empresa | `companyId` | Sub-marcas / Categorías (`category`) |
| :--- | :--- | :--- |
| **Surf Shack** | `business-surf-shack` | `Playa Caracol`, `Legal y Pagos`, `Operación` |
| **Academia Nacional de Surf** | `business-academia-surf` | `Surf 101`, `Instructores`, `Programas` |
| **Casa Mahana** | `business-casa-mahana` | `Reservas`, `Mantenimiento`, `Huéspedes` |
| **Soluciones Express** | `business-soluciones-express` | `Operaciones`, `Logística`, `Clientes` |
| **Mahana Tours** | `business-mahana-tours` | `Tours`, `Transporte`, `Alianzas` |
| **Bee Smart** | `business-bee-smart` | **`IA para Todos`**, `Ingredienta`, `Hotel Panamá Canal`, `Rollup y Flyers` |
| **S.M. Jaleel** | `business-sm-jaleel` | `Contrato Año 1`, `Scorecard 14 Criterios`, `Canadá / Caribe` |
| **Personal** | `local-personal` | `Viajes y Visas`, `Salud / Healing`, `Personal` |

*(Nota: Si el agente no envía `companyId`, el Hub detecta automáticamente la empresa y sub-marca analizando palabras clave como "Armando", "IA para Todos", "Ingredienta", "Surf Shack", "SM Jaleel", etc.)*

---

## 2. Lectura Completa del Estado Operativo (`GET /api/agent/hub`)

Tu agente puede consultar en un solo llamado todo lo que ocurre hoy, reuniones próximas, entregables activos, bandeja por validar y el snapshot de Google Calendar:

```bash
curl -s https://taskmanagergh.onrender.com/api/agent/hub
```

**Respuesta JSON:**
- `summary`: Conteo en vivo de `todayPendingCount`, `overdueOrAlertCount`, `deliverablesActiveCount`, `upcomingMeetingsCount`, `inboxToValidateCount`.
- `todayTasks`: Tareas activas de hoy.
- `upcomingMeetings`: Reuniones agendadas ordenadas cronológicamente.
- `inboxToValidate`: Tareas que el agente dejó en modo consulta (`NeedsConfirmation`) esperando el clic de Humberto en **`✓ Activar`**.
- `companies`: Todas las empresas activas con sus sub-marcas.
- `capabilities`: Autodocumentación de todas las acciones `POST` soportadas.

---

## 3. Acciones del Agente (`POST /api/agent/hub`)

### A. Ingestar Correo de Gmail o Mensaje de WhatsApp (`action: "ingest_email"`)
Cuando entra un correo a `hebouche@gmail.com`, el agente tiene dos modos:
- **`mode: "ask_first"`**: Lo coloca en la **📥 Bandeja por Validar** del dashboard para preguntarle primero a Humberto.
- **`mode: "auto_confirm"`**: Lo agenda directamente en **Operación Hoy** y en la **Agenda Semanal**.

```bash
curl -X POST https://taskmanagergh.onrender.com/api/agent/hub \
  -H "Content-Type: application/json" \
  -d '{
    "action": "ingest_email",
    "mode": "ask_first",
    "title": "Confirmar requerimiento audiovisual con Armando",
    "from": "Armando Pinzón <armando@ejemplo.com>",
    "subject": "Avances IA para Todos",
    "snippet": "Humberto, te envío la propuesta actualizada para revisarla mañana a las 10:00 AM.",
    "sourceUrl": "https://mail.google.com/mail/u/0/#inbox/1965abc123",
    "companyId": "business-bee-smart",
    "category": "IA para Todos",
    "workDate": "2026-10-21",
    "isMeeting": true,
    "meetingTime": "10:00",
    "steps": [
      "Revisar propuesta adjunta de Armando",
      "Aprobar presupuesto audiovisual"
    ]
  }'
```

---

### B. Auto-Sincronizar Grabación de Audio o Nota de Reunión desde el Celular (`action: "ingest_voice_note"`)
Cuando Humberto graba una reunión en **Apple Notes**, **Notas de Voz**, **Google Recorder** o desde el celular, este endpoint **busca automáticamente la reunión correspondiente en el Task Manager** (por `taskId`, por `meetingQuery` como `"Armando"` o por fecha `workDate`) y le inyecta la transcripción, el resumen ejecutivo, el enlace del audio y los pasos extraídos:

```bash
curl -X POST https://taskmanagergh.onrender.com/api/agent/hub \
  -H "Content-Type: application/json" \
  -d '{
    "action": "ingest_voice_note",
    "meetingQuery": "Armando",
    "noteSource": "Apple Notes (iPhone)",
    "transcript": "En la reunión con Armando acordamos cerrar el proveedor de pantallas LED antes del viernes y validar el arte de IA para Todos.",
    "summary": "Acuerdo de proveedor LED y validación de arte esta semana.",
    "audioUrl": "https://drive.google.com/file/d/ejemplo-audio-armando",
    "extractedSteps": [
      "Cerrar proveedor de pantallas LED (viernes)",
      "Validar arte final de IA para Todos"
    ],
    "nextAction": "Enviar confirmación por correo a Armando"
  }'
```

---

### C. Volcado Rápido en Lenguaje Natural (`action: "brain_dump"`)
Recibe un párrafo libre dictado o escrito por Humberto y crea automáticamente múltiples tareas/reuniones clasificadas por empresa, sub-marca, fecha y hora:

```bash
curl -X POST https://taskmanagergh.onrender.com/api/agent/hub \
  -H "Content-Type: application/json" \
  -d '{
    "action": "brain_dump",
    "text": "Mañana 10am reunión con Armando sobre IA para Todos; pedir cotización de empaques a Ingredienta; revisar pagos de Surf Shack el viernes",
    "defaultMode": "auto_confirm"
  }'
```

---

### D. Sincronización Bidireccional con Google Calendar (`action: "calendar_sync"`)
Sincroniza los eventos de `hebouche@gmail.com` hacia Render y devuelve todas las reuniones activas del Task Manager para que el agente mantenga ambos calendarios idénticos:

```bash
curl -X POST https://taskmanagergh.onrender.com/api/agent/hub \
  -H "Content-Type: application/json" \
  -d '{
    "action": "calendar_sync",
    "accountEmail": "hebouche@gmail.com",
    "createTasksForNewEvents": true,
    "events": [
      {
        "id": "gcal-armando-20261021",
        "title": "Reunión con Armando Pinzón · IA para Todos",
        "startIso": "2026-10-21T10:00:00-05:00",
        "endIso": "2026-10-21T11:00:00-05:00",
        "htmlLink": "https://calendar.google.com/calendar/event?eid=ejemplo"
      }
    ]
  }'
```

---

### E. Acciones Directas sobre Tareas y Empresas
- **Completar tarea:** `{"action": "completeTask", "taskId": "<uuid>"}`
- **Reprogramar tarea/reunión:** `{"action": "rescheduleTask", "taskId": "<uuid>", "workDate": "2026-10-22", "meetingTime": "14:30"}`
- **Validar o descartar ítem de Bandeja:** `{"action": "validateTask", "taskId": "<uuid>", "decision": "confirm"}` (o `"dismiss"`)
- **Crear empresa:** `{"action": "createCompany", "fields": {"name": "Nueva Empresa"}}`

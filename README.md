# TaskManager HB 👔

> **Plataforma Ejecutiva Unipersonal de Tareas, Decisiones y Empresas para Humberto**

`TaskManager HB` es un centro de comando operativo y estratégico diseñado específicamente para ser manejado por **una sola persona** (Humberto). Conecta y centraliza en un único flujo de trabajo diario todas sus empresas, proyectos, tareas, decisiones estratégicas, agentes autónomos (Lumen), integraciones de calendario y canales de comunicación (WhatsApp).

---

## 🎯 Filosofía y Principios del Sistema

1. **Unipersonal por Diseño ("Hoy, Humberto"):**
   - El espacio de trabajo está centrado en Humberto como operador y tomador de decisiones principal.
   - Todo el trabajo activo se filtra y rige por pertenencia (`belongsTo(task, actorId)`), asegurando que Humberto solo vea lo que requiere su atención, decisión o supervisión.

2. **Día Único, Múltiples Empresas:**
   - La pantalla principal consolida la jornada completa, permitiendo filtrar instantáneamente entre **"Todas las empresas"** o una empresa en específico (Mahana, Surf Shack, Radisson, SM Jaleel, etc.).
   - Separación estricta entre **"Hoy"** y **"Pendientes de días anteriores"** (carry-over sin pérdida de contexto ni duplicación).

3. **Decisiones vs. Verificaciones:**
   - Se distinguen claramente las **"Decisiones para tomar"** (que requieren criterio estratégico y desbloquean proyectos) de los **"Registros por verificar"** (datos pendientes de confirmación de vigencia).

4. **Acciones Directas sin Pérdida de Historia:**
   - Acciones inmediatas de **Hecho**, **Reabrir** y **Reprogramar** directamente en tarjetas y vistas de lista.
   - Reprogramar una fecha de trabajo conserva intacto el vencimiento (`dueDate`) original de la tarea.
   - Marcar un paso o subtarea actualiza el proyecto padre directamente en la base de datos sin clonar ni generar tareas huérfanas.

5. **Seguridad y Control de Revisiones Optimistas:**
   - Cada tarea cuenta con control de versión estricto (`revision`). Si dos procesos intentan modificar la misma tarea, el sistema detecta el conflicto (`409 Conflict`) y preserva el borrador local sin sobrescribir datos.
   - Selección explícita de campos públicos: las APIs y el SSR no exponen secretos, contraseñas, hashes ni configuraciones SMTP.

---

## 🧭 Vistas y Módulos Principales

### 1. Inicio (`/` o `/home` — "Hoy, Humberto" · V2 Telemetría Ejecutiva)
- **Barra de Telemetría Ejecutiva (`ExecutiveTelemetryHero` — sin foto de paisaje):**
  - **Relojes del Mundo y Clima en Vivo:** Hora oficial de Panamá (`America/Panama`), Trinidad & Tobago (`America/Port_of_Spain` — S.M. Jaleel) e indicador de Playa Caracol.
  - **Pie Chart / Donut 1 (`Ejecución Hoy`):** Progreso visual de operaciones completadas, en curso y pendientes del día.
  - **Pie Chart / Donut 2 (`Carga por Empresa`):** Distribución proporcional del trabajo activo entre tus empresas.
  - **Gráfica de Barras (`Ritmo Semanal Lu–Do`):** Velocidad operativa en los 7 días de la semana.
- **Pantallazo Ejecutivo con 4 Tarjetas KPI Interactivas (Filtros en 1 clic):**
  1. **Operación Hoy:** Filtra la lista inferior a las operaciones programadas para hoy.
  2. **Por Vencer & Alertas:** Filtra la lista inferior a las tareas arrastradas o por vencer (con acciones rápidas `⚡ Traer a Hoy`, `✓ Hecho`, `📅 +1 día`).
  3. **Entregables & Proyectos:** Despliega en la lista inferior los entregables e iniciativas clave (*IA para Todos*, *Ingredienta*, *S.M. Jaleel*, *Surf Shack*).
  4. **Próxima Reunión:** Muestra la siguiente cita agendada (ej. *Reunión con Armando 10:00 AM*, *Cita del Jueves*) y abre el calendario.
- **Portafolio Real de Empresas + Administrador Modificable (`+ ⚙️ Empresas`):**
  - Tus 7 unidades de negocio reales (**Surf Shack**, **Academia Nacional de Surf**, **Casa Mahana**, **Soluciones Express**, **Mahana Tours**, **Bee Smart** *(con **IA para Todos** anidado como sub-marca/proyecto)* y **S.M. Jaleel**) + **Personal**, con editor integrado para crear o renombrar empresas.
- **Bandeja de Validación Rápida & Agenda Viva:**
  - Sustituye el antiguo bloque estático de registros por verificar por una bandeja accionable con botones `✓ Activar` y `✕ Descartar`, más creación rápida de citas (`+ Nueva Reunión`).
- **Panel de Decisiones Estratégicas:** Bandeja de decisiones pendientes y resueltas con histórico de motivos.
- **Avance por Empresa:** Métricas de completitud, pendientes de hoy y barras de progreso en tiempo real por cada negocio.
- **Diseño Responsivo Móvil y Escritorio:** Cuadrícula adaptativa 2x2 en smartphones (`390px` / `320px`) sin desbordamiento horizontal y con botones táctiles de mínimo `40px`.

### 2. Tus Empresas (`/empresas`)
- Cuadros de mando consolidados por empresa con desglose de tareas, pasos y proyectos existentes.
- **Centro Contractual SM Jaleel (`business-sm-jaleel`):**
  - **Termómetro de Volumen (Cases):** Seguimiento visual para **Canadá (163.726 cases)** y **EE.UU. (137.704 cases)** sobre la meta global de **301.430 cases**, con matriz mensual por línea/distribuidor (`2026-11` a `2027-04`).
  - **Scorecard en Cuadrícula (14 Criterios):** Tarjetas ejecutivas ponderadas al 100% (`SMJ-SC01`..`14`) con barra de peso, estado (`Evaluado` / `Sin evaluar`) y evaluación directa.
  - **Obligaciones, Controles y Rutinas:** Filtro por tipo (`Obligaciones y Controles (26)`, `Rutinas Mensuales (132)`, `Todas`) y buscador instantáneo, con registro directo de evidencia.
  - **Honorarios y Reembolsos:** Resumen ejecutivo en 3 tarjetas (*Planificado*, *Aprobado*, *Cobrado / Recibido*).

### 3. Tu Agenda (`/agenda`)
- **Mi Agenda (`CalendarBoard`):** Calendario visual multidisplay con perspectiva de días, semanas y meses en zona horaria de Panamá (`America/Panama`), combinando tareas programadas con lecturas verificadas de Google Calendar.
- **Agenda de Lumen (`AgentAgenda`):** Registro de agentes y automatizaciones autónomas, reportando horarios programados, evidencias y resultados respaldados, sin simular ejecuciones falsas.

### 4. Búsqueda Global (`/buscar`)
- Búsqueda en tiempo real sobre títulos, descripciones, notas de contexto, siguientes acciones, evidencias de proyectos y empresas.

### 5. Conexiones WhatsApp (`/whatsapp`)
- Panel de monitoreo del estado de las cuentas y del gateway de mensajería, conservando políticas de privacidad y retención confirmada.

### 6. Acceso Público y Consulta (`PublicHbWorkspace`)
- Modo de acceso público de solo lectura para consulta rápida y segura de tareas aprobadas sin requerir credenciales maestras ni exponer datos privados.

---

## 🛠️ Tecnologías Utilizadas

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router, Server Components y Server Actions).
- **Librería de UI:** [React 19](https://react.dev/).
- **Estilos:** [Tailwind CSS 3](https://tailwindcss.com/) con tema visual aprobado de alto contraste.
- **Tipado:** [TypeScript 5](https://www.typescriptlang.org/) con verificación estricta (`noEmit`).
- **Base de Datos & Almacenamiento:** Arquitectura híbrida compatible con almacenamiento local atómico en disco (`data/db.json`) y PostgreSQL / Supabase, con tests locales aislados vía `@electric-sql/pglite`.
- **Testing:** [Playwright](https://playwright.dev/) para pruebas E2E e interfaces de usuario, junto a scripts de validación de lógica con `tsx`.

---

## 🚀 Comandos y Scripts Disponibles

En la raíz del proyecto se encuentran configurados los siguientes comandos:

```bash
# Iniciar servidor de desarrollo en puerto 3010
npm run dev

# Compilar para producción (Next.js build con restore de assets)
npm run build

# Iniciar servidor de producción
npm start

# Verificar tipado de TypeScript sin emitir archivos
npm run typecheck

# Servidor de preview local aislado en puerto 3011
npm run preview:local

# Pruebas de lógica de tareas personales y persistencia aislada
npm run test:personal

# Pruebas de regresión, CSRF, proyectos, rollback y concurrencia
npm run test:roadmap

# Suite completa de pruebas de interfaz de usuario con Playwright
npm run test:personal:ui

# Pruebas de base de datos
npm run test:db
npm run test:persons
```

---

## 🔒 Variables de Entorno y Configuración

El archivo `.env` local admite las siguientes variables operativas:

```env
# Puerto del servidor
PORT=3010

# Clave de API interna de Hermes
API_KEY=mock-api-key-12345
HERMES_API_KEY=mock-api-key-12345

# Token de bot para notificaciones de Telegram (opcional)
TELEGRAM_BOT_TOKEN=...
```

---

## 📁 Estructura del Código

```text
├── assets/                  # Activos visuales (fondos Hero Lake/Custom codificados)
├── data/                    # Almacenamiento de base de datos local (db.json, db_test.json)
├── scripts/                 # Scripts de prueba, importación de SMJ, migraciones y auditoría
├── src/
│   ├── app/                 # Rutas de Next.js (App Router)
│   │   ├── page.tsx         # Entrada principal (WorkspacePage)
│   │   ├── agenda/          # Vista de agenda y calendario
│   │   ├── empresas/        # Vista de empresas y SMJ Center
│   │   ├── buscar/          # Búsqueda global
│   │   ├── whatsapp/        # Panel de conexiones de WhatsApp
│   │   └── api/             # Endpoints REST (workspace, ai, auth, tasks, companies, etc.)
│   ├── components/          # Componentes de React (WorkspaceHub, TaskMaster, SmjCompanyCenter, etc.)
│   ├── lib/                 # Lógica de dominio (personalTasks, projects, executive, smjTracking, etc.)
│   └── services/            # Servicios de datos (dbService, workspaceService, mockData, etc.)
└── tests/
    └── personal/            # Suites de prueba E2E de Workspace y revisión de HB
```

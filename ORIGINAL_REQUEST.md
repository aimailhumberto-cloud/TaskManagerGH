# Original User Request

## Initial Request — 2026-06-01T03:36:26-05:00

Un centro de tareas inteligente empresarial (Hermes Task Hub) en Next.js con Tailwind CSS y TypeScript, que almacena los datos de forma persistente en el disco duro (JSON) y gestiona tareas, subtareas, proyectos y asignaciones conectadas a la jerarquía de Golden Hour, permitiendo la interacción bidireccional entre usuarios y un agente de IA Hermes.

Working directory: `C:\Users\Usuario\.gemini\antigravity\scratch\hermes-task-dashboard`
Integrity mode: `development`

---

## Requirements

### R1. Jerarquía y Relaciones de Golden Hour
- Soporte para Empresas (`Company`), Personas (`Person` con roles de Administrador, Miembro, Agente de IA y Externo) y Tareas asociadas.
- Clasificación de tareas en: One-shot (únicas), Repetitivas (patrones diarios, semanales, mensuales) y Proyectos compuestos por múltiples sub-pasos (`steps`).
- Origen de datos diferenciado (indicar si proviene de "Golden Hour" o si fue creada manualmente).

### R2. Vistas del Dashboard Premium
- **Dashboard Principal:** Resumen interactivo de KPIs (tareas totales, carga de trabajo, cuellos de botella por asignado y últimas alertas del agente).
- **Pestaña Master de Tareas:** Lista/tabla inteligente de tareas agrupables en un clic por Empresa, Responsable o Estado con filtros avanzados.
- **Vista de Categorías:** Carpetas temáticas interactivas para organizar el flujo de trabajo.
- **Vista de Calendario:** Calendario dinámico con vista **Semanal por defecto**, y eventos clickeables coloreados según prioridad.
- **Configuración ("Settings"):** Panel dedicado para ver y editar las plantillas de correo y configurar el servidor SMTP (host, puerto, credenciales).

### R3. Ficha Detallada de Tareas (Drawer lateral)
- Panel lateral premium que incluye: edición en Markdown de la descripción, selector de responsables con avatares, checklist de pasos e historial de actividad detallado de usuarios e IA.
- **Gestión de Adjuntos:** Capacidad de arrastrar y soltar archivos de referencia, los cuales se guardan en el servidor local.
- **Centro de Comunicaciones:** Botones interactivos para procesar plantillas de correo predefinidas y enviarlas vía SMTP de forma real (o simulada en UI si no está configurado), y mensajes listos para Slack o WhatsApp.
- **Notificación al Agente AI:** Botón "Ping Hermes" para enviar comandos y notificaciones estructuradas directamente a la cola del agente Hermes.

### R4. Persistencia en Disco Duro Local
- Implementación de un servicio unificado en TypeScript (`dbService.ts`) que lea y escriba todos los datos en formato JSON (`data/db.json`) y almacene los adjuntos físicamente en disco.
- El diseño debe permitir migrar en el futuro a Supabase de manera simple mediante el cambio del adaptador del servicio de base de datos.

---

## Acceptance Criteria

### Interfaz de Usuario e Interactividad
- [ ] El dashboard debe ser responsivo y mostrarse impecablemente en móvil y escritorio.
- [ ] La vista de Calendario Semanal debe permitir navegar entre semanas y abrir la ficha de la tarea al hacer clic.
- [ ] La sección de configuración debe permitir ver todas las plantillas activas de correo creadas.

### Persistencia y API
- [ ] Al reiniciar el servidor de Next.js, las tareas, adjuntos, y logs agregados deben persistir en el disco duro.
- [ ] El endpoint `/api/tasks` debe validar correctamente la cabecera `x-api-key`.
- [ ] El envío de correos debe realizarse a través del servidor SMTP si las credenciales en `.env` están configuradas; de lo contrario, debe simular el envío mostrando la plantilla procesada en la UI.
- [ ] La consola de "Agente Simulator" integrada debe poder simular de forma exitosa cambios en el estado y registrar notificaciones para Hermes en el archivo local.

## Follow-up — 2026-06-01T13:05:02-05:00

Implementación de la Fase 1, Fase 2 y Fase 3 de mejoras de interactividad, proyectos y multiempresa para el Hermes Task Hub en Next.js, TypeScript y Tailwind CSS.

Working directory: `C:\Users\Usuario\.gemini\antigravity\scratch\hermes-task-dashboard`
Integrity mode: `development`

---

## Requirements

### R1. Avatares Dinámicos de Iniciales en Color HSL
- Implementar un sistema de avatares dinámicos en React que, ante cualquier error de carga de foto física (404), genere y dibuje automáticamente un círculo con fondo coloreado HSL armónico (hasheado del nombre del usuario) y sus iniciales en mayúsculas.
- Reemplazar todas las etiquetas de fotos rotas de personas en el Dashboard principal, la lista de tareas y la ficha lateral.

### R2. Edición de Miembros y Roles Organizacionales Reales
- Actualizar la lista de selección de roles al registrar usuarios en `/companies` a roles reales de la organización: **CEO, Gerente, Administrativo, Contable, Operaciones, Agente de IA, Tercero / Externo**.
- Agregar soporte completo para asignar y dar seguimiento a tareas ligadas a perfiles "Tercero / Externo".
- Diseñar e implementar un modal o formulario de edición inline para miembros en `/companies`, permitiendo actualizar su Nombre, Rol o Avatar y guardarlo de forma persistente en disco a través de un nuevo endpoint `PUT /api/persons/[id]`.

### R3. Carpetas Organizacionales Dinámicas (Base de Datos)
- Conectar la pestaña `/categories` dinámicamente con la base de datos de tareas. Agrupar las tareas reales de la BD según el campo `category`.
- Habilitar la creación de nuevas carpetas y mostrar los contadores numéricos dinámicos de cada carpeta en la interfaz.
- Añadir un selector de "Carpeta Organizacional" dentro del cajón lateral de edición de tareas para mover tareas entre carpetas en tiempo real.

### R4. Quick Table Actions (Done Check y Estado en un Clic)
- En la vista de tabla `/tasks`, convertir el estado estático en un menú desplegable interactivo (`<select>`) elegante con colores HSL. Al cambiar la selección, debe realizar un `PUT` en segundo plano para guardar en el servidor.
- Agregar un círculo de verificación interactivo `○` / `✓` a la izquierda del título de la tarea en la tabla. Al pulsarlo, cambia el estado instantáneamente entre Completed (completado) y Pending (pendiente), actualizando la base de datos.

### R5. Arrastre y Soltado Real en el Calendario (HTML5 Drag & Drop)
- Implementar Drag & Drop nativo de HTML5 en la vista de calendario (`/calendar`). Las tarjetas de tareas deben ser arrastrables y las celdas de fechas del calendario deben ser zonas de soltado.
- Al arrastrar y soltar un evento, actualizar dinámicamente el campo `dueDate` de la tarea en la BD (`PUT /api/tasks/[id]`), refrescar el calendario e indicar el éxito con un mensaje flotante (Toast).

### R6. Consola de Proyectos Dedicada (`/projects`)
- Registrar la ruta `/projects` y agregar un botón de enlace dorado en la barra lateral de navegación principal (`RootLayout`).
- Mostrar en esta vista tarjetas de proyecto filtrando únicamente las tareas con `type === 'Project'`.
- Mostrar en cada tarjeta una barra de progreso HSL dorada (`completed / total` sub-steps checklist) and un checklist interactivo para añadir, marcar y borrar subtareas directamente.

### R7. Aislamiento Multiempresa y Visibilidad por Perfil
- Implementar el filtrado restrictivo de visualización de datos:
  - **Daniel (CEO / Admin)**: Visión global completa de todas las empresas mediante pestañas de selección rápida.
  - **Gerente / Administrativo**: Ven únicamente las tareas, miembros y estadísticas que pertenecen a su respectiva empresa.
  - **Tercero / Externo**: Aislamiento estricto. Ven únicamente su lista de tareas asignadas sin acceso al dashboard general ni a otros usuarios.

---

## Acceptance Criteria

### Interactividad e Ingesta
- [ ] La vista de tabla de tareas permite cambiar estados y marcar completados de forma inmediata mediante dropdowns y círculos clickables.
- [ ] El arrastre físico en el calendario reprograma la fecha de la tarea en la base de datos de manera persistente.
- [ ] Los avatares con iniciales dinámicas se dibujan en círculos HSL armónicos y no muestran imágenes rotas en el navegador.

### Gestión de Proyectos y Multiempresa
- [ ] La nueva pestaña `/projects` muestra las tarjetas de proyectos con su barra de progreso dorada en tiempo real.
- [ ] Los miembros de tipo "Tercero / Externo" están totalmente aislados de la información global de otras empresas.
- [ ] Las modificaciones de nombres, roles o avatares de los miembros se guardan y editan persistentemente en `data/db.json`.
- [ ] Los 130 tests automáticos de Playwright se ejecutan exitosamente y están 100% en verde.

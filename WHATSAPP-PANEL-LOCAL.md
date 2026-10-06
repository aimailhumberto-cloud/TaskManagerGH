# Panel WhatsApp local — 2026-10-06

URL: http://127.0.0.1:3011/whatsapp. Pestaña independiente después de Inicio/Empresas/Agenda/Buscar. No envío, lectura de mensajes, ACK, pairing, renovación ni cambios del gateway.

Contrato autenticado GET /api/integrations/whatsapp/status; solo administrador activo, no-store. Adaptador servidor usa TASKMANAGER_WHATSAPP_DIRECTORY, exclusivamente cuando TASKMANAGER_LOCAL_ONLY=1. Launcher real apunta a la instalación existente; launcher de pruebas elimina esa variable. Nunca acepta URL desde navegador. GET /health fijo a loopback3012/3013, timeout3s, sin redirects. Reutiliza token del perfil aprobado solamente en memoria del servidor; frontend recibe whitelist sin secretos, teléfonos, mensajes ni rutas. Fallos devuelven estado no disponible; identidad no coincidente se muestra por comprobar. No modifica configuración ni archivos del gateway.

Cuentas: connected solo con status=connected, profile exacto y expectedAccountMatches=true. Fecha consultada no equivale a última actividad. Health actual no informa última actividad; null explícito. Permisos: sin expiración/renovación verificables en el contrato, null explícito. Túnel: lectura del archivo de diagnóstico existente y su fecha de modificación, presentada HISTÓRICA; no equivale a probe actual. No se invocan comandos de doctor, renovación o conexión.

Evidencia real 2026-10-06T04:31Z: personal y bee-smart conectadas tanto por herramientas MCP como por health autenticado desde TaskManager. Registro túnel saludable del 2026-10-05T21:26:05.605Z; estado actual sin dato. No crear snapshots falsos.

Pruebas: contrato aislado con tokens sintéticos verifica identidad, timeout/error, whitelist y desconocidos. QA navegador a1440/390/320, error503/reintento, rutas existentes y401 anónimo. Preview.json idéntico byte a byte, cero pageerrors. Capturas/reportes privados .local-data/whatsapp-qa; tipos/lint/build final aprobados.

Supabase: no herramientas Supabase callable en el catálogo de este hilo. Personal Context devolvió "Personal context is unavailable for this conversation". Documentación local de migración no identifica proyecto real ni acceso nuevo; no se abrieron secretos o rutas denegadas. Proyecto confirmado del app: aimailhumberto-cloud/TaskManagerGH, Render srv-d8f9fe3eo5us73bl0djg. No confundir con un proyecto Supabase identificado. Siguiente paso: obtener referencia del hilo/conector efectivamente accesible y realizar lectura mínima del proyecto, sin crear permisos ni SQL. Publicación sigue bloqueada por backup/restore y persistencia real pendientes.

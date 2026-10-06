# WhatsApp y preparación de producción — 2026-10-06

Preview: http://127.0.0.1:3011/whatsapp. Cambios locales; ningún gateway, servicio, secreto, permiso, SQL remoto o dato real modificado. Sin publicación.

## Panel y contrato vigente
GET /api/integrations/whatsapp/status: sesión de administrador activo, no-store. Servidor consulta exclusivamente GET /health fijo en loopback3012/3013, autenticado con el token existente del perfil aprobado, en memoria. Root TASKMANAGER_WHATSAPP_DIRECTORY solo en modo local; prueba aislada elimina esa variable. No acepta URL del navegador ni entrega tokens, teléfonos, mensajes, rutas o errores upstream.

Conexión verificada exige profile exacto, status connected y expectedAccountMatches true. integrationStatus exige schemaVersion1, availabletrue y checkedAt válido/vigente. Whitelist:
- activity: available, lastIncomingAt (recepción privada), lastOutgoingAcceptedAt (aceptación local, NO entrega), lastObservedAt (incluye chat propio). Null no demuestra ausencia histórica.
- permissions.attachments/voice: enabled, mode, expiresAt, renewedAt; Events además autoRenewEnabled, activeSubscriptions, subscriptionExpiresAt, scope. Permiso y suscripción tienen vencimientos independientes; renovación automática configurada no confirma renovar suscripción.
- permissions.send: mode de aprobación exacta por orden y automaticReplies; no autorización de envío derivada de este panel.
- tunnel: state, checkedAt, lastSuccessfulPollAt, pollEvidenceAt, pollEvidenceFresh, evidenceFresh, source y remotePollVerified. polling_verified requiere evidencia y último polling exitoso recientes; local_healthy no confirma conexión remota.

Caducidad120s con margen futuro5s; versiones/fechas inválidas fallan cerrado. Cliente recalcula cada15s sin ejecutar nuevos sondeos ni renovar permisos. Datos históricos permanecen fechados, nunca sustituyen comprobación actual. Prueba ASR no informada por este contrato; no se anuncia como aprobada. Cuentas protagonistas navy/stone, actividad real y voz; ajustes/detalles en panel secundario desplegable sin controles de escritura.

Evidencia real 04:48UTC: ambas cuentas connected; metadatos de actividad y permisos disponibles. Salud local fresca, polling remoto anterior caducado, remotePollVerifiedfalse. QA1440/390/320, fallo/reintento,401 sin sesión, no-store y JSON real idéntico byte a byte. Capturas/reportes privados .local-data/whatsapp-qa. Library bloqueada por ruta oficial no disponible; no IDs nuevos. Regresión nueve UI flows aprobados, contrato/frescura/versiones/identidad/errores y preparación de adjuntos/políticas aislados aprobados. OAuth sintético con PKCE/cancelación y propietario equivocado, vault temporal/deletion y conservación de tareas aprobado; ningún grant real consultado por esas pruebas.

## Preparación segura del código
TASKMANAGER_ATTACHMENTS_DIRECTORY exige ruta absoluta; producción sin modo local exige configurarla explícitamente. Propuesta futura /data/attachments en disco existente, NO aplicada. Todos los lectores/escritores y adjuntos de correo usan mismo resolver; referencias antiguas permanecen data/attachments/filename. Nombres traversal rechazados, subidas no sobrescriben, descargas private/no-store y errores sin rutas. Test usa directorio sintético separado. Persistencia/restore reales aún sin verificar; disco Render y backup requieren evidencia real.

Legacy writes tasks/companies/persons bloqueados permanentemente: usar workspace con revisiones/historial. Acciones externas bloqueadas por defecto también en producción. TASKMANAGER_EXTERNAL_ACTIONS_ENABLED es solo condición técnica necesaria; no autorización del usuario, y otras guardias siguen vigentes. No se configuró. Preview siempre bloquea acciones externas.

Google sigue siendo acceso Windows local; no secretos trasladados. Grant.ownerId se coteja con personId de sesión, sin reasignar grants. CLI exige --owner cuando hay varios administradores o usa el único activo existente. No crea usuarios. Lecturas nuevas guardan ownerId. Snapshots antiguos sin owner se conservan y solo se muestran en preview con un único administrador activo; producción requiere reconciliación explícita de propiedad. No se inventa propietario ni acceso remoto Google.

## Enlace remoto pendiente: autorización exacta necesaria
Autorizar que TaskManager del Render EXISTENTE lea únicamente metadatos de estado personal/BEE SMART por el canal saliente autenticado EXISTENTE, con identidad de servicio y credencial dedicada mínima. Acordar destino, retención/caducidad120s y revocación. Sin exponer puertos Windows, reutilizar/publicar tokens WhatsApp, mensajes/audio, envío o renovación/cambio de grants. Primero verificar si el canal ya concede ese consumidor: conector ChatGPT no demuestra acceso de Render. No nueva infraestructura ni SQL remoto. Este enlace no está implementado ni autorizado por permiso del panel local.

## Release aún pendiente
Identificar Supabase real y acceso desde este contexto; backup nativo DB/adjuntos y restore aislado; migración/mapeo/propietarios revisados; importar explícitamente y congelar escritores viejos para cutover; verificar disco y reinicio, sesión HTTPS y Node>=20. Acceso de plugin no equivale a configuración de la aplicación. En producción WhatsApp queda sin dato hasta enlace remoto autorizado; calendario conserva información solo con propiedad reconciliada. No deploy automático de main antes de completar estas verificaciones.

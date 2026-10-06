# Analítica WhatsApp — implementación local

Implementada dentro del mismo TaskManager, conservando la navegación y el diseño aprobados. Referencia: texto y SVG facilitados por el padre; no se accedió al PDF de Library después del fallo de materialización en Windows.

## Resultado visible

En WhatsApp: filtros Personal/BEE SMART, Hoy/7 días y búsqueda; cuatro indicadores; asuntos que requieren revisión, contactos activos, actividad reciente y archivos/audios por revisar. Cobertura parcial y envíos móviles incompletos se muestran explícitamente. Sin acceso al contenido los indicadores son desconocidos, no ceros inventados. El diagnóstico de conexión previo permanece disponible.

Una revisión permite confirmar vínculos con empresas, proyectos o tareas existentes. Crear una tarea exige revisar campos y aceptar expresamente su conservación más allá de la caducidad del mensaje. Cancelar no escribe; reintentar tras perder una respuesta no duplica tareas. No se envían mensajes, descargan archivos, transcriben audios ni crean eventos externos.

## Reglas y límites

- Identidades separadas por cuenta y contacto; nunca se fusionan por nombre.
- Saludos y agradecimientos no generan compromisos. Un mensaje entrante sin respuesta observada no demuestra obligación ni urgencia.
- Fechas ambiguas requieren confirmación. Fuente UTC y presentación America/Panama.
- Eventos caducados o permisos vencidos desaparecen de la vista y del panel de detalle. La tarea guardada deliberadamente conserva sus datos revisados.
- Acceso reservado al propietario verificado. En local se admite el único administrador activo; producción requiere un mapeo explícito al administrador existente.
- El transporte de contenido real está deshabilitado. Aprobar esta UI no concede lectura, análisis o retención de conversaciones reales.
- Las revisiones guardan identificadores y decisiones, no el texto del mensaje. Su ocultación/depuración del estado actual NO elimina físicamente snapshots o historial anteriores: falta aprobar e implementar la política de purga antes de activar contenido real.

## Verificación reproducible

Pruebas con contactos y mensajes ficticios, base `.local-data/ui-test.json`, sin credenciales de servicios:

```
node node_modules/tsx/dist/cli.mjs scripts/testWhatsAppAnalytics.ts
node scripts/test-whatsapp-analytics-ui.mjs
npm run typecheck
npm run lint
npm run test:roadmap
npm run build
node scripts/testProductionUpgrade.mjs
```

El ensayo UI cubre cancelación, consentimiento, error/reintento, idempotencia, vínculos, recarga, filtros, búsqueda, caducidad, acceso denegado y tamaños 1440/390/320. Comprueba que la base real local permanece idéntica. Evidencias privadas en `.local-data/whatsapp-analytics-qa/`.

Preview habitual: `node scripts/local-preview.mjs --start`, http://127.0.0.1:3011. Ensayo ficticio independiente: `node scripts/local-preview.mjs --test --analytics-demo`, puerto 47915; no ejecutar otro servidor dev simultáneamente sobre el mismo `.next`.

## Publicación pendiente

El usuario autorizó publicar en el Render existente. Aún falta recuperar y respaldar el Supabase ORIGINAL `sitaivletjymybozpsdn`, comprobar restauración aislada, adjuntos y correspondencia de propietarios/usuarios antes de cualquier migración o despliegue. El respaldo de la preview local no reemplaza un respaldo de producción. No se cambia a Ingredienta, no se crea otro servicio ni se despliegan cuentas de ensayo.

Conectar conversaciones reales requiere además autorización concreta del entorno, acceso y retención, incluyendo historial y backups. No se configuraron secretos ni permisos remotos durante esta implementación.

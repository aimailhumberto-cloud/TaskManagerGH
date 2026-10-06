# Preparación de respaldo del proyecto original

Estado verificado el 6 de octubre de 2026: este entorno no tiene pg_dump, pg_restore, psql, Supabase CLI ni Docker en PATH; tampoco PostgreSQL 15–18 en las rutas habituales. No hay DATABASE_URL, DIRECT_URL, SUPABASE_DB_URL, variables PG*, claves Supabase, archivos .env de la copia ni configuración pgpass disponible. No se generaron credenciales ni se inició una conexión. El padre informó INACTIVE → COMING_UP; falta confirmación ACTIVE_HEALTHY.

Destino único: proyecto original sitaivletjymybozpsdn. Nunca usar Ingredienta ni inicializar una base vacía. La preview y sus usuarios de ensayo no son una fuente para reemplazar producción.

## Orden de ejecución pendiente

1. Confirmar ACTIVE_HEALTHY y documentar un corte coherente sin escritores de la aplicación antigua. No llamar sus endpoints públicos de datos: pueden tener inicialización automática.
2. Obtener mediante acceso existente el inventario de schemas/tablas/columnas, extensiones, funciones, triggers, políticas RLS, permisos y propietarios; contar filas y localizar referencias a archivos sin imprimir contenido o secretos.
3. Usar PostgreSQL 17 compatible con el servidor 17.6 y una conexión legítima ya existente. Configurar sesión read-only y SSL con verificación del servidor. Secretos fuera de argumentos, URLs impresas, logs y repositorio. No sustituir una service-role HTTP por una contraseña PostgreSQL: son credenciales distintas.
4. Crear un destino privado nuevo y un dump custom completo de los schemas accesibles, sin excluir tablas silenciosamente. pg_dump toma un snapshot consistente de la base. Registrar versión de herramientas/servidor, instante, alcance, exclusiones y errores sanitizados. Calcular SHA-256 del archivo; inspeccionar el catálogo con pg_restore --list. Un catálogo válido por sí solo no demuestra restaurabilidad.
5. Restaurar en una base PostgreSQL 17 aislada sin credenciales, enlaces o jobs de producción. Revisar primero funciones/extensiones y tareas programadas; no ejecutar automatizaciones reales. Preparar extensiones y roles locales equivalentes necesarios; cualquier remapeo de propiedad/permisos se documenta, nunca se escribe en el origen. Comprobar schema, filas por tabla, referencias, secuencias, restricciones, funciones y RLS. Conservar errores y diferencias; no llamar completa a una restauración parcial.
6. Respaldar archivos por separado: objetos de Supabase Storage y archivos del disco Render, si existen. El dump contiene metadatos, no los bytes de Storage. Inventariar rutas/tamaños y hashes privados, comprobar copia y restauración en destino aislado. En el código original d4b6156 los uploads escribían en process.cwd()/data/attachments, mientras el disco conocido monta /data: no asumir que son la misma ruta. Inspeccionar ambas rutas reales del servicio y resolver cada referencia existente. La copia local tiene un archivo de 15 bytes; no demuestra existencia o integridad de adjuntos de producción.
7. Solo después preparar la importación aditiva y el mapeo de usuarios/propietarios originales; mantener el respaldo original inmutable. Ensayar migración, rollback y acceso antes de desplegar en el Render existente.

## Alternativa mediante el worker ya conectado

Si no existe conexión PostgreSQL legítima utilizable, el worker puede exportar schema y filas mediante la integración autorizada. Para datos: archivo privado con paginación completa y orden estable, counts antes/después, snapshot/corte documentado, hashes y referencias. Exportar todas las tablas pertinentes y metadatos del schema, sin secretos en chat. Marcar explícitamente que es una exportación lógica de alcance limitado, no un pg_dump completo, hasta verificar funciones, permisos, roles, extensiones, auth, Storage y restauración.

El importador existente `scripts/prepare-supabase-import.ts` exige archivo y hash verificados, crea un destino nuevo y declara readyForProduction:false. Sus pruebas aisladas no sustituyen una restauración del proyecto real.

## Bloqueo y ruta de resolución

Este hilo no puede producir todavía un dump completo: faltan herramienta y conexión legítima disponibles. El padre/worker debe comprobar acceso a backups del proyecto reactivado o posibilidades del soporte/dashboard conectado antes de pedir credenciales a Humberto. No se requiere repetir la aprobación de la implementación o de la publicación existentes. Si cualquier alternativa exige pago, nuevas credenciales o permisos, se informa el requisito concreto antes de actuar.

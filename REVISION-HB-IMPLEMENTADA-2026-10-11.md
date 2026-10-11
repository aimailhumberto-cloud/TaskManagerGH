# Revisión aprobada de TaskManager HB — implementación local

Estado: mejoras locales implementadas. Publicación pendiente de desbloquear la revisión automática de permisos. No se cambiaron datos de producción, cuentas, credenciales ni configuración de servicios.

## Qué cambió

- Inicio conserva tareas y pasos pendientes de fechas de trabajo anteriores, separados de Hoy, con empresa y fecha original.
- Acciones Hecho / Reabrir y Reprogramar en las tarjetas y el detalle. Los pasos actualizan el proyecto original: no crean tareas duplicadas. Reprogramar conserva el vencimiento.
- El servidor conserva sus controles de dependencias, esperas y pasos incompletos; la acción directa muestra el error en vez de saltarse esas reglas.
- El detalle permite guardar cambios cotidianos sin escribir un motivo manual; registra un motivo automático. Cancelaciones y restauraciones mantienen explicación explícita.
- Cerrar un detalle abierto desde un enlace elimina ese enlace de la URL para que no vuelva a tapar la pantalla al recargar.
- Reuniones de Inicio y Agenda respetan empresa. Eventos externos sin empresa vinculada se ven en Todas las empresas; no se les inventa clasificación.
- La lista de reuniones permite scroll interno, sin límite arbitrario de cuatro, y mantiene fuera de esa lista el acceso al calendario.
- Inicio separa Decisiones para tomar de Registros por verificar. Las decisiones resueltas tienen vista propia e historial.
- Lumen y automatizaciones: resumen breve, evidencia desplegable y agenda separada con horarios informados, resultados respaldados y pendientes de verificar. No se activa ni ejecuta ningún servicio desde esa vista.
- Se conserva el visual aprobado y se agregan estados/acciones de seguimiento y respuesta visual en las tarjetas de empresa.

## Cómo revisar

Preview local: http://127.0.0.1:3011
Cuenta sintética existente: humberto@local.test / preview-local-only
Agenda de agentes: http://127.0.0.1:3011/agenda?agenda=agents

1. En Inicio, revisar Pendientes anteriores y cambiar de empresa.
2. Abrir detalle, editar siguiente acción y guardar sin motivo manual; recargar.
3. Usar Hecho y Reabrir; comprobar que proyectos con pasos pendientes no se cierren por error.
4. Reprogramar fecha de trabajo y comprobar que el vencimiento se conserve.
5. Recorrer próximas reuniones con la rueda; abrir calendario diario/semanal.
6. Revisar decisiones y los registros por verificar como grupos distintos.
7. Abrir Agenda de Lumen: desconocido significa sin lectura/evidencia, no una ejecución inventada.

## Publicación

GitHub main y Render permanecen en d4b615664643dc17f8e09758f223295bf13c3ee1. No se importó el candidato de 87 tareas.

El archivo de imagen aprobado no pudo transferirse mediante el blob binario grande. Ahora se empaqueta en 41 partes de texto versionadas y prebuild reconstruye sus 1.825.761 bytes comprobando SHA256 b47bcf439cae46251e37de0fb0a87f7c711d582a51767abd1e3c357c196d2e8d. No cambia el visual ni depende de otra URL o servicio.

Se aceptaron 12 partes como objetos Git sin actualizar rama. La siguiente escritura fue rechazada por la revisión automática porque no reconoció la nueva autorización de publicación. No se intentó evadir el rechazo. El checkpoint remoto queda registrado en .local-data/github-publication-state.json.

Después del desbloqueo: transferir resto y código final probado, verificar árbol completo, comprobar main actual antes de actualizarlo sin force, esperar autodeploy y verificar commit live. Solo después reauditar/importar datos de trabajo, sin copiar cuentas ni SMTP al snapshot. La conexión real y persistencia de producción requieren verificar el acceso con la cuenta existente; todavía no se declaran operativos.

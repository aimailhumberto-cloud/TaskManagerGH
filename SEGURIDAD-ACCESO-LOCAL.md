# Checkpoint de aislamiento — 6 de octubre de 2026

Implementación local, sin publicación ni cambios de servicios, credenciales o datos originales de producción.

## Comportamiento comprobado

- SSR y API comparten la misma selección explícita de campos públicos. No entregan usuarios completos, hashes/salts, SMTP, claves de IA, bundles de importación ni columnas desconocidas. La antigua pantalla de credenciales redirige a Inicio; configuración API solo informa disponibilidad y rechaza cambios.
- Owner/Admin conservan lectura administrativa y edición de registros con propietario verificado. Los demás roles continúan en consulta: tareas propias o asignadas explícitamente, proyectos propios o vinculados mediante una tarea accesible del mismo negocio y propietario existente. Empresa coincidente, nombre o token que diga Owner no conceden permisos.
- Tareas/proyectos sin propietario válido requieren validación antes de modificarse. No se asigna automáticamente propietario a tareas antiguas. Adjuntos exigen referencia desde una tarea accesible; archivos sin referencia no se descargan.
- Una cuenta inactiva, eliminada o vinculada a otra persona pierde acceso. Se verifica el rol vigente en base, además de la firma de sesión.

## Evidencia

- `scripts/testPrivacyIsolation.mjs`: build compilado, LOCAL_ONLY=0, cinco cuentas sintéticas con roles Owner, Gerente, Administrativo, Gerente y Coordinadora Operativa. Comprueba API, SSR, detalle por ID, descargas, denegación de cambios, rol falsificado, sesiones revocadas/revinculadas, vínculos válidos/ambiguos de proyecto y escritorio/móvil. Owner administra registros válidos sin cambiar su propietario. Lecturas y operaciones denegadas conservan bytes de la base aislada.
- Informe y capturas privados: `.local-data/privacy-qa/report.json`, `profile-{0,1}-{1440,390}.png`.
- Nueve pruebas Playwright de UI pasaron: edición, filtros, respuesta perdida/reintento, pasos/dependencias, historial/restore, cancelación, agenda Panamá, referencias compartidas y móvil.
- WhatsApp sintético: revisión/enlaces, retención expresamente confirmada, deduplicación, expiración, recarga, error/reintento y 1440/390/320 px pasaron. No se accedió a contenido real.
- Pruebas Roadmap, capas, planificación, Supabase aislado, preparación y compatibilidad de esquema pasaron. Lint/tipos/build final pasan con advertencias previas de hooks/imágenes. Smoke compilado verifica cookies Secure/HttpOnly/SameSite, guardas permanentes y servicios externos deshabilitados.
- SHA-256 de preview real conservado: `16796109b1419708bb05c1364c30d8fbc0a103c41684f2a88cb0d1799e1c4266`. Se conservan 14 tareas (13 registros locales autorizados y una DEMO). Las pruebas usan otras bases.

## Revisar localmente

Preview: http://127.0.0.1:3011. Se mantiene el acceso local de demostración ya entregado. Para reiniciar desde este checkout: `node scripts/local-preview.mjs --start` después de `npm run build`. No usar `--test` para la base de preview.

## Gates antes de producción

Esta evidencia usa cinco perfiles sintéticos con los roles originales, no sesiones ni credenciales de los cinco usuarios reales. No demuestra HTTPS/proxy del servicio hospedado. El respaldo/importación de 87 tareas verificado en cloud es una comprobación separada realizada por el padre; aquí no se alteró producción.

Siguen pendientes la inspección y respaldo de los adjuntos existentes de Render, confirmar su ubicación/persistencia frente al disco `/data`, verificar configuración de runtime en cloud y completar el corte controlado. No desplegar mientras esos gates estén pendientes. No se añadieron integraciones ni se modificaron secretos.

# Revisión de dependencias — 2026-10-05

Cambios exclusivamente locales. No publicación, secretos, servicios ni datos reales modificados.

| Dependencia | Antes | Después | Riesgo principal |
|---|---|---|---|
| Next | 14.2.35 | 15.5.27 | CVE-2026-75604 (GHSA-p293-qw3h-jr36), crítico en Windows; GHSA-2xp9-vwfh-vxw4, crítico AVIF sin CVE publicado en el aviso. Loopback limita exposición, no elimina vulnerabilidad. No next/image en UI, pero existe endpoint del framework. |
| Nodemailer | 6.10.1 | 10.0.15 | GHSA-v53p-9fqp-m79j y GHSA-rcmh-qjqh-p98v, DoS de parser. Destinatarios llegan a rutas antiguas autenticadas; preview impide envíos externos. No prueba SMTP real. |
| PostCSS | 8.4.31 anidado / 8.5.15 raíz | 8.5.29 | CVE-2026-73646 / GHSA-r28c-9q8g-f849, traversal source-map. Se procesa CSS del repositorio, sin ruta runtime de CSS externo encontrada. |
| Nanoid | 3.3.12 | 3.3.20 | CVE-2026-67213 y CVE-2026-67214, bucles con tamaños inválidos. Sin tamaño controlado por HTTP encontrado. |

Se migró manualmente conforme a las guías oficiales Next 15/React 19: React/DOM 19.1.9, tipos, cookies y params asíncronos. NextRequest.ip eliminado mantiene bucket local genérico sin confiar en forwarded headers. Nodemailer trae tipos propios. Node >=20 obligatorio; máquina comprobada Node24.13.1. Confirmar runtime Render antes de publicar. No audit fix forzado.

Verificaciones: tipos, lint (warnings heredados), build final y nueve recorridos UI aprobados; roadmap, workspace ejecutivo/capas y Supabase/PGlite aislados aprobados. Regresiones inertes PostCSS traversal, Nanoid y Nodemailer parser, correo/ICS en memoria sin SMTP y restricción de archivos aprobadas. Smoke de build producción aislado aprobado: sesión firmada, cookie Secure/HttpOnly/SameSite, params asíncronos, cuatro entradas, PNG real, Origin logout y datos reales idénticos por comparación byte a byte. Cookie sintética enviada manualmente sobre loopback HTTP; no demuestra HTTPS/proxy de producción.

El optimizador Next omite cookies en su fetch interno del PNG protegido y responde400. La interfaz usa directamente PNG/CSS autenticado y funciona; no se debilitó middleware ni se afirma soporte next/image para esta fuente.

Audit runtime (--omit=dev): CERO vulnerabilidades. Audit completo: SIETE HIGH y CERO CRITICAL, cadena Braces3.0.3, CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm, sin versión3 corregida en registro/aviso consultados. Afecta patrones glob de build/lint/desarrollo; sin ruta HTTP encontrada. Sigue pendiente. No aplicar Tailwind4 ni downgrade eslint-config sugeridos sin migración y revisión separadas.

Pendientes antes de publicar: acceso/login real Supabase, backup verificable y restore aislado de datos reales, persistencia adjuntos, Node de Render y HTTPS real. Tablas antiguas quedarían desactualizadas tras cutover: rollback exige reconciliar cambios posteriores. Ningún SQL remoto ejecutado.

Fuentes oficiales:
- https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36
- https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4
- https://nextjs.org/docs/app/guides/upgrading/version-15
- https://react.dev/blog/2024/04/25/react-19-upgrade-guide
- https://github.com/nodemailer/nodemailer/security/advisories/GHSA-v53p-9fqp-m79j
- https://github.com/nodemailer/nodemailer/security/advisories/GHSA-rcmh-qjqh-p98v
- https://github.com/nodemailer/nodemailer/releases
- https://github.com/postcss/postcss/security/advisories/GHSA-r28c-9q8g-f849
- https://github.com/advisories/GHSA-2v37-7h3g-55p8
- https://github.com/advisories/GHSA-28wg-ghj8-5hjv
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

Evidencia privada en .local-data: production-dependency-audit.json (antes), security-upgrade-production-audit.json, security-upgrade-full-audit.json, security-upgrade-lint.log, security-upgrade-build.log y production-upgrade-smoke.json. No incluida en Git.

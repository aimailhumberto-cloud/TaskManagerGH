# CLAUDE.md — TaskManagerGH / Segundo Cerebro SMJ

Contexto para sesiones de Claude Code. Estado tomado el 2026-11-15 de los hilos del proyecto "Segundo Cerebro SMJ" en claude.ai y del historial de `origin/main`.

## Qué es

- App Next.js (TaskManager HB) con el **Segundo Cerebro** de S.M. Jaleel & Co. Ltd. (SMJ): vault Obsidian (`vault/`) + mapa vivo en `/cerebro` + motor interno que escribe en el vault.
- Repo: `aimailhumberto-cloud/TaskManagerGH`, rama `main`. Producción: Render, `https://taskmanagergh.onrender.com`. **La verdad del vault es producción**, no la copia local.
- Dueño: HB (Humberto Bouche). Agentes externos (DOTS / ChatGPT) **no escriben fichas**: piden y consultan por `POST /api/agent/cerebro`; el Cerebro escribe.
- La carpeta `C:\Users\Usuario\Downloads\SMJaleel` es la documentación y el vault de arranque (9–14 nov). Referencia, no fuente viva.

## Comandos

- `npm install` (node_modules no está instalado en esta copia), `npm run dev` (puerto 3010), `npm run build`, `npm run typecheck`, `npm run lint`.
- Pruebas por área: `test:motor`, `test:casenote`, `test:intake`, `test:vault`, `test:i18n`, `test:apply`, `test:autonomy`, etc. (ver `package.json`). Algunos e2e usan `python3`.

## Mapa del código

- `src/lib/cerebro/*`: motor (engine, intake, blackbox, casenote, cases, review = Jev, settings, guide, ollama, ops, bank, chat, expediente).
- `src/app/api/agent/cerebro`: puerta única de agentes.
- `src/app/cerebro/*`: mapa / grafo (UI).
- `src/app/pedir`: pantalla Pedir (casos, caja negra visible).

## Estado (2026-11-15)

**Motor (hilo "Motor de inteligencia y arquitectura IA")** — roadmap de 6 fases:
- Hechas y subidas hoy: 1 Ver y aceptar (caja negra, entrada tolerante, repetidos), 2 Memoria propia (nota del caso en `00-Working-Memory`, sin MD obligatorio), 3 Guardar primero, 4 Continuidad. Guía del agente actualizada (`2cba707`).
- Sigue: **5 Noche** (regla 24 h, sesión del día en `05-Consolidation-Sessions`, repaso de Jev, resumen de la mañana) y 6 Blindaje (banco de pedidos sucios, conector de dos verbos para ChatGPT, puertas viejas que traducen).
- Propuestas sin decidir: estructura (tipos, carpetas, relaciones) en un archivo editable `00-System/estructura.md` en vez de código; auditoría nocturna de estructura en fase 5.
- Por decidir: ¿notas de caso visibles en el mapa o capa apagada? (sugerido: capa apagada); qué hacer con notas viejas de DOTS.

**Mapa y app (hilo "Proyecto aimailhumberto en GitHub")**:
- Vuelta 47 en producción (`8476d46`): entra al vecindario del centro; en PC bandeja de memoria temporal abajo y botón "Ver más".
- Pendiente decisión HB: encender autoaplicar "contactos" y "cifras" en ajustes; tablero con refresco automático + aviso de pendientes + cambios del día; etapa 6 de lentitud.
- Sin empezar / detenido: textos ES/EN restantes y mensajes del servidor, indicadores (KPIs), chat en Pedir (detenido), ambigüedad de nombres de pila (Richard, Luis/Luisa), Jev guarda motivo de fallo.

**Presentación** "Second Brain SMJ" (13 slides): lista; falta una captura del chat para la slide 5.

**Fase 5 del motor (ver `PLAN-FASE-5-MOTOR.md`)**: esta sesión de Code la ejecuta. 5.0 (marcador) y 5.1 (estructura única en `00-System/estructura.yaml`, leída por `src/lib/cerebro/structure.ts`) construidas. Sigue 5.6 contrato del agente. 5.0b (Jev bien usado: `src/lib/cerebro/jev.ts`, `jevcal.ts`) construida. Jev solo suma duda y nunca decide lo delicado. Para ver si Jev acierta: `SMJ_VAULT_PATH=<bóveda> npx tsx scripts/jev-calibracion.ts`. 5.2 (origen del dato: `src/lib/cerebro/origin.ts`; `clase` y `fuente` en las operaciones que escriben; `field_sources` / `relation_sources` en la ficha; verificación por campo con `campos_verificados`) construida. 5.3 (vecindario: `src/lib/cerebro/neighborhood.ts`; reglas `derives` e `inverse` en la estructura; una persona hereda mercado y marcas de su empresa al leer, no se conecta a mano) construida; no toca el mapa (`src/app/cerebro/*`). 5.4 (decisión: `src/lib/cerebro/decision.ts`, tabla pura `decide()` con una categoría por espera; `politica` en Ajustes solo afloja duplicado, pisa_texto, campo, cobertura y jev_duda; `textFields` en la estructura; el ensayo dice la decisión real) construida. Contar esperas: `SMJ_VAULT_PATH=<bóveda> npx tsx scripts/esperas.ts`. 5.5 (noche: `src/lib/cerebro/night.ts`, un solo proceso nocturno después de las 2 a.m. de Panamá: avanza los casos de más de 24 h, escribe la sesión del día en `05-Consolidation-Sessions`, audita la estructura y deja el resumen de la mañana en `dots-sleep/night/`; se lee con `{action:'manana'}`; solo avisa; `CEREBRO_NIGHT_DISABLED=1` la apaga) construida. Pruebas: `test:jev`, `test:jev-uso`, `test:bank-casos`, `test:estructura`, `test:origen`, `test:vecindario`, `test:decision`, `test:noche`. Las pruebas que crean fichas deben correr con `process.chdir` a su carpeta temporal: `upsertNode` copia lo nuevo a `<cwd>/vault`. En Windows los scripts con `SMJ_VAULT_PATH=vault` fallan en `npm run`: correr `SMJ_VAULT_PATH=vault npx tsx scripts/<archivo>.ts` desde Git Bash.

## Reglas de trabajo

- Varios hilos suben al mismo `main`. **`git pull` antes de empezar y antes de cada push.** No pisar áreas que otro hilo tenga abiertas (motor = `src/lib/cerebro/*` + ruta del agente; mapa = `src/app/cerebro/*`).
- No tocar el vault de producción ni ajustes de la cuenta sin autorización explícita de HB. Aprobaciones pendientes del Cerebro las aprueba HB, no Claude.
- No escribir llaves ni credenciales en código, docs o chat.
- Probar con datos de prueba y decir cuándo algo no se verificó con los datos reales.
- Respuestas a HB en español, cortas, sin jerga.

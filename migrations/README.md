# Existing TaskManager service: Supabase preparation

Status: local implementation and isolated PostgreSQL rehearsal only. No hosted SQL has been executed. Live backup, schema, authentication, and Supabase/PostgREST checks remain prerequisites.

## Storage contract

Version 1 keeps the complete `DatabaseSchema` in one JSONB document. This preserves the application's current aggregate architecture and makes tasks, projects, evidence, history, calendar observations and request deduplication atomic. Every mutation reads a revision and commits with compare-and-swap. A concurrent writer receives a conflict; callbacks are not automatically rerun. Whole-base reads and writes are appropriate for this single-user MVP, not a claim of unlimited scalability.

All old CRUD methods and workspace transactions use this adapter. There are no independent writes to legacy tables and no fallback or seeding on read/error. A missing migration, partial Supabase configuration or unavailable backend fails closed. No migration runs during startup, build, login or a GET request.

## Required cutover order

1. Identify the actual Supabase project, recover access/DNS, inspect schema and ownership. Confirm every legacy table and extra tables/columns, RLS, service permissions, user records and attachments. Do not treat failed reads or empty API results as an export.
2. Freeze legacy writers for the final export. Produce a native complete database backup and protected attachment backup; record row counts, hashes, commit and restore procedure. Restore them on an isolated copy and verify them before SQL on production.
3. Produce a protected `taskmanager-legacy-export-v1` JSON envelope: `tables` contains complete arrays for companies, people, tasks, email_templates, smtp_config, agent_queue and users; `rowCounts` contains independently reconciled counts. Retain any additional tables in the envelope. The offline preparation tool requires the independently verified SHA256 of these exact bytes.
4. Run `tsx scripts/prepare-supabase-import.ts export.json VERIFIED_SHA256 new-private-bundle.json`. The destination must be new and protected; it contains credentials and private rows and must never be committed or published. It preserves the complete original envelope as well as the mapped data. It does not connect to any database. Its output is deliberately never marked production-ready.
5. Review the mapping against the actual schema, retain IDs/password hashes/salts and unknown fields, resolve every owner/user issue explicitly. Do not create DEMO identities, reactivate historic tasks or assign every task automatically to HB. Reconcile any legacy stores not covered by the known mapper.
6. On the restored isolated database, run `001_workspace_snapshot.sql`. It adds new tables/functions, leaves originals intact and imports zero rows. The approved import of the reviewed `bundle.data` is an explicit parameterized INSERT of singleton=true, revision=1 into `tm_workspace_v1`. Confirm full document equality, counts, real login, ownership, CRUD, repetition/retry and all new collections before considering the same operation remotely.
7. Validate the hosted RPC permission/cache behavior and service-role access, production HTTPS sessions and persistent attachments. Reload the PostgREST schema cache as required by the real environment. Prevent the old application or any external client from continuing to write legacy tables after cutover. A disk mounted at `/data` does not cover `<cwd>/data/attachments` unless the configured attachment path actually resolves there.
8. Replace only the existing Render service after these checks. Its disk means a brief stop/start; do not push `main` early because auto-deploy is enabled. No new service/database, cost or integration is part of this work.

## Rollback

`001_workspace_snapshot_rollback.sql` is intentionally non-destructive. Within the new adapter, `tm_workspace_restore_v1(expected_current_revision, historical_revision)` appends a compensating revision and retains all intervening history. It is an operator function, not an exposed UI endpoint; it rejects stale revisions. Freeze and export first because restoring history changes the current document.

Reverting to the original application is a separate compatibility operation: legacy tables become stale after cutover. Freeze, export the current document/history and reconcile every post-cutover change into the original schema, or deliberately restore the verified pre-cutover backup with explicit handling of newer work. Test that procedure on a copy before reverting the artifact. Never deploy the old app against stale tables as an automatic rollback. Keep the original backup, originals and history; no destructive DOWN script is supplied.

## Isolated verification

`tsx scripts/testSupabaseWorkspace.ts` executes the actual SQL on in-memory PostgreSQL via PGlite and drives the adapter/DBService through a local RPC bridge. It checks permissions, missing import, atomic writes, simulated overlapping revisions, history insert failure rollback, compensating restore, unchanged legacy rows, all workspace collections, CRUD, errors, and offline export hash/count/identity retention.

This is real isolated PostgreSQL execution, **not** Supabase-hosted HTTP integration, independent PostgreSQL server connections, real schema compatibility, live backup recovery, or production authentication. Those remain mandatory before deployment.

# Production DB migration runbook — Superset 4.0.2 → 6.1.0

Use `local-setup/migrate-to-6.1.0.sh`. It backs up, audits, resyncs sequences,
runs `superset db upgrade` + `superset init`, and verifies. Target alembic head:
**`4b2a8c9d3e1f`**.

## Prerequisites
- `psql` + `pg_dump` on the machine running the script.
- A way to run the **6.1.0** Superset code against the target DB for the migrate
  step — pick one with `--runner`:
  - `--runner container:<name>` — a running container/pod built from the 6.1.0
    image (the DB URI is injected via `SUPERSET__SQLALCHEMY_DATABASE_URI`).
  - `--runner local` — `superset` on PATH with a config already pointing at the DB.
  - `--runner print` — prints the two commands for you to run manually.
- The deployed 6.1.0 app **must use the same `SECRET_KEY`** as before, or the
  encrypted datasource passwords in `dbs` won't decrypt.

## Credentials
Supplied via env vars (or you're prompted) — never hardcoded:
`DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME`. Password also honored via `.pgpass`.

## Dry run first (recommended)
Restore a prod dump into a scratch DB, then validate it migrates clean:
```bash
createdb superset_prod_migrate
pg_restore -d superset_prod_migrate prod_dump.dump   # or psql < dump.sql
DB_HOST=localhost DB_USER=<u> DB_NAME=superset_prod_migrate \
  ./local-setup/migrate-to-6.1.0.sh --runner container:superset_app
```
`--audit-only` checks a dump WITHOUT changing anything (counts, legacy charts, head).

## Production cutover
1. **Maintenance window**: stop the old (4.0.2) Superset pods — no writes during migration.
2. Run the script against the live DB (it takes its own backup first):
   ```bash
   DB_HOST=<prod-db> DB_USER=<u> DB_PASSWORD=<pw> DB_NAME=superset \
     ./local-setup/migrate-to-6.1.0.sh --runner container:<6.1.0-one-off-pod>
   ```
3. Deploy the 6.1.0 app pods.
4. Smoke test: login, open a dashboard, confirm a `shipmnts-swimlane` chart renders,
   confirm a pivot value-sort works.

## Rollback
Restore the script's `superset_pre_610_*.dump` and redeploy the 4.0.2 image.

## The 3 things that bite (the script handles #1; you own #2 and #3)
1. **Sequence resync before `db upgrade`** — skipping → `duplicate key ab_permission_view_role_pkey`. (Automated in the script.)
2. **Same SECRET_KEY** in the new deployment — else datasource decryption 500s.
3. **Order**: stop old pods → backup → resync → migrate → start new pods. Never run old code against the migrated schema.

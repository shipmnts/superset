# Local Setup Notes (for next session: upgrade Superset to 5.x)

Last updated: 2026-06-04 (session eadb12ba)

## Current state

- Fork of Apache Superset, branch `production`. Currently running **Superset 4.0.2** via Docker.
- Run with: `cd local-setup && docker compose up -d`
- Image tag comes from `TAG` env (compose file: `apache/superset:${TAG:-latest-dev}`, currently 4.0.2).
- UI dev server: `cd superset-frontend && npm run dev-server` → http://localhost:9000 (webpack, proxies API to localhost:8088).
- Backend: `superset_app` container, port 8088. nginx on 80, redis on host port 6380.

## Metadata database (IMPORTANT)

- The `db` service in `local-setup/docker-compose.yml` is **commented out**.
- Superset connects to **Postgres running natively on the Mac**:
  - host `localhost` (from container: `host.docker.internal`), port `5432`
  - db `superset`, user `chintukumarbhanderi`, **no password**
- Contains real data: 21 dashboards, 713 charts, users `admin` + `cb123`.
- For 5.x upgrade: run `superset db upgrade` against this DB — **back it up first**:
  `pg_dump -h localhost -U chintukumarbhanderi superset > superset_backup.sql`

## Active config file (IMPORTANT)

- The container loads `docker/pythonpath_dev/superset_config.py` (NOT `local-setup/superset_config.py` — that dir is not mounted).
- This file was empty in git (commit af82feb71) which made Superset silently fall back to SQLite in the `superset_home` volume (had only junk users admin/admin2). Restored in session eadb12ba with:
  - `SQLALCHEMY_DATABASE_URI` built from DATABASE_* env vars (set in `local-setup/.env`)
  - `SECRET_KEY = "HOrfcYmVX4S1fWjK06roD7jhofDKRAhZRSGzk7qhz3muxSd5vG356wqf"` — REQUIRED, encrypts datasource passwords in the `dbs` table; wrong key → "Invalid decryption key" 500s
  - `FEATURE_FLAGS` with `ENABLE_TEMPLATE_PROCESSING: True` — REQUIRED, dashboards use Jinja (`{% if url_param(...) %}`)
  - Custom Jinja functions `parse_url_param` + `to_int` in `JINJA_CONTEXT_ADDONS` — REQUIRED by chart SQL; originals live in `deployment/*/superset-config.py`
  - Redis cache/celery config, CORS for http://localhost:9000
- Do not lose this file during the upgrade; it is git-tracked and currently modified.

## Data sources (dbs table)

| DB | URI | Status |
|---|---|---|
| fin_prod | mysql `host.docker.internal:3307` (db `4cc39d25ace286b6`, ssl=1) | needs a proxy/tunnel on Mac port 3307 (PlanetScale-style?) — NOT running, setup unknown |
| examples | `db:5432` | dead (db container commented out) |
| alex_prod / alex_prod1 | postgres `20.244.67.218:5432/alex_production` | direct connection, works |

## Upgrade 5.x checklist hints

1. Back up metadata Postgres (command above).
2. Bump `TAG` for the compose image (or update `local-setup/Dockerfile`).
3. Keep `docker/pythonpath_dev/superset_config.py` (SECRET_KEY + flags + jinja addons).
4. `superset db upgrade` runs via `superset-init` service (`docker/docker-init.sh`).
5. Rebuild `superset-frontend` deps (node version requirements change in 5.x).
6. Check fork's custom changes on branch `production` for conflicts (e.g. commits: data limit, prophet, adaptive format).
7. After upgrade verify: login (admin/cb123), dashboards list, a chart on alex_prod, Jinja-templated charts.

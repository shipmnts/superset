# Session Context: Superset 4.0.2 → 6.1.0 Upgrade (planning session, 2026-06-04)

Companion to `local-setup/UPGRADE-PLAN-6.1.0.md` (the executable plan) and `local-setup/NOTES.md` (environment notes from session eadb12ba). Read all three before starting — this file holds the research findings and decisions so the executing session does NOT need to re-investigate anything.

## Decisions made with the user (do not re-ask)

| Decision | Choice | Why |
|---|---|---|
| Target version | **6.1.0** (not 5.0.0) | 5.0.0 is a dead-end (no 5.1 ever shipped; project jumped to 6.x). 6.1.0 is latest stable (2026-05-13), actively maintained, and has the extensions architecture needed for the user's real goal: an **AI/agentic chart-creation assistant** (separate future project). |
| Strategy | **Fresh 6.1.0 base + re-apply customizations** | New branch `upgrade/superset-6.1.0` from the apache `6.1.0` tag; re-apply fork changes one-by-one. NOT a merge of upstream into `production` (would create thousands of conflicts). |
| Scope | **Local dev first** | Get local-setup Docker + metadata DB + frontend working and verified. Deployment/K8s/azure-pipelines = Phase 8, outline only. |
| Extra fork features | **Port ALL live features** | The fork is ~104 commits (~69 files), not just the 6 documented changes. Everything live in production gets ported; only clearly-obsolete items (mobile CSS revert) get skipped, with documentation. |
| AI feature | **Upgrade only; AI later** | No Superset version has built-in AI chart creation. Future approach: 6.x extension (`@apache-superset/core`, Module Federation, SQL Lab extension points GA in 6.1) + agent backend driving REST APIs (`/api/v1/chart/`, `/api/v1/dashboard/`, `/api/v1/sqllab/execute/`). The fork already has a partial `AiChartSummary` feature — port it as-is during the upgrade. |

## Repo / environment facts (verified this session)

- Repo: `/Users/chintukumarbhanderi/Shipments/superset2/superset`, branch `production`, origin `https://github.com/shipmnts/superset.git`. No upstream remote configured yet.
- Apache 4.0.2 base commit in fork history: **`df93420d2`**. Fork tip at planning time: `8be62849c`. ~104 custom commits between them.
- Working tree at planning time had staged+unstaged changes: `docker/pythonpath_dev/superset_config.py` (118-line restore — CRITICAL, contains SECRET_KEY), `local-setup/Dockerfile`, `local-setup/docker-compose.yml`, `local-setup/NOTES.md`, `package-lock.json`, `superset-frontend/package-lock.json`. **Must be committed before branching** (plan Phase 1).
- SECRET_KEY: `HOrfcYmVX4S1fWjK06roD7jhofDKRAhZRSGzk7qhz3muxSd5vG356wqf` — encrypts datasource passwords in `dbs`. Losing/changing it → "Invalid decryption key" 500s.
- Metadata DB: native Mac Postgres, `localhost:5432` (`host.docker.internal` from containers), db `superset`, user `chintukumarbhanderi`, no password. 21 dashboards, 713 charts, users `admin` + `cb123`.
- Compose `db` service is commented out — the `examples` datasource is dead, expected. `fin_prod` needs a mysql tunnel on Mac port 3307 (not running, setup unknown) — don't block on it. `alex_prod`/`alex_prod1` (postgres `20.244.67.218:5432/alex_production`) work and are the verification datasources.
- Active config file the container loads: `docker/pythonpath_dev/superset_config.py` (NOT `local-setup/superset_config.py` — that dir isn't mounted). `PYTHONPATH=/app/pythonpath:/app/docker/pythonpath_dev` in `local-setup/.env`.

## Verified 6.1.0 facts (primary sources; do NOT re-research)

- Tag `6.1.0` = commit `c83fb2bb1dcfac41ac51bcebd82471f4a7180d18` on `https://github.com/apache/superset.git`. Latest stable, released 2026-05-13. No 6.1.1 patch release existed at planning time.
- Docker Hub tags `apache/superset:6.1.0` and `apache/superset:6.1.0-dev` exist (pushed 2026-05-13). 6.x images: no bundled translations, no bundled DB drivers (need `psycopg2-binary` for the metadata DB — `local-setup/requirements-local.txt` already has it), built with `uv pip install`.
- Requirements: Python ≥3.10 (3.10–3.12); Node `^22.22.0`; npm `^10.8.1`; React 17; TypeScript 5.4.5; Ant Design 5; Webpack 5 / Module Federation.
- `superset/config.py` at 6.1.0 still has: `SUPERSET_DASHBOARD_POSITION_DATA_LIMIT` (exact name; default 65535 — fork sets 85535), `ROW_LIMIT`, `SAMPLES_ROW_LIMIT`, `JINJA_CONTEXT_ADDONS` (default `{}`, still supported).
- All fork feature flags still valid in 6.1.0: `ALERT_REPORTS`, `CHART_PLUGINS_EXPERIMENTAL`, `ENABLE_TEMPLATE_PROCESSING`, `EMBEDDED_SUPERSET`, `DRILL_TO_DETAIL`, `ALLOW_ADHOC_SUBQUERY`, `ENABLE_SUPERSET_META_DB`.
- **`superset-frontend/plugins/plugin-chart-pivot-table/src/react-pivottable/*` renamed `.jsx/.js` → `.tsx/.ts`** in 6.1.0 (`TableRenderers.tsx`, `utilities.ts`). The fork's pivot patches will NOT `git apply` — hand-port required (highest-risk item).
- Still at same paths in 6.1.0: `src/explore/components/ControlPanelsContainer.tsx`, `src/explore/controlUtils/getControlState.ts`, `packages/superset-ui-core/src/number-format/factories/createSmartNumberFormatter.ts`, `plugins/plugin-chart-pivot-table/src/plugin/controlPanel.tsx`.

## Breaking changes 4.0.2 → 6.1.0 that apply to this fork

- **Legacy charts removed with ONE-WAY DB auto-migrations**: legacy Area/Bar/dist_bar/Line/Heatmap/Sankey, Event Flow (no replacement), Sankey Loop (no replacement), Pivot Table v1 → v2. The 713 charts must be audited BEFORE migration (SQL in plan Phase 4.2). The DB backup is the only rollback.
- Jinja: `from_dttm`/`to_dttm` deprecated → `get_time_filter()`. Audit `slices.params` and templated SQL.
- CSV exports now `utf-8-sig` (BOM) — note for downstream consumers.
- `APP_NAME` no longer controls branding → theme `brandAppName` token; `CUSTOM_FONT_URLS` → `THEME_DEFAULT.token.fontUrls`.
- AUTH_OID removed (fork uses DB auth — no-op). `ENVIRONMENT_TAG_CONFIG` only accepts AntD semantic colors.
- Removed flags (no-ops for fork unless referenced): `DASHBOARD_CROSS_FILTERS`, `KV_STORE`, `SHARE_QUERIES_VIA_KV_STORE`, `HORIZONTAL_FILTER_BAR` (default-on now), `DISABLE_LEGACY_DATASOURCE_EDITOR`.
- Renames if ever used: `ALERT_REPORTS_EXECUTE_AS`→`ALERT_REPORTS_EXECUTORS`, `THUMBNAILS_EXECUTE_AS`→`THUMBNAILS_EXECUTORS`, `SIGNAL_CACHE_CONFIG`→`DISTRIBUTED_COORDINATION_CONFIG` (6.1).
- 6.1: Node 22 required; Postgres dependency reference bumped 16→17 (Mac native PG version should be checked but 4.x-era PG likely fine for metadata; flag if migration complains).

## Fork customization inventory (key commits for patch extraction)

Documented groups:
1. Data limit: `6e039a583` (`superset/config.py`, 65535→85535) — re-apply as `superset_config.py` override instead of core patch.
2. Prophet: `25e361f53` (requirements-local.txt × 5 locations).
3. Pivot column sorting: range `773eb7cf8`..`3a4faf9e9`, fixes `c18c4d435` (Heatmap edge case), `e39fb0be6`, `6981ee31d` (stopPropagation).
4. India number format: `5f580e729`, `5dc06eefb` (`createSmartNumberFormatter.ts`, `tenant_country=IN` → K/L/Cr).
5. Pivot link-cell rendering: `c1be4f9d8` (`TableRenderers.jsx`).
6. Mobile CSS revert: `f14276bfc` — default SKIP (obsolete).

Undocumented live features (all in scope — discovered via `git diff df93420d2..HEAD`):
7. Custom relative-date filter: `superset/utils/date_parser.py` (+128), `DateFilterControl/components/CustomCalendarFrame.tsx` (new), `utils/constants.ts` (+85), `types.ts`, `dateParser.ts`, `DateFilterLabel.tsx`.
8. Cross-DB / SQL table prefix: `superset/sql_parse.py` (+42), `superset/views/datasource/utils.py`. NOTE: 6.x moved SQL parsing to sqlglot — expect real rework, not a patch apply.
9. DB engine specs: `db_engine_specs/trino.py` (+16), `base.py` (+6).
10. Dashboard header: `src/dashboard/components/Header/index.jsx` (+450) — heavy hand-port (6.x refactored Header).
11. AI chart summary (partial): `src/components/AiChartSummary/ChartSummaryDrawer.tsx` (+98), `assets/images/genai.png`, `wand.png`, chartAction.js / Datasource hooks.
12. Misc: `plugin-chart-table/src/TableChart.tsx` (+30), `BigNumberWithTrendline/transformProps.ts`, `Timeseries/transformers.ts`, SqlLab editor changes, `MainPreset.js`, drill-to-detail column ordering, swimlane.

Infra: `Dockerfile-release` (FROM apache/superset:4.0.2 + Node 16 frontend build → needs 6.1.0 + Node 22), `local-setup/Dockerfile` (FROM shipmnts/superset:4.0.2), `deployment/{development,staging,production}/` (superset-config.py + k8s yamls + requirements), `azure-pipelines.yml` (builds shipmnts/superset, deploys per branch development/staging/production).

## Execution entry point

Follow `local-setup/UPGRADE-PLAN-6.1.0.md` phase by phase. Phase 1 (backups + commit working tree + tag `pre-6.1.0-upgrade`) is BLOCKING and must come first. Every phase has a verification gate and a rollback; don't proceed past a failing gate.

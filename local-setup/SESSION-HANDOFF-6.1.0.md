# Session handoff — Superset 4.0.2 → 6.1.0 upgrade (written 2026-06-04, session b30cc95d)

**Read first:** `local-setup/UPGRADE-PLAN-6.1.0.md` (the plan), `local-setup/UPGRADE-CONTEXT-6.1.0.md` (research/decisions), `docs/upgrade-6.1.0-running-notes.md` (live progress log). This file = exactly where we stopped and what to do next.

## Where we are

Branch: `upgrade/superset-6.1.0` (cut from apache tag 6.1.0 = `c83fb2bb1`). Rollback tag: `pre-6.1.0-upgrade` (= fork production tip + snapshot commit `9dcb66997`, on branch `upgrate-version-6`). Remotes: origin=shipmnts, upstream=apache. NOTHING pushed.

DB backups: `~/superset_backup_20260604.sql/.dump` + `~/superset_backup_20260604_pre_migrate.dump`. Patches: `~/superset_upgrade_patches/` (00–14 + README; reconciled).

| Phase | Status |
|---|---|
| 0–1 safety net | ✅ done (Gate 1) |
| 2 branch + patches | ✅ done (Gate 2) |
| 3 breaking-change triage | ✅ done (see running notes table) |
| 4 test-DB migration | ✅ done (Gate 4) — **sequence resync was required** |
| 5 stock 6.1.0 on real DB | ✅ done (Gate 5 user-verified). Real DB at alembic head `4b2a8c9d3e1f` |
| 6.1 data limit | ✅ config override commit |
| 6.2 prophet | ✅ via `docker/requirements-local.txt` (gitignored), prophet 1.2.0 in app+worker |
| 6.3 backend ports | ✅ 07-backend `5d1efb5`; 08 `c90c392`; 09 = full NO-OP (upstream has it) |
| 6.4 India format | ✅ `69163cf`-amended + follow-up gating commit (see decisions) |
| 6.5a date-filter frontend | ✅ ported `a5af766171`, spec-reviewed ✅, quality-reviewed (1 Important resolved — see below) |
| 6.5b AiChartSummary (patch 11) | ✅ done (`7600b45f4e`+`fc3d05be2a`), spec+quality reviewed |
| 6.5c misc frontend (patch 13 + MainPreset swimlane) | ✅ done (`ec6911dcac`+`bc58fdaaf1`) — most hunks were upstreamed NO-OPs |
| 6.5d dashboard Header (patch 10) | ✅ done (`68ebe1711b`+`427eb90024`) — ~95% NO-OP, drawer remnant ported |
| 6.6 pivot (patches 03+05+12, HIGHEST RISK) | ✅ done (`1cd5375ee2`) — spec was full fork diff `~/superset_upgrade_patches/pivot-fork-full-4.0.2-to-prod.diff` |
| patch 14 misc backend (was in NO plan phase — gap caught) | ✅ done (`10d8564aa4`+`58b7789bf2`) |
| 6.7 mobile CSS revert | ✅ SKIPPED + documented in running notes |
| 7 Node 22 + deps + build | ✅ build done (`b77a61e17d`) — **user browser gates PENDING** |
| 8 deployment/CI | ❌ TODO (outline only) |

## Environment right now

- Docker stack running from `local-setup/` with `TAG=6.1.0-dev` in `.env` (untracked file!). nginx :80, app :8088 healthy, worker, beat, redis :6380.
- Compose mounts `../docker` and `../superset` (repo backend code is LIVE in the container); `../superset-frontend` mount still disabled. Image's built assets were copied to repo `superset/static/assets` (gitignored) so :8088 has a UI until Phase 7 builds ours.
- `myEnv/` (a venv someone created in repo root) is ignored via `.git/info/exclude` — do not commit it.
- git author is auto-configured (hostname identity) — user may want to set git config user.email.

## Decisions made this session (do not re-ask)

1. **India number format**: user first said keep production behavior (Indian K/L/Cr for ALL tenants), then manually edited the file to GATE by `tenant_country=IN`. Final state = GATED (commit "fix: gate India number format by tenant_country=IN"). Treat gated as final unless user says otherwise.
2. Patch 08 sql_parse half + entire patch 09 = NO-OPs (6.1.0 ships equivalents: `check_functions_present` in `superset/sql/parse.py`, `DISALLOWED_SQL_FUNCTIONS` in `sql_lab.py:406`; trino thread app-context in `execute_with_cursor`).
3. Fork quirks preserved on purpose: dead `Last *` tokens in date_parser (shadowed by upstream handler — dead in 4.0.2 too); i18n'd token keys.
4. **Eager date anchors in DateFilterControl `constants.ts` (module-load moment()/dayjs()) — RESOLVED AS FAITHFUL**: the fork's 4.0.2 constants.ts is also eager (verified `git show pre-6.1.0-upgrade:...constants.ts` line 151+: `moment()` in module-scope object literal). Stale-after-midnight UI preview is a pre-existing fork quirk, NOT a port regression. Optionally fix later (lazy factory) as a separate improvement — do not block the upgrade on it.

## Workflow being used

Per plan header: superpowers:subagent-driven-development. For each remaining port: dispatch implementer subagent (give it the patch path + 6.1.0 adaptation context), then SPEC reviewer subagent (compare against patch + production via `git show pre-6.1.0-upgrade:<file>`), then QUALITY reviewer subagent. One commit per group, message pattern "feat: ... [patch NN]". Never push. Trivial config tweaks can be done by the controller directly.

## Next actions (in order) — ORIGINAL LIST BELOW IS STALE; see running notes for current state

**Actual next steps (as of the Phase-7-build session):**
1. USER browser regression gates at :8088 (full list at the end of the Phase 7 entry in `docs/upgrade-6.1.0-running-notes.md`) — swimlane charts should now render.
2. Optional: `npm run dev-server` (:9000) needs Node 22 (`source ~/.nvm/nvm.sh && nvm use 22`).
3. Phase 8: restore `deployment/` + `Dockerfile-release` + `azure-pipelines.yml` from `pre-6.1.0-upgrade`, update to FROM apache/superset:6.1.0 + Node 22, add data-limit config override, run mypy in CI (patch 14 mypy unverified locally).



1. **6.5b — patch 11 (AiChartSummary)**: `~/superset_upgrade_patches/11_ai_chart_summary.patch` (262 lines). Files: `src/dashboard/components/AiChartSummary/ChartSummaryDrawer.tsx` (new), `src/assets/images/genai.png` + `wand.png` (binary — copy via `git checkout pre-6.1.0-upgrade -- <paths>`), `src/components/Chart/chartAction.js`, `src/components/Datasource/DatasourceEditor.jsx` + `DatasourceModal.tsx`, `src/dashboard/components/SliceHeader/index.tsx` (+35, the AI button), `src/dashboard/components/gridComponents/Chart.jsx`. Note: drawer likely uses `axios`/`marked`/`dompurify` — deps added in Phase 7.
2. **6.5c — patch 13 misc frontend** (`13_misc_frontend.patch`, ~600 lines, many small files: Timeseries transformers, BigNumberWithTrendline, plugin-chart-table TableChart (+30), handlebars metrics, SqlLab editor/LeftBar/getInitialState, query/constants.ts, explore reducers + StashFormDataContainer, ConditionalFormatting, DashboardWrapper, HoverMenu, ResizableContainer, RefreshIntervalModal.test, FilterValue, MainPreset (+swimlane import — npm package `shipmnts-swimlane`, registration `new Swimlane().configure({ key: 'shipmnts-swimlane' })`)). Consider splitting into 2–3 subagent tasks (echarts/table plugins; SqlLab+explore; dashboard misc+MainPreset).
3. **6.5d — patch 10 dashboard Header** (`10_dashboard_header.patch`, 618 lines vs `src/dashboard/components/Header/index.jsx` etc.). 6.x refactored Header — expect heavy hand-port. Compare fork file via `git show pre-6.1.0-upgrade:superset-frontend/src/dashboard/components/Header/index.jsx`. Includes HeaderActionsDropdown changes + Header/types.ts.
4. **6.6 — pivot (patches 03 + 05 + 12), HIGHEST RISK, LAST**: react-pivottable files renamed .jsx/.js → .tsx/.ts in 6.1.0 (`TableRenderers.tsx`, `utilities.ts`) — pure hand-port using patches as behavior spec. Both sorting (03: dynamic `_asc`/`_desc` keys, controlPanel.tsx, ControlPanelsContainer.tsx (+134), getControlState.ts) and link cells (05: anchor rendering + stopPropagation) touch the same renderer — port together. Patch 12 (PivotTableChart.tsx, plugin/transformProps.ts, Styles.js, types.ts) belongs with them. Gates: sort asc/desc incl. Heatmap edge case (`c18c4d435`), links open new tab, link click ≠ sort trigger.
5. **Phase 7**: `nvm use 22`; add fork deps to `superset-frontend/package.json`: `axios ^1.7.8`, `dompurify ^3.2.2`, `marked ^15.0.3`, `simple-zstd ^1.4.2`, `shipmnts-swimlane ^0.1.5`; `npm install` (updates 6.1.0's lockfile — do NOT restore 4.0.2 lockfile); `npm run type` (note: repo tsc was failing pre-existing on `src/dataMask/reducer.test.ts` syntax + old-tsc moduleResolution — real check needs the npm-ci'd tsc); `npm run build`; build output replaces `superset/static/assets`; re-enable `../superset-frontend` mount if wanted; `npm run dev-server` → :9000. Re-run all Phase 6 gates + Gate 5 regression in browser (user does manual checks; swimlane charts should render after deps install).
6. **Phase 8** (after local sign-off): restore `deployment/` + `Dockerfile-release` + `azure-pipelines.yml` from tag and update (FROM apache/superset:6.1.0, Node 22, add data-limit override to deployment configs, prophet already in their requirements). Outline in plan.

## Gotchas for the next session

- Postgres sequences desync: if any DB restore happens, re-run the resync (pattern in running notes Phase 4) before `superset db upgrade`.
- The classifier blocks direct queries against `alex_prod` (prod datasource) — verification of chart rendering is the USER's manual browser step.
- `docker/requirements-local.txt` and `local-setup/.env` are gitignored/untracked — they exist locally; don't lose them (contents: prophet+flask_cors; TAG=6.1.0-dev + DB/redis env).
- Frontend can't be compile-verified until Phase 7 — implementer subagents should read 6.1.0 neighbor code carefully and note unverified items.
- `tests/` are not mounted into the container — `docker cp tests superset_app:/app/tests` to run pytest inside.

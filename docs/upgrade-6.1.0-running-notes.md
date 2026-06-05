# Running notes — Superset 4.0.2 → 6.1.0 upgrade (branch `upgrade/superset-6.1.0`)

## Phase 1 (done, on `upgrate-version-6` / tag `pre-6.1.0-upgrade`)
- Backups: `~/superset_backup_20260604.sql` (15M) + `.dump` (1.6M).
- SECRET_KEY confirmed in `docker/pythonpath_dev/superset_config.py` (line 80 of fork version).
- Snapshot commit `9dcb66997`, tag `pre-6.1.0-upgrade`.

## Phase 2 (done)
- upstream remote added; tag 6.1.0 = `c83fb2bb1`; branch `upgrade/superset-6.1.0` created from it.
- Patches in `~/superset_upgrade_patches/` (00 full delta + 01–14 groups + README).
- Reconciliation: all delta files covered except 4 intentional (package.json, package-lock.json, .tool-versions, cypress.config.ts — 6.1.0 keeps its own).

## Phase 3 — Breaking-change triage (UPDATING.md 4.1 → 6.1)

`from_dttm`/`to_dttm` grep across all patches: **clean** (DB-side audit in Phase 4.2).

### APPLIES (action needed)

| Change | Action |
|---|---|
| 6.1 `APP_NAME` no longer brands UI (#37370) | If branding wanted: `THEME_DEFAULT.token.brandAppName`. Verify config. |
| 6.1 default hash MD5→SHA-256 (#35621) | One-time cache/thumbnail invalidation. Accept (fallbacks include md5 by default). |
| 6.1 `setupExtensions`→`setupCodeOverrides` (#35062) | Grep ported frontend code; rename if used. |
| 6.0 `ENVIRONMENT_TAG_CONFIG` AntD-only colors (#34536) | Check config; use success/processing/error/warning/default. |
| 6.0 `DISALLOWED_SQL_FUNCTIONS` expanded (#33084) | Review saved queries/virtual datasets post-upgrade; override if needed. |
| 6.0 CSV export `utf-8-sig` BOM (#34235) | Downstream consumers exist — test; fallback `CSV_EXPORT={"encoding":"utf-8"}`. |
| 6.0 docker `INCLUDE_CHROMIUM=false` default (#34258) | ALERT_REPORTS needs a browser — verify image variant before enabling reports in 6.x. |
| 6.0 echarts `x_axis_sort_series*` renamed, params auto-migrated (#33116) | Verify sorted Timeseries charts post-migration. Back up `slices` (done via full dump). |
| 6.0 `THEME_OVERRIDES` broken; AntD5 theming (#31590) | Audit config; migrate to `THEME_DEFAULT` tokens if used. |
| 6.0 Drill-to-Detail exposed in EMBEDDED (#34319) | Security review of embedded roles (fork uses both flags). |
| 6.0 FAB 5.0 (#33055) | Re-test DB-auth login + custom views; run `superset init`. |
| 5.0 `ALERT_REPORTS_EXECUTE_AS`→`_EXECUTORS` (#31844) | Rename if set in deployment configs (Phase 8). |
| 5.0 legacy charts removed, one-way migration (#31582) | Phase 4.2 audit; **event_flow / sankey_loop deleted outright**. |
| 5.0 React 16→17 (#31961) | Compile gate in Phase 7. |
| 5.0 `fetch_csrf_token` cookie change (#31173) | Test cross-origin login from :9000 + embedded. |
| 5.0 docker `uv pip install` + reduced `superset` user privileges (#31260, #31385) | Update `local-setup/Dockerfile` if compose switches to `build:` (Phase 5.3 / 8). |
| 5.0 translations not bundled (#30099) | English-only fork → accept; note for Phase 8. |
| 5.0 data-upload endpoints reworked, `CSV_UPLOAD_MAX_SIZE` removed (#31959) | Audit automation later; no known usage. |
| 4.1 `LOG_LEVEL` default INFO (#28134) | Config already sets log level via env — fine. |
| 4.1 `all_database_access` now grants data access (#28205) | Review roles holding it (security). |
| 4.1 Slack file-upload API scope (#29264) | Only if Slack reports configured (Phase 8). |
| 4.x/4.1 index/column migrations "potential downtime" | Postgres metadata DB — low risk; runs in Phase 4/5. |

### Notable NO-OPs
- AUTH_OID removal (DB auth), ClickHouse items, Deck.gl OpenStreetView, domain sharding, `SESSION_USE_SIGNER`, GAQ config renames (GAQ not enabled), `HORIZONTAL_FILTER_BAR`/`DISABLE_LEGACY_DATASOURCE_EDITOR`/`USE-ANALAGOUS-COLORS` flags (not set), KV-store removal (no legacy /kv links known), MCP service (future AI project interest, not breaking), `CUSTOM_FONT_URLS` (not set).

### Destructive / one-way migrations
1. **#31582** legacy chart removal — event_flow & sankey_loop **deleted**; others auto-migrated to ECharts. Audit before migrating (Phase 4.2).
2. **#33116** x_axis_sort rename rewrites `slices.params` at scale (has a downgrade, but treat as one-way; full dump is the rollback).
3. Pivot v1→v2 predates 4.0.2 but verify no stragglers in 4.2 audit.

## Phase 4 results (done — Gate 4 ✅)

### 4.2 audit (test copy of metadata DB)
- **Legacy viz types: ZERO.** All 713 charts are modern: pivot_table_v2 (222), big_number_total (160), echarts_timeseries_bar (132), table (77), big_number (62), mixed_timeseries (40), echarts_area (9), pie (6), **shipmnts-swimlane (3)**, echarts_timeseries_line (2).
- `from_dttm`/`to_dttm` in slices.params: ZERO. Also zero in extracted patches.
- ⚠️ `shipmnts-swimlane` (3 charts) is a custom viz plugin — its registration must survive the MainPreset port (Phase 6.5) or those charts break.

### 4.3/4.4 migration on superset_61_test
- **First run FAILED**: `duplicate key ... ab_permission_view_role_pkey` — postgres sequences desynced from max(id) (pre-existing in the source DB, not a restore artifact: 11 FAB `ab_*` sequences lack ownership dependency).
- Fix: resync all 49 `*_id_seq` sequences to `GREATEST(max(id),1)` by name convention (`/tmp/resync2.sql` pattern). Re-run succeeded, exit 0, no errors.
- **⚠️ REQUIRED before migrating the REAL DB (Phase 5.4): run the same sequence resync against `superset`.**
- alembic head after upgrade: `4b2a8c9d3e1f` (= newest migration in 6.1.0 image, `2025_12_18_0220_create_tasks_table.py`).
- Counts unchanged: 21 dashboards / 713 charts.
- Migration log: /tmp/migration_test2.log (first failed run: /tmp/migration_test.log).

## Phase 5 — Stock 6.1.0 on real data (automated checks done; manual Gate 5 pending)

- `local-setup/.env`: TAG=4.0.2 → **6.1.0-dev** (note: .env is untracked).
- `local-setup/docker-compose.yml`: **`../superset` and `../superset-frontend` source mounts disabled** — they hide the image's built frontend assets (`superset/static/assets` empty in repo). Re-enable `../superset` in Phase 6 when custom backend code lands; assets handled in Phase 7.
- Fork files restored from tag onto upgrade branch: `docker/pythonpath_dev/superset_config.py` (SECRET_KEY/flags/Jinja addons), `docker/nginx/nginx.conf` (6.1.0's version requires envsubst-generated conf.d/superset.conf → crash loop; fork version is self-contained).
- Real DB migration: fresh backup `~/superset_backup_20260604_pre_migrate.dump`, 46 sequences resynced, `docker compose up superset-init` exit 0, alembic head `4b2a8c9d3e1f`, counts 21/713. Only noise: "User already exists admin".
- Automated Gate 5 checks ✅: `/health` 200 on :8088 and :80 (nginx); all 4 `dbs` URIs decrypt with SECRET_KEY; `ENABLE_TEMPLATE_PROCESSING` on; `parse_url_param`/`to_int` Jinja addons work in-app.
- Manual Gate 5 (browser, user): login admin + cb123; dashboards/charts lists; an alex_prod chart renders; a Jinja chart renders. NOTE: the 3 `shipmnts-swimlane` charts will NOT render until the custom plugin is ported (Phase 6.5/7) — expected.
- **Gate 5 PASSED (user-verified in browser, 2026-06-04).**

## Phase 6 progress

- **6.1 ✅** `SUPERSET_DASHBOARD_POSITION_DATA_LIMIT = 85535` as config override in `docker/pythonpath_dev/superset_config.py` (NOT a core patch). Verified live in app config. `../superset` source mount re-enabled; image's built assets copied into repo `superset/static/assets` (gitignored) so :8088 keeps a UI until Phase 7's own build.
- **6.2 ✅** prophet via `docker/requirements-local.txt` (gitignored, local bootstrap) — prophet 1.2.0 imports in app + worker. Tracked copies: `local-setup/requirements-local.txt` (already had it); `deployment/*` in Phase 8.
- **6.3 ✅** backend ports:
  - Patch 07 backend (`date_parser.py` custom relative-date tokens: Today/Current */-to-Date/Previous */Yesterday): hand-ported verbatim, commit `5d1efb5`. Spec+quality reviewed. Known fork quirk preserved: `Last *` branches dead (shadowed by upstream `Last` handler — was dead in 4.0.2 fork too). Frontend half pending in 6.5.
  - Patch 08: sql_parse.py half **NO-OP** (fork backport of upstream DISALLOWED_SQL_FUNCTIONS checker; 6.1.0 has `check_functions_present` in `superset/sql/parse.py`, enforced in `sql_lab.py:406`). url_params→samples/drill-detail form_data ported, commit `c90c392`. Spec+quality reviewed.
- **6.4 ✅** India number format ported (commit `69163cf`-amended). **FINAL user decision (superseding earlier "all tenants" call): GATED by `tenant_country=IN` — user manually edited the file; follow-up commit `7566751c8a`.** Treat gated as final unless user says otherwise.
  - Patch 09: **FULL NO-OP** — base.py disallowed-function check and trino.py thread app-context fix both ship natively in 6.1.0 (`trino.py execute_with_cursor` uses `copy_current_request_context` + `app.app_context()`). Verified by grep. No commit.
- **6.5a ✅** date-filter frontend (patch 07 frontend half) ported, commit `a5af766171`. Spec+quality reviewed. Eager date anchors in DateFilterControl `constants.ts` confirmed faithful (fork's 4.0.2 file also eager) — pre-existing quirk, not a regression; optional lazy-factory fix deferred.
- **6.5b ✅** AiChartSummary (patch 11) ported, commits `7600b45f4e` + `fc3d05be2a` (test follow-up). Spec+quality reviewed. Mapping notes: `chartAction.js`→`chartAction.ts` (url_params merged into samples payload); DatasourceEditor column-diff now in `Datasource/utils/index.ts updateColumns` (reorder counts as modified; the unconditional-`setColumns` half was already upstream in 6.1.0); `DatasourceModal/index.tsx` `override_columns: true`; new `dashboard/components/AiChartSummary/ChartSummaryDrawer.tsx` (ASF header added, antd v5 `open` prop, Card/Drawer from @superset-ui/core wrappers, Spin from antd); wand button + drawer JSX in SliceHeader kept COMMENTED OUT (disabled in prod, faithful); `Chart/Chart.tsx` passes `queriesResponse`; images byte-identical from `pre-6.1.0-upgrade`. Upstream `utils.test.tsx` assertions updated for new modified-count behavior (5/5 green).
- **6.5c ✅** misc frontend (patch 13) — triage found MOST hunks already upstream in 6.1.0 (NO-OPs, verified by inspection): Totals→Summary rename (#29360), TableChart Summary footer tooltip + cell-bar numeric guard, SqlLab showEmptyState useMemo refactor + setEmptyState removal + getInitialState dbId, StashFormDataContainer isMounted removal + restore test, exploreReducer stash-restore omit fix + both new reducer tests, exploreActions toBeFalsy assertion, HoverMenu z-index 11, FilterValue `force: shouldRefresh`, Timeseries `yAxis.inverse`/`showLegendTopOffset` removals, table package.json @ant-design/icons, RefreshIntervalModal.test (file gone — Header refactored to hooks), DashboardWrapper/ResizableContainer whitespace. Dead fork export `CUSTOM_CALENDAR` in core query/constants.ts NOT ported (nothing imports it; live constant lives in DateFilterControl utils since 6.5a). Live remnants ported in commit `ec6911dcac`: MainPreset.ts swimlane registration (key `shipmnts-swimlane`), 15 custom ConditionalFormatting colors (moved to `ConditionalFormattingControl/constants.ts` factory in 6.1.0), BigNumberWithTrendline cumsum-aware percent change (form-data key is camelCase `rollingType` — ChartProps camelCases formData; spec review caught a snake_case bug, fixed). Follow-up `bc58fdaaf1`: jest moduleNameMapper + `spec/__mocks__/shipmntsSwimlaneMock.tsx` stub so suites importing MainPreset load until Phase 7 installs the package. Spec+quality reviewed; BigNumber 20/20, visualizations 155/155, drill-detail suite green.
- **6.5d ✅** dashboard Header (patch 10) — triage: 618-line patch is ~95% reindent noise + upstreamed changes. NO-OPs verified: HeaderActionsDropdown redux-connect + `directPathToChild`→`dashboardComponentId` pop (native in `useHeaderActionsDropdownMenu.tsx:76,144,154`; flows to share/permalink in 6.1.0 — equivalent), types.ts additions (present; `isDropdownVisible`/`dataMask` obsoleted by hook refactor), HeaderActionsDropdown.test.tsx (component gone). Live remnant ported in `68ebe1711b`: commented-out dashboard-level wand + ChartSummaryDrawer in Header `rightPanelAdditionalItems` (class→hooks translations documented in-comment; fork quirk `dashboardInfo={dashboardInfo?.charts}` preserved). Follow-up `427eb90024`: `@ts-ignore` + `eslint-disable-line` on intentionally-unused AI-summary declarations in Header AND SliceHeader so `noUnusedLocals` tsc passes (imports stay value-unused → babel-elided → jest green without a `marked` stub). Spec+quality reviewed (Ready: Yes). Header+SliceHeader 97/97 tests green; tsc error count unchanged vs base (3 pre-existing/expected until Phase 7).
- **6.6 ✅** pivot feature set (patches 03+05+12, HIGHEST RISK) ported in `1cd5375ee2`. Patches were incremental fork commits — true spec was the full apache-4.0.2→fork-prod diff, saved as `~/superset_upgrade_patches/pivot-fork-full-4.0.2-to-prod.diff` (871 lines, 9 files). Ported onto 6.1.0's TS react-pivottable refactor: value-sorting (`_asc`/`_desc` dynamic choices; `isDynamic` on BaseControlConfig in chart-controls; getControlState guard; ControlPanelsContainer rowKeys/colKeys + choice injection incl. `c18c4d435` Heatmap guard), link cells in parseLabel (NOTE: fork PRODUCTION has NO stopPropagation — patch 05 added it but prod dropped it; link clicks DO bubble to cell handlers in prod too, so the old "link click ≠ sort" gate is wrong as worded — browser-verify against prod behavior, not the gate), expandCollapse threading + renderer collapse logic (+ fork's `hideOnExpand: true`), metric-totals headers/cells, styles (td color→`theme.colorText`; borders already lightest token). `MetricsLayoutEnum` re-exported from plugin index.ts (fork's `plugins/...` path doesn't resolve). Deviations: dropped fork console.logs, `rel="noreferrer"` on anchors, TS typing. Spec (hunk-by-hunk incl. sort arg order) + quality reviewed (Ready: Yes). Plugin suite 52/52 (8 new tests), controlUtils+CPC 51/51. Known inherited quirk: O(n²) unpivot in ControlPanelsContainer runs for all viz types — optimize-later candidate, do NOT fix during upgrade.
- **6.7 SKIP ✅ (documented)** mobile CSS revert (patch 06, fork commit `f14276bfc`) — intentionally NOT ported; obsolete against 6.1.0's responsive layout per plan triage. If mobile rendering regressions show up post-upgrade, revisit the patch as reference.
- **patch 14 ✅ (gap caught — was in NO phase of the plan!)** misc backend, ported in `10d8564aa4` + test follow-up `58b7789bf2`. NO-OPs verified: commands/exceptions `__repr__` (upstreamed), `DisallowedSQLFunction` (= upstream `SupersetDisallowedSQLFunctionException`, sql_lab.py:406-413), metastore_cache `_prune` (obsoleted by upsert/delete_expired refactor). Ported: `DatasetColumnsPutSchema.override_columns` Boolean (accepts the per-column key the fork UI sends — commit 7600b45f4e — schema-validation only, flag itself is dataset-level), dataset PUT forces `UpdateDatasetCommand(pk, item, True)` (fork semantics: PUT = full column replacement; uniqueness validation skipped; **partial-column PUTs now delete unlisted columns — fork-intended**; upstream test `test_update_dataset_update_column_uniqueness` reconciled 422→200), `get_form_data()` url_params passthrough from JSON body (no new security surface — url_params already client-controllable via form_data channels). Unit 29+93 passed; targeted integration tests run in container (2 passed; test DB initialized via superset_test_config — isolated SQLite, dev Postgres untouched). mypy unverified locally (no venv with mypy) — run in CI/Phase 8.
- **Phase 7 ✅ (build done — browser gates pending)** commit `b77a61e17d`. Node 22.22.3 via nvm (engines requires ^22.22.0; `source ~/.nvm/nvm.sh && nvm use 22` per shell). Deps added: `axios ^1.7.8`, `marked ^15.0.3` (→15.0.12), `shipmnts-swimlane ^0.1.5`. NOT added (already satisfied in 6.1.0): `dompurify` (^3.3.1 in superset-ui-core, only importer), `simple-zstd` (^1.4.2 in root deps). Gotchas hit & fixed:
  - `shipmnts-swimlane@0.1.5` peers on `react@^16.13.1` → ERESOLVE vs react 17. Fixed with npm `overrides`: `"shipmnts-swimlane": { "react": "$react" }`. NOTE: changing overrides re-resolved the ENTIRE lockfile (~49k lines churn) — intentional, committed.
  - `ChartSummaryDrawer.tsx` marked v15 typing fixed as predicted: `marked.parse(val, { async: false })` + `string[]` state. `npm run type` passes (exit 0) — the previously-noted dataMask/reducer tsc issues did not reproduce with the npm-ci'd toolchain.
  - shipmnts-swimlane's compiled lib FAILS under jest (`t` from @superset-ui/core unavailable at module load under jest's source moduleNameMapper) — the `spec/__mocks__/shipmntsSwimlaneMock.tsx` stub is now PERMANENT for tests (comment updated in jest.config.js); webpack uses the real package.
  - Stale `import/no-unresolved` eslint disables removed from ChartSummaryDrawer/MainPreset imports.
  - `npm run build` ✅ (exit 0, 17 warnings = typical size-limit noise); webpack outputs straight into `superset/static/assets` (gitignored) — replaced the image-copied assets; :8088 health OK and now serves OUR build. swimlane code confirmed in bundle.
  - Post-build jest sweep (304 suites / 2524 tests over all touched areas): ONE real regression found and fixed — upstream `DateFilterLabel.test.tsx` expected popover to open on the guessed frame, but the fork deliberately opens on Custom Calendar (`setFrame(CUSTOM_CALENDAR)` in onOpen, per patch 07); test updated to fork semantics, commit `3bac071436`. All other sweep failures were parallel-worker starvation artifacts (suites pass in smaller batches: 7/8 green, DateFilterControl 47/47). NOTE for browser gates: opening any time-range popover lands on the Custom Calendar tab BY DESIGN.
  - **Phase 7 follow-up fixes after first browser run:**
    - CRITICAL: app was blank — `shipmnts-swimlane@0.1.5` is precompiled against the 4.x core API; 6.1.0 moved `t`/translation out of `@superset-ui/core` into `@apache-superset/core/translation` (PR #36929), so swimlane's module-scope `t()` crashed app init. Fixed via issuer-scoped webpack `NormalModuleReplacementPlugin` + shim (`webpack.shims/shipmnts-swimlane-core-shim.ts`) restoring the 4.x API shape for swimlane only — commit `759b7a4b62`. Single bundled core copy preserved (no dual-copy singleton risk).
    - Stale `manifest.json`: a webpack-stats probe overwrote it with dev-style names; clean `npm run build` re-fixed. NOTE: Flask caches the asset manifest at boot — `docker restart superset_app` REQUIRED after every frontend build.
  - **Browser regression gates ✅ (agent-driven via Chrome DevTools, 2026-06-04):** login admin; welcome lists; swimlane chart 2506 renders (362 rows, week lanes; screenshot `local-setup/gate-screenshots/gate-swimlane.jpeg`); pivot 2809: per-metric `_asc`/`_desc` sort options injected and re-sort works (Won TEUs desc verified), Expand-collapse toggle collapses 51→9 rows with colspan adjust, per-metric totals headers/cells with rowTotals on; date filter popover opens on Custom Calendar with all 18 fork tokens, Month-to-Date resolves via backend to `2026-06-01 ≤ col < 2026-06-04`; India format gated by `?tenant_country=IN` works (20.2M→2.02Cr, 4.19M→41.91L); pivot 2183 link cells: 1000 real anchors (`target=_blank rel=noreferrer`), no raw-HTML leak; `/datasource/samples` POST body carries `url_params` ✓; dashboard 92 (3 tabs, 22 charts vs alex_prod): all charts rendered, 0 errors in console/UI, AI wand correctly hidden (feature disabled).
  - **NOT browser-tested (covered by unit+integration tests instead):** dataset column-reorder persistence / `override_columns` (would mutate real dataset metadata; covered by updateColumns jest 5/5 + dataset PUT integration tests 2/2 in container). User may spot-check on a disposable dataset if desired.
 — login; dashboards/charts lists; alex_prod + Jinja charts render; 3 swimlane charts NOW render; pivot: value-sort asc/desc (+Heatmap), link cells open new tab, expand/collapse arrows, metric totals; custom relative-date filters; India number format (IN tenants); dataset column reorder persists; samples/drill-detail respect url_params Jinja.

## RECONSTRUCTION (2026-06-05)

The working repo at `~/Shipments/superset2/superset` was deleted with ~25 unpushed commits. Rebuilt from: the fork patches (`~/superset_upgrade_patches/`), Claude session transcripts + file-history snapshots (`~/superset-reconstruction/PLAYBOOK.md`, `COMMITS.md`, `subagent-reports.txt`, `recovered-files/`), the migrated 6.1.0 metadata DB (untouched, live in host Postgres), and `origin/production` for fork configs/deployment. All work re-applied faithfully (same mappings/decisions, test counts matched: DateFilter 47, pivot 52, controlUtils 41, BigNumber/visualizations 185, Header 43, SliceHeader/Datasource 59). **Branch pushed to origin after every commit** — the original loss was caused by never pushing; that gap is closed. `.git` history is fewer commits than the original (grouped re-application) but functionally identical tree.

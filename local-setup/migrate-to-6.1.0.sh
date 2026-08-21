#!/usr/bin/env bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# =============================================================================
# Superset 4.0.2 -> 6.1.0 database migration
# =============================================================================
# Migrates a Superset metadata database to 6.1.0 (alembic head 4b2a8c9d3e1f).
# Safe to run against a dump-restored copy (dry run) or the live DB (cutover).
#
# WHAT IT DOES (in order, with a confirmation prompt before mutating anything):
#   1. pg_dump backup of the target DB (your rollback)
#   2. read-only audit: counts + legacy-chart check + alembic version
#   3. sequence resync   <-- REQUIRED; migration fails without it
#   4. superset db upgrade + superset init   (run with the 6.1.0 code)
#   5. verify: alembic head + counts unchanged
#
# CREDENTIALS: supplied via env vars (or you'll be prompted). NEVER hardcoded.
#   DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME
# The migration step (4) needs the NEW 6.1.0 Superset code pointed at this DB.
# Choose how with --runner:
#   --runner container:<name>   docker exec into a running 6.1.0 container
#                               (DB URI is overridden via env for that command)
#   --runner local              `superset` is on PATH in this shell, with a
#                               superset_config.py whose SQLALCHEMY_DATABASE_URI
#                               already points at the target DB
#   --runner print              just print the commands to run yourself (step 4)
#
# OPTIONS:
#   --audit-only        do steps 1-2 only (no resync, no migrate) — safe probe
#   --skip-backup       skip step 1 (use only if you already have a backup)
#   --backup-dir DIR    where to write the dump (default: current dir)
#   -y, --yes           don't prompt before the mutating steps
#
# EXAMPLES:
#   # Dry run against a restored copy, using a local 6.1.0 docker container:
#   DB_HOST=localhost DB_USER=chintukumarbhanderi DB_NAME=superset_prod_migrate \
#     ./migrate-to-6.1.0.sh --runner container:superset_app
#
#   # Production cutover (stop old pods first!), migrate in a one-off 6.1.0 pod:
#   DB_HOST=prod-db DB_USER=superset DB_PASSWORD=*** DB_NAME=superset \
#     ./migrate-to-6.1.0.sh --runner container:superset_migrate_pod
#
#   # Just check whether a dump is safe to migrate, change nothing:
#   DB_HOST=localhost DB_USER=superset DB_NAME=superset_copy \
#     ./migrate-to-6.1.0.sh --audit-only
# =============================================================================

set -euo pipefail

TARGET_HEAD="4b2a8c9d3e1f"   # 6.1.0 alembic head
BACKUP_DIR="."
RUNNER=""
AUDIT_ONLY=false
SKIP_BACKUP=false
ASSUME_YES=false

# ---- arg parsing ------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --runner)       RUNNER="$2"; shift 2 ;;
    --runner=*)     RUNNER="${1#*=}"; shift ;;
    --backup-dir)   BACKUP_DIR="$2"; shift 2 ;;
    --audit-only)   AUDIT_ONLY=true; shift ;;
    --skip-backup)  SKIP_BACKUP=true; shift ;;
    -y|--yes)       ASSUME_YES=true; shift ;;
    -h|--help)      sed -n '18,70p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

# ---- credentials (env or prompt) -------------------------------------------
: "${DB_HOST:=}"; : "${DB_PORT:=5432}"; : "${DB_USER:=}"; : "${DB_NAME:=}"; : "${DB_PASSWORD:=}"
[[ -z "$DB_HOST" ]] && read -rp "DB host: " DB_HOST
[[ -z "$DB_USER" ]] && read -rp "DB user: " DB_USER
[[ -z "$DB_NAME" ]] && read -rp "DB name: " DB_NAME
if [[ -z "$DB_PASSWORD" ]]; then
  read -rsp "DB password (blank if none / .pgpass): " DB_PASSWORD; echo
fi
export PGPASSWORD="$DB_PASSWORD"

PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1)
TS="$(date +%Y%m%d_%H%M%S)"

say()  { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m   ✓ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m   ✗ %s\033[0m\n' "$*" >&2; exit 1; }

confirm() {
  $ASSUME_YES && return 0
  read -rp $'\033[1;33m'"$1 [y/N]: "$'\033[0m' a
  [[ "$a" == "y" || "$a" == "Y" ]] || die "aborted by user"
}

# ---- connectivity -----------------------------------------------------------
say "Connecting to $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
"${PSQL[@]}" -tAc "SELECT 1" >/dev/null || die "cannot connect"
ok "connected"

# ---- step 2: audit (read-only) ---------------------------------------------
say "Audit (read-only)"
CUR_VER=$("${PSQL[@]}" -tAc "SELECT version_num FROM alembic_version" 2>/dev/null || echo "unknown")
echo "   current alembic version : $CUR_VER"
[[ "$CUR_VER" == "$TARGET_HEAD" ]] && ok "already at 6.1.0 head — nothing to migrate" && exit 0
N_DASH=$("${PSQL[@]}" -tAc "SELECT count(*) FROM dashboards" 2>/dev/null || echo "?")
N_SLICE=$("${PSQL[@]}" -tAc "SELECT count(*) FROM slices" 2>/dev/null || echo "?")
echo "   dashboards / slices     : $N_DASH / $N_SLICE"
LEGACY=$("${PSQL[@]}" -tAc \
  "SELECT COALESCE(string_agg(DISTINCT viz_type, ', '),'(none)') FROM slices \
   WHERE viz_type IN ('event_flow','sankey','sankey_loop','filter_box','iframe','markup','para','directed_force','heatmap','horizon','partition','rose','chord')" \
  2>/dev/null || echo "?")
echo "   legacy viz types present: $LEGACY"
[[ "$LEGACY" != "(none)" && "$LEGACY" != "?" ]] && \
  printf '\033[1;33m   ! some of these are removed/one-way-migrated in 5.0/6.x — review before cutover\033[0m\n'

if $AUDIT_ONLY; then ok "audit-only: done (nothing changed)"; exit 0; fi

# ---- step 1: backup ---------------------------------------------------------
if ! $SKIP_BACKUP; then
  say "Backup (rollback safety)"
  BFILE="$BACKUP_DIR/superset_pre_610_${DB_NAME}_${TS}.dump"
  confirm "Take pg_dump backup to $BFILE ?"
  pg_dump -Fc -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$BFILE"
  ok "backup written: $BFILE ($(du -h "$BFILE" | cut -f1))"
fi

# ---- step 3: sequence resync (REQUIRED) ------------------------------------
say "Sequence resync (prevents duplicate-key failures during db upgrade)"
confirm "Resync all sequences in '$DB_NAME' to GREATEST(max(id),1) ?"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  s          RECORD;
  tbl        TEXT;
  col        TEXT;
  maxid      BIGINT;
  n_done     INT := 0;
  n_skip     INT := 0;
BEGIN
  FOR s IN
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    tbl := NULL; col := NULL;

    -- 1) preferred: follow the ownership dependency (covers "owned" sequences)
    SELECT t.relname, a.attname
      INTO tbl, col
    FROM pg_class seqc
    JOIN pg_depend d  ON d.objid = seqc.oid AND d.deptype = 'a'
    JOIN pg_class t   ON t.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
    WHERE seqc.relkind = 'S' AND seqc.relname = s.sequence_name
    LIMIT 1;

    -- 2) fallback: name convention <table>_id_seq  (covers the FAB ab_* ones
    --    whose sequences lack an ownership link)
    IF tbl IS NULL AND s.sequence_name LIKE '%\_id\_seq' THEN
      tbl := left(s.sequence_name, length(s.sequence_name) - length('_id_seq'));
      col := 'id';
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = tbl AND column_name = col
      ) THEN
        tbl := NULL;
      END IF;
    END IF;

    IF tbl IS NULL THEN
      RAISE NOTICE 'SKIP  % (no table mapping)', s.sequence_name;
      n_skip := n_skip + 1;
      CONTINUE;
    END IF;

    EXECUTE format('SELECT COALESCE(MAX(%I),0) FROM %I', col, tbl) INTO maxid;
    EXECUTE format('SELECT setval(%L, GREATEST(%s, 1))', s.sequence_name, maxid);
    n_done := n_done + 1;
  END LOOP;
  RAISE NOTICE 'resynced % sequences, skipped %', n_done, n_skip;
END $$;
SQL
ok "sequences resynced"

# ---- step 4: migrate --------------------------------------------------------
say "Migrate (superset db upgrade -> $TARGET_HEAD, then superset init)"
DB_URI="postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

run_migration() {
  case "$RUNNER" in
    container:*)
      local C="${RUNNER#container:}"
      echo "   running inside container: $C"
      docker exec -e "SUPERSET__SQLALCHEMY_DATABASE_URI=$DB_URI" "$C" superset db upgrade
      docker exec -e "SUPERSET__SQLALCHEMY_DATABASE_URI=$DB_URI" "$C" superset init
      ;;
    local)
      echo "   running with local 'superset' (config must already target this DB)"
      superset db upgrade
      superset init
      ;;
    print|"")
      cat <<EOF

   >>> Run these with the 6.1.0 Superset code, pointed at the target DB:

   export SUPERSET__SQLALCHEMY_DATABASE_URI='$DB_URI'
   superset db upgrade
   superset init

   (then re-run this script with --audit-only to verify the head)
EOF
      return 1
      ;;
    *) die "unknown --runner '$RUNNER' (use container:<name> | local | print)" ;;
  esac
}

confirm "Proceed with the migration now?"
if run_migration; then
  # ---- step 5: verify -------------------------------------------------------
  say "Verify"
  NEW_VER=$("${PSQL[@]}" -tAc "SELECT version_num FROM alembic_version")
  echo "   alembic version now : $NEW_VER"
  [[ "$NEW_VER" == "$TARGET_HEAD" ]] && ok "at 6.1.0 head ($TARGET_HEAD)" || die "head mismatch — expected $TARGET_HEAD"
  N_DASH2=$("${PSQL[@]}" -tAc "SELECT count(*) FROM dashboards")
  N_SLICE2=$("${PSQL[@]}" -tAc "SELECT count(*) FROM slices")
  echo "   dashboards / slices : $N_DASH2 / $N_SLICE2  (was $N_DASH / $N_SLICE)"
  [[ "$N_DASH2" == "$N_DASH" && "$N_SLICE2" == "$N_SLICE" ]] && ok "counts unchanged" \
    || printf '\033[1;33m   ! count changed — investigate before trusting the migration\033[0m\n'
  say "DONE — migration complete. Deploy the 6.1.0 app and smoke-test (login, a dashboard, a swimlane chart)."
  echo "   SECRET_KEY reminder: the deployed app MUST use the same SECRET_KEY as before,"
  echo "   or datasource passwords in the 'dbs' table won't decrypt."
else
  say "Migration commands printed above — run them, then: $0 --audit-only (to confirm head)"
fi

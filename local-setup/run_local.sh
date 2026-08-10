#!/usr/bin/env bash
#
# Run Superset natively (no Docker) against a local Postgres metadata database.
#
#   ./local-setup/run_local.sh            # http://127.0.0.1:8088
#   PORT=8090 ./local-setup/run_local.sh  # different port
#
# Login for a database restored from a production dump: admin2 / admin
# (production password hashes are scrypt, which macOS system Python cannot
# verify -- see local-setup/README_local.md).
#
set -euo pipefail

# Resolve the repo root from this script's location, so the script works
# regardless of where it is invoked from and for any checkout path.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"

PORT="${PORT:-8088}"
HOST="${HOST:-127.0.0.1}"
VENV="${VENV:-$REPO/venv}"

if [ ! -x "$VENV/bin/superset" ]; then
  echo "error: no Superset venv at $VENV" >&2
  echo "Create it first -- see local-setup/README_local.md" >&2
  exit 1
fi

export SUPERSET_CONFIG_PATH="${SUPERSET_CONFIG_PATH:-$SCRIPT_DIR/superset_config_local.py}"
export SUPERSET_HOME="${SUPERSET_HOME:-$HOME/.superset-local}"
export FLASK_APP=superset
export PYTHONWARNINGS=ignore

echo "repo:   $REPO"
echo "config: $SUPERSET_CONFIG_PATH"
echo "url:    http://$HOST:$PORT"

cd "$REPO"
exec "$VENV/bin/superset" run -h "$HOST" -p "$PORT" --with-threads

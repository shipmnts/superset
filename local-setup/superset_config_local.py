"""Superset config for running natively on a developer machine.

Used by local-setup/run_local.sh. Unlike local-setup/superset_config.py (which
targets the Docker Compose stack), this one has no Redis/Celery dependency, so
`superset run` works with nothing but a local Postgres.

Points at a local Postgres database restored from a production dump. Override
the connection with SUPERSET_METADATA_URI if your database is named differently.
"""

import os
from datetime import timedelta

import pymysql
from flask_caching.backends.filesystemcache import FileSystemCache

# The stored MySQL connections use `mysql+mysqldb://`, whose driver is the C
# extension `mysqlclient`; it needs MySQL headers + pkg-config to build, which
# is awkward on macOS. Registering pure-Python pymysql as MySQLdb satisfies the
# same dialect. Without this, `get_available_engine_specs()` drops the mysql
# engine entirely and "Edit database" renders a blank BASIC tab for MySQL.
# NOTE: local only -- the Docker image installs the real mysqlclient.
pymysql.install_as_MySQLdb()

SUPERSET_HOME = os.environ.get(
    "SUPERSET_HOME", os.path.expanduser("~/.superset-local")
)
for _subdir in ("cache", "data_cache", "sqllab"):
    os.makedirs(os.path.join(SUPERSET_HOME, _subdir), exist_ok=True)

# --- Metadata database ----------------------------------------------------
SQLALCHEMY_DATABASE_URI = os.environ.get(
    "SUPERSET_METADATA_URI",
    "postgresql+psycopg2://postgres@localhost:5432/superset_old_prod",
)

# Local-only key. This is NOT the key production data is encrypted with (that
# lives in the deployment's SECRET_KEY env var), so credentials restored from a
# production dump will not decrypt -- re-enter connection passwords in the UI.
SECRET_KEY = os.environ.get(
    "SUPERSET_SECRET_KEY",
    "HOrfcYmVX4S1fWjK06roD7jhofDKRAhZRSGzk7qhz3muxSd5vG356wqf",
)

# --- Caching: local filesystem, no Redis ----------------------------------
CACHE_CONFIG = {
    "CACHE_TYPE": "FileSystemCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_DIR": os.path.join(SUPERSET_HOME, "cache"),
}

# Chart data cached for 24h to match production. Dashboards built on large
# virtual datasets fire many concurrent copies of the same expensive SQL on
# first load; caching means that cost is paid once.
DATA_CACHE_CONFIG = {
    "CACHE_TYPE": "FileSystemCache",
    "CACHE_DEFAULT_TIMEOUT": int(timedelta(hours=24).total_seconds()),
    "CACHE_DIR": os.path.join(SUPERSET_HOME, "data_cache"),
}

RESULTS_BACKEND = FileSystemCache(os.path.join(SUPERSET_HOME, "sqllab"))

# Matches deployment/{production,staging}/superset-config.py; the 60s default
# is not enough for large virtual datasets under parallel load.
SUPERSET_WEBSERVER_TIMEOUT = int(timedelta(minutes=5).total_seconds())
SQLLAB_TIMEOUT = int(timedelta(minutes=5).total_seconds())

# --- No Celery worker locally: SQL Lab runs queries synchronously ----------
CELERY_CONFIG = None

FEATURE_FLAGS = {
    "ALERT_REPORTS": False,
    "CHART_PLUGINS_EXPERIMENTAL": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
}

SQLLAB_CTAS_NO_LIMIT = True

# Serving plain http on localhost; Talisman would force https redirects.
TALISMAN_ENABLED = False
WEBDRIVER_BASEURL = "http://localhost:8088/"
WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL

EXTRA_CATEGORICAL_COLOR_SCHEMES = [
    {
        "id": "shipmnts_colors",
        "description": "shipmnts colors",
        "label": "Shipmnts",
        "isDefault": True,
        "colors": [
            "#5ac189",
        ],
    }
]

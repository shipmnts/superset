import json
import logging
import os

from celery.schedules import crontab
from flask_caching.backends.filesystemcache import FileSystemCache

logger = logging.getLogger()

DATABASE_DIALECT = os.getenv("DATABASE_DIALECT")
DATABASE_USER = os.getenv("DATABASE_USER")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD")
DATABASE_HOST = os.getenv("DATABASE_HOST")
DATABASE_PORT = os.getenv("DATABASE_PORT")
DATABASE_DB = os.getenv("DATABASE_DB")

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = (
    f"{DATABASE_DIALECT}://"
    f"{DATABASE_USER}:{DATABASE_PASSWORD}@"
    f"{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_DB}"
)

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_CELERY_DB = os.getenv("REDIS_CELERY_DB", "0")
REDIS_RESULTS_DB = os.getenv("REDIS_RESULTS_DB", "1")

RESULTS_BACKEND = FileSystemCache("/app/superset_home/sqllab")
FRONTEND_BASEURL = "http://localhost:9000"
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": [r"/*"],
    "origins": ["http://localhost:9000"],
}
CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": REDIS_RESULTS_DB,
}
DATA_CACHE_CONFIG = CACHE_CONFIG


class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    imports = ("superset.sql_lab",)
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"
    worker_prefetch_multiplier = 1
    task_acks_late = False
    beat_schedule = {
        "reports.scheduler": {
            "task": "reports.scheduler",
            "schedule": crontab(minute="*", hour="*"),
        },
        "reports.prune_log": {
            "task": "reports.prune_log",
            "schedule": crontab(minute=10, hour=0),
        },
    }


CELERY_CONFIG = CeleryConfig

FEATURE_FLAGS = {
    "ALERT_REPORTS": True,
    "CHART_PLUGINS_EXPERIMENTAL": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
}
ALERT_REPORTS_NOTIFICATION_DRY_RUN = True
WEBDRIVER_BASEURL = "http://superset:8088/"
# The base URL for the email report hyperlinks.
WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL

SQLLAB_CTAS_NO_LIMIT = True
SECRET_KEY = "HOrfcYmVX4S1fWjK06roD7jhofDKRAhZRSGzk7qhz3muxSd5vG356wqf"

# Fork customization (was a superset/config.py patch on 4.0.2, commit 6e039a583):
# allow larger dashboard position payloads. Applied as a config override so core
# stays unpatched across upgrades.
SUPERSET_DASHBOARD_POSITION_DATA_LIMIT = 85535

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


# ---------------- Custom Methods ---------------------------


def parse_url_param(param):
    try:
        arr = param.split(',')
        res = "('" + "', '".join(arr) + "')"
        return res
    except json.JSONDecodeError as e:
        print("ERROR: ", e.msg)
        return param


def to_int(value):
    try:
        return int(value)
    except (ValueError, TypeError):
        return value  # Return the original value if conversion fails


JINJA_CONTEXT_ADDONS = {
    'parse_url_param': parse_url_param,
    'to_int': to_int,
}


# ---------------- MCP service (AI integration) ---------------------------
# Lets MCP-compatible AI clients (Claude Desktop/Code, ChatGPT, ...) explore
# datasets, run SQL, and create charts/dashboards via the `superset mcp run`
# service (port 5008, separate compose service `superset-mcp`).
# Dev auth mode: all MCP requests act as this Superset user. For production,
# switch to JWT auth (see superset/mcp_service/PRODUCTION.md) instead.
MCP_DEV_USERNAME = "admin"
SUPERSET_WEBSERVER_ADDRESS = "http://localhost:8088"

import os
from logging.handlers import RotatingFileHandler
from celery.schedules import crontab
from flask_caching.backends.rediscache import RedisCache
import json


#------------------ REDIS SETUP ---------------------

REDIS_HOST = os.getenv('REDIS_HOST')
REDIS_PORT = int(os.getenv('REDIS_PORT'))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD')
CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 86400,
    'CACHE_KEY_PREFIX': 'superset_cache_',
    'CACHE_REDIS_URL': f'redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/5'
}
DATA_CACHE_CONFIG = CACHE_CONFIG
FILTER_STATE_CACHE_CONFIG = CACHE_CONFIG
EXPLORE_FORM_DATA_CACHE_CONFIG = CACHE_CONFIG

#-------------------- Postgres------------------------

POSTGRES_USER = os.getenv('POSTGRES_USER')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD')
POSTGRES_HOST = os.getenv('POSTGRES_HOST')
POSTGRES_PORT = os.getenv('POSTGRES_PORT')
POSTGRES_DB = os.getenv('POSTGRES_DB')

SQLALCHEMY_DATABASE_URI = 'postgresql://{0}:{1}@{2}:{3}/{4}'.format(
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_DB
)

# Metadata DB connection pool.
# Defaults (pool_size=5, max_overflow=10) give only 15 connections per process,
# which is fewer than the 20 gunicorn gthreads run-server.sh starts. Under load
# threads queue on the pool and fail with:
#   sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10 reached,
#   connection timed out, timeout 30.00
SQLALCHEMY_ENGINE_OPTIONS = {
    # keep at least one connection per gunicorn thread (SERVER_THREADS_AMOUNT)
    'pool_size': int(os.getenv('SQLALCHEMY_POOL_SIZE', 20)),
    # burst room above pool_size; set to -1 for unlimited if Postgres has headroom
    'max_overflow': int(os.getenv('SQLALCHEMY_MAX_OVERFLOW', 20)),
    'pool_timeout': int(os.getenv('SQLALCHEMY_POOL_TIMEOUT', 60)),
    # recycle before Postgres/proxy drops idle connections
    'pool_recycle': int(os.getenv('SQLALCHEMY_POOL_RECYCLE', 300)),
    'pool_pre_ping': True,
}

#---------------DEBUGGING--------------------

DEBUG=True
LOG_LEVEL = 'DEBUG'

#----------------- Feature Flags ------------------
FEATURE_FLAGS = {
    "ALERT_REPORTS": True,
    "EMBEDDED_SUPERSET": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "DRILL_TO_DETAIL": True,
    # ADHOC_DASHBOARD_NATIVE_FILTERS removed: flag no longer exists in 6.x
    # (adhoc dashboard native filters are standard behavior).
    "CHART_PLUGINS_EXPERIMENTAL": True,
    "DASHBOARD_VIRTUALIZATION": False
}

ALERT_REPORTS_NOTIFICATION_DRY_RUN = True
SQLLAB_CTAS_NO_LIMIT = True

# Fork override (was a core patch on 4.0.2; config-only since 6.1.0 upgrade):
# large dashboards exceed the default position-data size limit.
SUPERSET_DASHBOARD_POSITION_DATA_LIMIT = 85535

# ------------------ MCP service (AI integration) ---------------------
# Consumed by the `superset mcp run` process (separate container in the
# staging deployment, port 5008). Lets MCP clients (Claude, ChatGPT, ...)
# explore datasets, run SQL, build charts/dashboards.
#
# REVIEW NOTE (senior dev): dev-mode auth — every MCP request acts as this
# single Superset user. Acceptable only if the /mcp route is NOT publicly
# reachable on staging. If staging is internet-exposed, switch to JWT:
#   MCP_AUTH_ENABLED = True   (+ JWT issuer/audience/secret per
#   superset/mcp_service/PRODUCTION.md) and remove MCP_DEV_USERNAME.
MCP_DEV_USERNAME = os.getenv('MCP_DEV_USERNAME', 'admin')
# ------------------ Embedded Configurations --------------------

BASE_URL = os.getenv('SUPERSET_URL')
ALEX_BACKEND_URL = os.getenv('ALEX_BACKEND_URL')
FRONTEND_URL = os.getenv('FRONTEND_URL')
MOBILE_DASHBOARD_URL = os.getenv('MOBILE_DASHBOARD_URL')
SECRET_KEY = os.getenv('SECRET_KEY')
SUPERSET_WEBSERVER_TIMEOUT = 300
ENABLE_PROXY_FIX = True
TALISMAN_ENABLED = False # since we our using embedded sdk, so we dont this option to embedded dashboard access.
OVERRIDE_HTTP_HEADERS = { "Content-Security-Policy": f"frame-ancestors {FRONTEND_URL} {MOBILE_DASHBOARD_URL} " } 
GUEST_TOKEN_JWT_EXP_SECONDS = 1800
GUEST_ROLE_NAME = "Gamma"
WTF_CSRF_ENABLED = True
WTF_CSRF_TIME_LIMIT = 60 * 60 * 24 * 7
ENABLE_CORS = True

PUBLIC_PATH = "/superset/"
DEFAULT_URL = "/superset/"

CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["Content-Type", "Authorization"],
    "expose_headers": ["Content-Type", "Authorization"],
    "allow_methods": ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
     'origins': [f'{ALEX_BACKEND_URL}']
}
    

#---------------- Custom Methods ---------------------------


def parse_url_param(param):
    try:
        arr = param.split(',')
        res = "('" + "', '".join(arr) + "')"
        return res
    except json.JSONDecodeError as e:
        print("ERROR: ",e.msg)
        return param
def to_int(value):
    try:
        return int(value)
    except (ValueError, TypeError):
        return value  # Return the original value if conversion fails

JINJA_CONTEXT_ADDONS = {
     'parse_url_param': parse_url_param,
     'to_int':to_int
}

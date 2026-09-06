# syntax=docker/dockerfile:1.7-labs

FROM node:22-bookworm-slim AS frontend-builder
ENV NODE_OPTIONS="--max-old-space-size=8192"
ENV CYPRESS_INSTALL_BINARY=0
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential zstd && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app/superset-frontend
COPY superset-frontend/package.json superset-frontend/package-lock.json ./
COPY --parents superset-frontend/plugins/*/package.json superset-frontend/plugins/*/package-lock.json  ../
COPY --parents superset-frontend/packages/*/package.json superset-frontend/packages/*/package-lock.json  ../

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci

WORKDIR /app
COPY superset-frontend ./superset-frontend
WORKDIR /app/superset-frontend
# webpack writes to ../superset/static/assets -> /app/superset/static/assets
RUN npm run build


FROM apache/superset:6.1.0
ENV SUPERSET_HOME=/app
ENV TEMP_DIR=/app/temp-superset
USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    default-libmysqlclient-dev \
    pkg-config \
    libssl-dev \
    vim \
    build-essential \
    python3 \
    zstd \
    curl git && \
    rm -rf /var/lib/apt/lists/*

ARG BRANCH
COPY ./superset ${SUPERSET_HOME}/superset
COPY --from=frontend-builder --chown=superset:superset /app/superset/static/assets ${SUPERSET_HOME}/superset/static/assets
COPY ./deployment/${BRANCH}/requirements-local.txt /app/
# Must be `uv pip install`, not `pip install`: 6.1.0 serves from a uv venv at
# /app/.venv which contains no pip, so bare `pip` installs into the system
# interpreter and the pod dies with ModuleNotFoundError: No module named 'psycopg2'.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --python /app/.venv/bin/python -r /app/requirements-local.txt
COPY ./deployment/${BRANCH}/superset-config.py /app/pythonpath/superset_config.py
USER superset

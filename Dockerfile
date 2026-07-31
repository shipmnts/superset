# syntax=docker/dockerfile:1.7-labs

FROM node:16-bookworm-slim AS frontend-builder
ENV NODE_OPTIONS="--max-old-space-size=8192"
ENV CYPRESS_INSTALL_BINARY=0
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g npm@8.19.4

WORKDIR /app/superset-frontend
COPY superset-frontend/package.json superset-frontend/package-lock.json ./
COPY --parents superset-frontend/plugins/*/package.json superset-frontend/plugins/*/package-lock.json  ../
COPY --parents superset-frontend/packages/*/package.json superset-frontend/packages/*/package-lock.json  ../

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install --force

WORKDIR /app
COPY superset-frontend ./superset-frontend
WORKDIR /app/superset-frontend
RUN npm run build


FROM apache/superset:4.0.2
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
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r /app/requirements-local.txt
COPY ./deployment/${BRANCH}/superset-config.py /app/pythonpath/superset_config.py
USER superset
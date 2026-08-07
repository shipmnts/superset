# syntax=docker/dockerfile:1.7-labs

FROM apache/superset:6.1.0
ENV SUPERSET_HOME=/app
ENV TEMP_DIR=/app/temp-superset
ENV BUILD_SUPERSET_FRONTEND_IN_DOCKER=true
ENV NODE_OPTIONS="--max-old-space-size=8192"
# Install Node.js and npm
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
    curl git \
    gnupg && \
    curl -sL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs



WORKDIR ${SUPERSET_HOME}/superset-frontend
COPY --chown=superset:superset superset-frontend/package.json superset-frontend/package-lock.json ./
COPY --chown=superset:superset --parents superset-frontend/plugins/*/package.json superset-frontend/plugins/*/package-lock.json  ../
COPY --chown=superset:superset --parents superset-frontend/packages/*/package.json superset-frontend/packages/*/package-lock.json  ../
USER superset

# Lockfile is consistent on 6.1.0 (swimlane react peer handled via package.json
# overrides), so use the reproducible npm ci instead of the old `install --force`.
RUN npm ci

WORKDIR ${SUPERSET_HOME}
COPY superset-frontend ./superset-frontend
WORKDIR ${SUPERSET_HOME}/superset-frontend
RUN npm run build

USER root
ARG BRANCH
COPY ./superset ${SUPERSET_HOME}/superset
COPY ./deployment/${BRANCH}/requirements-local.txt /app/
RUN pip install -r /app/requirements-local.txt
COPY ./deployment/${BRANCH}/superset-config.py /app/pythonpath/superset_config.py
USER superset
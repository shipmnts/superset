FROM apache/superset:latest as dev

COPY ./docker/pythonpath_dev/superset_config.py  /app/pythonpath/superset_config.py
COPY ./docker/.env /app/docker/.env
COPY ./superset/utils /app/superset/utils
EXPOSE 8088
USER superset

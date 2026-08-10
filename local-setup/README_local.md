# Running Superset natively (no Docker)

Runs Superset 4.0.2 straight from this checkout against a local Postgres
metadata database. Useful for working with a restored production dump without
starting the Docker Compose stack.

```bash
./local-setup/run_local.sh     # -> http://127.0.0.1:8088
```

Config lives in `local-setup/superset_config_local.py` (no Redis, no Celery).

---

## First-time setup

### 1. Python

Superset 4.0.2 imports `pkg_resources`, removed in setuptools 82, so setuptools
must be pinned below 81.

```bash
python3 -m venv venv
./venv/bin/python -m pip install --upgrade pip wheel "setuptools<81"
./venv/bin/python -m pip install -r requirements/base.txt
./venv/bin/python -m pip install psycopg2-binary "flask-cors==4.0.1" pymysql
```

`flask-cors` is pinned to 4.0.1 because 6.x requires `typing_extensions>=4.6`,
which conflicts with the 4.4.0 pinned in `requirements/base.txt`.

### 2. Frontend

Node **16.20.2** is required (`superset-frontend/package.json` engines).

```bash
source ~/.nvm/nvm.sh && nvm use 16.20.2
cd superset-frontend
npm install --no-save --legacy-peer-deps
npm install --no-save --legacy-peer-deps "@react-spring/web@^9.4.5" global-box currencyformatter.js
npm run build
```

Two gotchas:

- `npm ci` fails -- `package-lock.json` is out of sync with `package.json`
  (missing `type-fest`, `d3-color`). `--no-save` avoids rewriting the lockfile.
- `--legacy-peer-deps` skips three peer deps the webpack build needs, hence the
  second install. Without them the build ends in 9 module-not-found errors.

### 3. Metadata database

```bash
createdb -h localhost -U postgres superset_old_prod
pg_restore -h localhost -U postgres -d superset_old_prod \
  --no-owner --no-privileges production_superset.dump
```

Restore with a **full** restore. `--data-only` fails against an empty database,
since it skips every `CREATE TABLE`.

---

## Working with a production dump

### Encrypted credentials will not decrypt

Connection passwords are encrypted with production's `SECRET_KEY`, which is not
in this repo. Any ORM query touching `Database` then raises
`ValueError: Invalid decryption key`. Clear the encrypted columns:

```sql
UPDATE dbs SET password = NULL, encrypted_extra = NULL;
```

Do **not** delete the `dbs` rows instead: `tables.database_id` is `NO ACTION`
and the datasets reference them, so deleting either fails or destroys every
chart and dashboard. Re-enter connection passwords in the UI.

### Login

Production password hashes use scrypt, and macOS system Python links LibreSSL,
which has no `hashlib.scrypt` -- so no account can log in, and
`superset fab reset-password` crashes. Write a pbkdf2 hash directly:

```bash
./venv/bin/python -c "from werkzeug.security import generate_password_hash; \
  print(generate_password_hash('admin', method='pbkdf2:sha256'))"
# then: UPDATE ab_user SET password = '<hash>' WHERE username = 'admin2';
```

### Connecting to MySQL/MariaDB over a port-forward

macOS system Python (LibreSSL 2.8.3) caps at TLS 1.2, which MariaDB 11.4
rejects with `TLSV1_ALERT_PROTOCOL_VERSION`. Superset reports the resulting
error 2003 as "host might be down", which looks like a network fault.

Add this to the database's **Advanced -> Other -> Engine Parameters**:

```json
{"connect_args": {"ssl_disabled": true}}
```

Safe only because the traffic runs inside a `kubectl port-forward` tunnel.
Both of these LibreSSL problems disappear if the venv is built on a Homebrew
Python (OpenSSL 3.x) rather than `/usr/bin/python3`.

---

## Notes

- This config is local-only. The Docker image installs the real `mysqlclient`
  and ships OpenSSL 3.x, so none of the workarounds above apply to
  `deployment/{staging,production}`.
- `SUPERSET_WEBSERVER_TIMEOUT` and the 24h chart-data cache here mirror the
  production config.
- Env overrides: `PORT`, `HOST`, `VENV`, `SUPERSET_HOME`,
  `SUPERSET_METADATA_URI`, `SUPERSET_SECRET_KEY`.

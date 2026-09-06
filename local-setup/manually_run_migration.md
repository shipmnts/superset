<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Manual 6.x pre-flight — pure SQL

Run these directly against the Superset **metadata** database (Postico, psql,
DBeaver — anything). Nothing here needs the Superset CLI or a pod.

> Keep every statement inside a code fence when copying it anywhere.
> These queries contain `*` and `_`, which markdown silently rewrites in prose —
> a mangled `LIKE '%*/%'` turns into `LIKE '%_/%'` and matches the wrong rows.

## Why this exists

Superset 6.x re-parses SQL with sqlglot, which rewrites `--` line comments as
`/* ... */` block comments. If the comment *text* contains `*/`, the block
closes early and the rest of the line leaks out as SQL:

```text
-- avg_*/*_deviation: AVG() OVER (...)     <- fine on 4.0.2
/* avg_*/*_deviation: AVG() OVER (...) */  <- 6.x: syntax error at or near "*"
        ^ comment ends HERE
```

The migration itself succeeds. The **charts** break afterwards, which is why
this has to be checked deliberately.

Only `*/` inside a `--` line comment is a bug. A normal `/* ... */` block
comment also contains `*/` and is perfectly fine — do not "fix" those.

## 1. Detect

Shows the offending line and labels it. Only `LINE-COMMENT (BUG)` rows matter.

```sql
SELECT t.id,
       t.table_name,
       ln.lineno,
       CASE WHEN ltrim(ln.line) LIKE '--%' THEN 'LINE-COMMENT (BUG)'
            ELSE 'block/other (OK)' END AS kind,
       left(ltrim(ln.line), 80) AS line
FROM tables t,
     LATERAL unnest(string_to_array(t.sql, chr(10))) WITH ORDINALITY AS ln(line, lineno)
WHERE t.sql LIKE '%*/%'
  AND ln.line LIKE '%*/%'
ORDER BY t.id, ln.lineno;
```

No rows, or only `block/other (OK)` rows → nothing to do, skip to step 4.

## 2. Widen the sweep (optional)

`*/` can also hide in saved metrics, calculated columns and chart params. Rare,
but free to check:

```sql
SELECT 'dataset SQL'  AS place, id       AS obj_id, table_name  AS name FROM tables        WHERE sql        LIKE '%*/%'
UNION ALL
SELECT 'saved metric' AS place, table_id AS obj_id, metric_name AS name FROM sql_metrics   WHERE expression LIKE '%*/%'
UNION ALL
SELECT 'calc column'  AS place, table_id AS obj_id, column_name AS name FROM table_columns WHERE expression LIKE '%*/%'
UNION ALL
SELECT 'chart params' AS place, id       AS obj_id, slice_name  AS name FROM slices        WHERE params     LIKE '%*/%'
ORDER BY 1, 2;
```

This one is deliberately broad, so read each hit before changing it.

## 3. Fix

Scoped to the line-comment form, so `UPDATE n` reports how many rows genuinely
changed. Adjust the wording if yours differs from `avg_*/*_deviation`.

```sql
UPDATE tables
   SET sql = replace(sql, 'avg_*/*_deviation', 'avg_* and *_deviation')
 WHERE sql LIKE '%-- avg_*/*_deviation%';
```

Then re-run step 1 — it must come back with no `LINE-COMMENT (BUG)` rows.

Do **not** use `WHERE position('*/' in sql) > 0`: it matches every legitimate
block comment too, so `UPDATE n` reports rows it never actually changed.

## 4. Read-only sanity checks

```sql
SELECT version_num AS alembic_head FROM alembic_version;

SELECT (SELECT count(*) FROM dashboards) AS dashboards,
       (SELECT count(*) FROM slices)     AS charts,
       (SELECT count(*) FROM tables)     AS datasets,
       (SELECT count(*) FROM dbs)        AS databases;
```

6.1.0 target head is `4b2a8c9d3e1f`.

Legacy viz types that are removed or one-way-migrated in 5.0/6.x:

```sql
SELECT viz_type, count(*) AS charts
FROM slices
WHERE viz_type IN ('event_flow','sankey','sankey_loop','filter_box','iframe',
                   'markup','para','directed_force','heatmap','horizon',
                   'partition','rose','chord')
GROUP BY viz_type
ORDER BY charts DESC;
```

## What SQL cannot do

`superset db upgrade` and `superset init` are **not** expressible as SQL — they
run alembic migrations and re-sync the role/permission tables. Use
`local-setup/migrate-to-6.1.0.sh` (or the runbook in
`local-setup/PROD-MIGRATION-RUNBOOK.md`) for those. This file only covers the
data-level checks and fixes you can do from a SQL client.

Also: none of this replaces opening the actual dashboards after a migration.
The `*/` bug produced a clean migration and broken charts — only a human
clicking through caught it.

# Local Environment Evidence

## 1. Metadata

- Project: StartupManageSystem
- Evidence type: local Docker dependency environment
- Date: 2026-06-03
- Owner: Codex
- Scope: local Postgres only

## 2. Isolation Design

| Control | Value | Reason |
| --- | --- | --- |
| Compose project | `startupmanage_local` | Avoids generic `local` project conflict |
| Database service | `postgres` | Single local dependency service |
| Image | `postgres:16-alpine` | Stable Postgres major version, small image |
| Host port | `55432` | Avoids local native Postgres `5432` and WorkControl Docker Postgres `65433` |
| Container port | `5432` | Standard Postgres internal port |
| Network | `startupmanage_local_net` | Dedicated project network |
| Volume | `startupmanage_local_pgdata` | Dedicated project data volume |
| Database | `startupmanage_local` | Dedicated database name |
| User | `startupmanage_app` | Dedicated local user |

## 3. Preflight Conflict Checks

Observed existing local environment before creation:

- Native local Postgres listening on `127.0.0.1:5432`.
- WorkControl Docker Compose project named `local`.
- WorkControl Docker Postgres listening on host port `65433`.
- WorkControl Docker Redis listening on host port `65380`.
- Other occupied ports included `5000`, `7000`, `3401`, and `5201`.

Chosen port `55432` was not listening during preflight.

## 4. Verification Commands

```bash
scripts/local/db-config.sh
scripts/local/db-up.sh
scripts/local/db-status.sh
scripts/local/db-psql.sh -c 'SELECT current_database(), current_user;'
lsof -nP -iTCP:55432 -sTCP:LISTEN
```

## 5. Verification Result

| Check | Result | Evidence |
| --- | --- | --- |
| Compose config renders | pass | `docker compose config` resolved project `startupmanage_local` and port `55432:5432` |
| Container starts | pass | `startupmanage_local-postgres-1` created and started |
| Container health | pass | `docker compose ps` showed `Up ... (healthy)` |
| Host port listening | pass | `lsof -nP -iTCP:55432 -sTCP:LISTEN` showed Docker listening on `*:55432` |
| Network created | pass | `docker network ls` showed `startupmanage_local_net` |
| Volume created | pass | `docker volume ls` showed `startupmanage_local_pgdata` |
| Postgres readiness | pass | `pg_isready` returned `accepting connections` |
| Database/user sanity | pass | `SELECT current_database(), current_user;` returned `startupmanage_local` and `startupmanage_app` |
| Helper scripts exist | pass | `scripts/local/db-config.sh`, `db-up.sh`, `db-status.sh`, `db-psql.sh`, `db-logs.sh`, `db-down.sh` |
| Helper script syntax | pass | `bash -n` passed for all `scripts/local/db-*.sh` scripts |
| Helper script runtime | pass | `db-config.sh`, `db-up.sh`, `db-status.sh`, `db-psql.sh`, and `db-logs.sh` ran successfully |

## 5.1 Script Verification Notes

`db-down.sh` syntax was verified, but runtime stop behavior was not executed during this pass to keep the healthy local database running.

## 6. Evidence Boundary

This evidence covers local dependency isolation only.

It does not prove application implementation, database schema, migrations, backup/recovery, CI/CD, staging, production, or release readiness.

# Local Environment Evidence

## 1. Metadata

- Project: StartupManageSystem
- Evidence type: local container dependency environment
- Date: 2026-06-03 (Docker Compose, sections 2–5.1); 2026-11-11 (moved to napbox, section 7)
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
| Helper script runtime | pass | `db-config.sh`, `db-up.sh`, `db-status.sh`, `db-psql.sh`, `db-logs.sh`, and `db-down.sh` ran successfully |

## 5.1 Script Verification Notes

`db-down.sh` was exercised by stopping the local Postgres container without removing the data volume. `db-up.sh`, `db-status.sh`, and `db-psql.sh` were then run to confirm the database returned to healthy status with the expected database and user.

## 6. Evidence Boundary

This evidence covers local dependency isolation only.

It does not prove application implementation, database schema, migrations, backup/recovery, CI/CD, staging, production, or release readiness.

## 7. Runtime Change: Docker Compose To napbox (2026-11-11)

The local Postgres dependency moved from Docker Compose to napbox so that Docker can be uninstalled. Sections
2–5.1 above record the original Docker setup and are superseded for the current runtime.

| Change | Before | After |
| --- | --- | --- |
| Compose file | `docker-compose.yml` with project name, named network, and volume names | `compose.yaml`; napbox names the environment per git worktree |
| Host port | fixed `55432` | assigned by napbox, fixed per environment, read with `napbox env` |
| Isolation | dedicated network `startupmanage_local_net` and volume `startupmanage_local_pgdata` | one napbox environment (its own VM, volume `pgdata`, and port) per worktree |
| Overrides | `.env.local.example` (`SMS_POSTGRES_*`, `DATABASE_URL` on `55432`) | removed; local-only settings are fixed in `compose.yaml` |
| `db-config.sh` | `docker compose config` | removed; napbox validates `compose.yaml` on `up` and reports unsupported fields |
| `db-down.sh` | `docker compose stop postgres` | `napbox sleep`; data is kept and the next connection wakes it |

Data: the old Docker volume was not migrated. The project has no applied schema; the drills only create
temporary `period_close_drill_*` schemas and drop them, and the dry-run rolls back.

Verification (napbox 0.1.0, environment `startupmanagesystem/main`):

| Check | Result | Evidence |
| --- | --- | --- |
| Environment starts | pass | `scripts/local/db-up.sh` returned `state: running` with a napbox-assigned port for `postgres:5432` |
| Postgres readiness | pass | `scripts/local/db-status.sh`: `pg_isready` returned `accepting connections` |
| Database/user sanity | pass | `db-psql.sh -c 'SELECT current_database(), current_user, version();'` returned `startupmanage_local`, `startupmanage_app`, PostgreSQL 16.15 |
| psql over stdin | pass | `echo 'SELECT 1;' \| scripts/local/db-psql.sh -v ON_ERROR_STOP=1` returned `1` |
| Logs | pass | `scripts/local/db-logs.sh` showed the startup log |
| Migration dry-run | pass | `corepack pnpm db:period-close:dry-run` printed `period_close_postgres_migration_dry_run_passed` then `ROLLBACK` |
| Isolated apply drill | pass | `corepack pnpm db:period-close:apply-drill` printed `period_close_postgres_apply_drill_passed` |
| Persisted replay drill | pass | `corepack pnpm db:period-close:replay-drill` printed `period_close_postgres_replay_drill_passed` |
| Row-lock concurrency drill | pass | `corepack pnpm db:period-close:concurrency-drill` printed `period_close_postgres_concurrency_lock_conflict_observed` (with `rg` on PATH; the script needs ripgrep installed) |
| Sleep and wake | pass | `scripts/local/db-down.sh` left the environment `sleeping`; the next `db-psql.sh` call woke it |
| Drill cleanup | pass | no `period_close_drill_*` schema left after the drills |

# Local Database Runbook

## 1. Scope

This runbook covers the local Postgres dependency for StartupManageSystem. It is defined in `compose.yaml` and
run by napbox: each git worktree gets its own isolated environment with its own data and host port. Docker is
not used.

It does not cover production, staging, migrations, backups, restores, or schema changes.

## 2. Isolation Summary

| Item | Value |
| --- | --- |
| Runtime | napbox (`napbox` on PATH) |
| Environment | `<repository folder>/<worktree>`; the main checkout is `startupmanagesystem/main` |
| Service | `postgres` |
| Image | `postgres:16-alpine` |
| Host port | assigned by napbox, fixed for the environment (`napbox env`, variable `NAPBOX_POSTGRES_5432`) |
| Container port | `5432` |
| Database | `startupmanage_local` |
| User | `startupmanage_app` |
| Volume | napbox named volume `pgdata`, per environment |

The host port stays the same across sleep, wake, repeated `up`, and napboxd restarts. Other worktrees get other
ports, so read it from `napbox env` instead of writing it down.

## 3. Commands

Run commands from anywhere inside the repository. Scripts resolve the repository root before calling napbox.

| Purpose | Command |
| --- | --- |
| Start or wake Postgres | `scripts/local/db-up.sh` |
| Check health and show the host port | `scripts/local/db-status.sh` |
| Run psql (stdin is forwarded, no interactive terminal) | `scripts/local/db-psql.sh` |
| Run one SQL command | `scripts/local/db-psql.sh -c 'SELECT current_database(), current_user;'` |
| Run period-close PostgreSQL migration dry-run | `corepack pnpm db:period-close:dry-run` |
| Run period-close PostgreSQL isolated apply drill | `corepack pnpm db:period-close:apply-drill` |
| Run period-close PostgreSQL persisted replay drill | `corepack pnpm db:period-close:replay-drill` |
| Run period-close PostgreSQL row-lock concurrency drill | `corepack pnpm db:period-close:concurrency-drill` |
| Show logs | `scripts/local/db-logs.sh` |
| Sleep Postgres without deleting data | `scripts/local/db-down.sh` |

The period-close commands do not touch the development database: each run starts its own throwaway napbox
Postgres (`napbox up --temp period-close-drill-<pid>`, defined by the same `compose.yaml`), runs psql inside it,
and deletes it with `napbox down --temp` when the script exits (see `scripts/local/temp-db.sh`).

An idle environment also goes to sleep by itself after 30 minutes. A sleeping environment wakes on the next
connection or `db-psql.sh` call.

## 4. Connection

Host tools use `127.0.0.1` and the port from `napbox env`:

```text
postgres://startupmanage_app:startupmanage_local_dev_only@127.0.0.1:<port>/startupmanage_local
```

Services in the same `compose.yaml` should use:

```text
postgres://startupmanage_app:startupmanage_local_dev_only@postgres:5432/startupmanage_local
```

## 5. Destructive Boundary

Do not delete local database data without explicit user approval.

The period-close isolated apply, replay, and concurrency drills run in a throwaway environment and may create
and drop only schemas named `period_close_drill_*` there. They must not drop tables, truncate rows,
delete rows, drop the `public` schema, or remove the data volume.

Commands such as these are destructive because they delete local database data:

```bash
napbox reset pgdata
napbox down
```

`napbox reset` and `napbox down` keep the old data for 7 days before deleting it, but they still remove it from
the running environment.

If local data cleanup is required later, record:

- reason
- affected environment and volume
- owner approval
- before/after evidence

## 6. Troubleshooting

If Postgres is not healthy:

1. Run `scripts/local/db-status.sh`.
2. Run `scripts/local/db-logs.sh`.
3. Run `napbox status --text` to check that napboxd is running.

If host tools cannot connect:

1. Use host `127.0.0.1`, not `postgres`.
2. Use the port from `napbox env`; it is not `5432`.
3. Confirm the database and user are `startupmanage_local` and `startupmanage_app`.

## 7. Evidence Boundary

This runbook and the scripts prove only that local dependency commands exist.
The period-close dry-run command executes generated DDL and schema assertions
inside a throwaway local PostgreSQL transaction and rolls back. The period-close isolated
apply drill commits generated DDL and fixture writes only inside a temporary
`period_close_drill_*` schema, verifies the local write path, and then drops
that isolated schema. The period-close row-lock concurrency drill runs two local
psql sessions against the same isolated schema to prove `FOR UPDATE` lock
conflict behavior, then verifies close update and closed-period source-guard
fixture behavior before cleanup. None of these commands are formal project
schema migration apply, real repository integration, application DB transaction
manager evidence, formal rollback/forward-fix, or production readiness evidence.

Readiness claims still require command output evidence in `docs/evidence/local-environment-evidence.md` or a later evidence record.

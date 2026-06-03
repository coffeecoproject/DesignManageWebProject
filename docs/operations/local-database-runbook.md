# Local Database Runbook

## 1. Scope

This runbook covers the local Docker Compose Postgres dependency for StartupManageSystem.

It does not cover production, staging, migrations, backups, restores, or schema changes.

## 2. Isolation Summary

| Item | Value |
| --- | --- |
| Compose project | `startupmanage_local` |
| Service | `postgres` |
| Container | `startupmanage_local-postgres-1` |
| Image | `postgres:16-alpine` |
| Host port | `55432` |
| Container port | `5432` |
| Database | `startupmanage_local` |
| User | `startupmanage_app` |
| Network | `startupmanage_local_net` |
| Volume | `startupmanage_local_pgdata` |

## 3. Commands

Run commands from anywhere inside the repository. Scripts resolve the repository root before calling Docker Compose.

| Purpose | Command |
| --- | --- |
| Render Compose config | `scripts/local/db-config.sh` |
| Start Postgres | `scripts/local/db-up.sh` |
| Check health | `scripts/local/db-status.sh` |
| Open psql | `scripts/local/db-psql.sh` |
| Run one SQL command | `scripts/local/db-psql.sh -c 'SELECT current_database(), current_user;'` |
| Show logs | `scripts/local/db-logs.sh` |
| Stop Postgres without deleting data | `scripts/local/db-down.sh` |

## 4. Connection

Host tools can use:

```text
postgres://startupmanage_app:startupmanage_local_dev_only@127.0.0.1:55432/startupmanage_local
```

Docker-networked services should use:

```text
postgres://startupmanage_app:startupmanage_local_dev_only@postgres:5432/startupmanage_local
```

## 5. Destructive Boundary

Do not remove the Docker volume without explicit user approval.

Commands such as these are destructive because they can delete local database data:

```bash
docker compose down -v
docker volume rm startupmanage_local_pgdata
```

If local data cleanup is required later, record:

- reason
- affected volume
- owner approval
- before/after evidence

## 6. Troubleshooting

If Postgres is not healthy:

1. Run `scripts/local/db-status.sh`.
2. Run `scripts/local/db-logs.sh`.
3. Confirm port `55432` is not occupied by another process.
4. Confirm Docker Desktop is running.

If host tools cannot connect:

1. Use host `127.0.0.1`, not `postgres`.
2. Use port `55432`, not `5432`.
3. Confirm the database and user are `startupmanage_local` and `startupmanage_app`.

## 7. Evidence Boundary

This runbook and the scripts prove only that local dependency commands exist.

Readiness claims still require command output evidence in `docs/evidence/local-environment-evidence.md` or a later evidence record.

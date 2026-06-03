# Engineering Bootstrap

## 1. Repository Layout

Current repository layout:

```text
/
  AGENTS.md
  README.md
  docker-compose.yml
  .editorconfig
  .env.local.example
  .gitignore
  scripts/local/
  docs/
```

Planned implementation layout is pending business and stack decisions.

## 2. Runtime And Package Manager

- Frontend runtime: TBD.
- Backend runtime: TBD.
- Package manager: TBD.
- Lockfile policy: planned gap.
- Runtime version pinning: planned gap.
- Git repository: initialized on branch `main`.
- Formatting baseline: `.editorconfig`.

## 3. Command Inventory

| Purpose | Command | Status | Evidence |
| --- | --- | --- | --- |
| install | TBD | planned_gap | No package manager selected. |
| local database config check | `scripts/local/db-config.sh` | ready_with_evidence | Validates local Compose configuration. |
| start local database | `scripts/local/db-up.sh` | ready_with_evidence | Starts isolated local Postgres. |
| inspect local database | `scripts/local/db-status.sh` | ready_with_evidence | Checks local Postgres health. |
| local database psql | `scripts/local/db-psql.sh` | ready_with_evidence | Connects to isolated local Postgres. |
| local database logs | `scripts/local/db-logs.sh` | ready_with_evidence | Shows local Postgres logs. |
| stop local database | `scripts/local/db-down.sh` | bootstrap_asset_only | Stops local Postgres without deleting volume. |
| dev frontend | TBD | planned_gap | Frontend not initialized. |
| dev API | TBD | planned_gap | Backend not initialized. |
| lint | TBD | planned_gap | Tooling not initialized. |
| format | TBD | planned_gap | Tooling not initialized. |
| typecheck | TBD | planned_gap | Tooling not initialized. |
| unit test | TBD | planned_gap | Tests not initialized. |
| E2E smoke | TBD | planned_gap | E2E not initialized. |
| build | TBD | planned_gap | Build not initialized. |

## 4. Local Startup Path

Local dependency startup:

```bash
scripts/local/db-up.sh
scripts/local/db-status.sh
```

Host connection string for local tools:

```text
postgres://startupmanage_app:startupmanage_local_dev_only@127.0.0.1:55432/startupmanage_local
```

Code startup is pending implementation initialization.

When implementation begins, this document must be updated with:

- exact dependency install command
- local environment file rules
- frontend startup command and URL
- backend/API startup command and URL
- local dependencies and health checks

## 5. Storage Path

File/object storage scope is TBD. No storage path has been selected.

Database storage is isolated in Docker volume `startupmanage_local_pgdata`.

## 6. Evidence Boundary

This document is a bootstrap record only. Real engineering readiness requires working commands and captured outputs.

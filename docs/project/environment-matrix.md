# Environment Matrix

## 1. Environment Inventory

| Environment | Purpose | Runtime units | Data source | Secrets source | Owner | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| local | Local development | Postgres dependency only | Docker Compose Postgres `startupmanage_local` | local only, no production secrets | TBD | ready_with_evidence | `docker-compose.yml`, `docs/evidence/local-environment-evidence.md` |
| dev | Shared development | TBD | TBD | TBD | TBD | planned_gap | Not implemented |
| preview | Branch/PR preview | TBD | TBD | TBD | TBD | planned_gap | Not implemented |
| test | Automated test | TBD | TBD | TBD | TBD | planned_gap | Not implemented |
| staging | Release validation | TBD | TBD | TBD | TBD | planned_gap | Not implemented |
| production | Production | TBD | TBD | TBD | TBD | planned_gap | Not approved |

## 2. Runtime Unit Deployment Matrix

| Runtime unit | Local mode | Remote mode | Containerized | Config source | Rollback/forward-fix path | ADR/exception | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| frontend | TBD | TBD | TBD | TBD | TBD | TBD | planned_gap |
| API | TBD | TBD | TBD | TBD | TBD | TBD | planned_gap |
| worker/scheduler/consumer/cron | TBD | TBD | TBD | TBD | TBD | TBD | planned_gap |

## 3. Local Dependency Runtime

- Database: Docker Compose Postgres `postgres:16-alpine`, host `127.0.0.1:55432`, database `startupmanage_local`, user `startupmanage_app`.
- Cache: TBD.
- Queue: TBD.
- Object storage: TBD.
- Search: TBD.
- Email: TBD.
- Mock services: TBD.
- Docker or compatible container runtime: Docker Desktop available; local Compose file configured for Postgres.

## 4. Production Boundary

No production environment, production secrets, or production deployment is configured or approved during bootstrap.

# StartupManageSystem

## 1. Purpose

- Product purpose: multi-customer, multi-brand design-service operations management, task delivery, personnel settlement, and operating-finance visibility; current business scope is draft-confirmed in `docs/requirements/0002-business-modules-draft.md`.
- Web project type: admin console / internal management tool.
- Default scope: `Web frontend + Backend/API/Database/Storage + Auth + Infrastructure + CI/CD + Release/Operations/Recovery/Governance`
- Out of scope unless explicitly added: native mobile apps, desktop app, browser extension, unrelated backend platform, production deployment.

## 2. Entry Points

- Codex working agreement: `AGENTS.md`
- Project definition: `docs/project/project-definition.md`
- Bootstrap plan: `docs/project/bootstrap-plan.md`
- Project workflow: `docs/governance/project-workflow.md`
- Gate register: `docs/governance/gate-register.md`
- Bootstrap output traceability: `docs/governance/bootstrap-output-traceability.md`
- Readiness checklist status: `docs/governance/readiness-checklist-status.md`
- Governance review: `docs/governance/governance-review.md`
- Governance close-out: `docs/governance/governance-close-out.md`
- Pre-business readiness close-out: `docs/governance/pre-business-readiness-close-out.md`
- Engineering bootstrap: `docs/project/engineering-bootstrap.md`
- Environment matrix: `docs/project/environment-matrix.md`
- Infrastructure/platform: `docs/project/infrastructure-platform.md`
- Code structure: `docs/project/code-structure.md`
- Requirements: `docs/requirements/`
- ADRs: `docs/adr/`
- Route/page inventory: `docs/web/route-page-inventory.md`
- API contracts: `docs/api/`
- Data contracts: `docs/data/`
- Security and permission: `docs/security/`
- Privacy and compliance: `docs/privacy/`
- Testing: `docs/testing/`
- Performance and capacity: `docs/testing/performance-capacity.md`
- Release: `docs/release/`
- Incident records: `docs/incident/`
- Operations: `docs/operations/`
- Local database runbook: `docs/operations/local-database-runbook.md`
- Recovery: `docs/recovery/`
- Dependency governance: `docs/governance/dependency-admission.md`
- CI/CD quality gates: `docs/governance/cicd-quality-gates.md`
- Evidence records: `docs/evidence/`
- Audit reports: `docs/audit-reports/`
- Governance: `docs/governance/`

These entry points mirror `/Users/liushan/Developer/CodingFlow/for-web-industrial-baseline/codex-web-project-bootstrap-kit/bootstrap-output-map.md`. If an output is not generated during bootstrap, this README must mark it as `pending/gap` instead of silently omitting it.

## 3. Local Startup

- Web frontend: initialized at `apps/web` with Vite + React + TypeScript + Ant Design Pro-style shell.
- Backend API: planned gap, not initialized.
- Backend runtime units: TBD.
- Local dependency services: Postgres from `compose.yaml`, run by napbox (one isolated environment per git worktree).
- Container runtime: napbox (`napbox` on PATH); Docker is not used.
- Database: local Postgres, database `startupmanage_local`; the host port is assigned by napbox, read it with `napbox env`.
- Storage: TBD.
- Cache: TBD.
- Queue: TBD.
- Search: TBD.
- Email: TBD.
- Auth: TBD.

Frontend local run:

```bash
corepack pnpm install
corepack pnpm dev:web
```

`dev:web` runs `scripts/local/dev-web.sh`: it brings up this worktree's napbox environment, which owns the web
dev-server port, and prints the URL `http://<NAPBOX_HOSTNAME>:<NAPBOX_HOST_WEB>` (for example
`http://main--startupmanagesystem.localhost:<port>` in the main checkout). There is no fixed port; every worktree
gets its own hostname and port.

## 4. Core Commands

| Purpose | Command | Notes |
| --- | --- | --- |
| install | `corepack pnpm install` | Uses `pnpm@11.1.3` and `pnpm-lock.yaml`. |
| start local database | `scripts/local/db-up.sh` | Creates or wakes this worktree's napbox environment. |
| inspect local database | `scripts/local/db-status.sh` | Checks Postgres health. |
| open local psql | `scripts/local/db-psql.sh` | Opens psql against the isolated local database. |
| local database logs | `scripts/local/db-logs.sh` | Shows recent Postgres logs. |
| sleep local database | `scripts/local/db-sleep.sh` | Puts the environment to sleep; data is kept and the next connection wakes it. |
| period-close PostgreSQL drills | `corepack pnpm db:period-close:dry-run` (also `apply-drill`, `replay-drill`, `concurrency-drill`) | Each run uses its own throwaway napbox Postgres (`napbox up --temp`), not the development database. |
| start frontend | `corepack pnpm dev:web` | Serves on this worktree's napbox port; prints the URL. |
| start API | TBD | Backend runtime not initialized. |
| lint | `corepack pnpm lint` | Frontend ESLint gate. |
| format | TBD | Planned gap. |
| typecheck | `corepack pnpm typecheck` | Frontend TypeScript gate. |
| test | TBD | Planned gap. |
| E2E smoke | TBD | Planned gap. |
| build | `corepack pnpm build:web` | Frontend production build gate. |
| migration apply/check | TBD | Database scope pending. |
| storage local check | TBD | Storage scope pending. |
| start workers/jobs | TBD | Runtime units pending. |
| queue/cache/search/email local check | TBD | Integration scope pending. |
| evidence capture | TBD | Evidence process documented under `docs/evidence/`. |

## 5. Evidence Boundary

This README is an entry point, not implementation evidence.

Production, release, security, privacy, recovery, and operational readiness require project-specific evidence recorded under `docs/`.

Audit reports and post-baseline review evidence should be recorded under `docs/audit-reports/` or the project-approved equivalent path.

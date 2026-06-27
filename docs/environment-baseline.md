# Environment Baseline

## Human Summary

StartupManageSystem is a governed Web internal-admin project. Local frontend commands are confirmed from `package.json`; backend, production, CI/CD, monitoring, rollback, and secret ownership remain pending confirmation unless separately evidenced.

Project: StartupManageSystem

Detected profile candidates: `web-app`, `internal-admin`

Recommended baseline level: `BL1`

This file records environment facts, unknowns, and explicit non-applicable items. It must not invent staging, production, rollback, monitoring, or release processes.

## Status

Baseline status: DRAFT

Human decision status: PENDING_CONFIRMATION

Owner: PENDING_CONFIRMATION

Last reviewed: 2026-06-28

## Scope

Applies to:

- Local Web frontend development and verification
- Project workflow and governance checks
- Future backend/API/database/storage/auth planning as pending scope

Does not apply to:

- Native iOS, native Android, desktop app, browser extension, or unrelated backend systems unless explicitly added

## Local Development

Runtime: Node.js via Corepack / pnpm, exact project-wide Node version PENDING_CONFIRMATION

Package manager: `pnpm@11.1.3` from `package.json`

Install command: `corepack pnpm install`

Dev command: `corepack pnpm dev:web`

Local test command: `corepack pnpm test:web`

Known local dependencies:

- Vite React web app under `apps/web`
- Frontend mock/session data
- Docker/containerized external dependencies required when backend/database/storage are introduced, per `AGENTS.md`

## Runtime Versions

| Runtime | Version | Source | Status |
|---|---|---|---|
| Node.js | PENDING_CONFIRMATION | local shell / future `.nvmrc` or toolchain doc | PENDING_CONFIRMATION |
| pnpm | `11.1.3` | root `package.json` `packageManager` | CONFIRMED |
| Vite/React/TypeScript | package-managed | `apps/web/package.json`, lockfile | CONFIRMED_FOR_FRONTEND |

## Package Manager And Lockfile

Package manager: `pnpm`

Lockfile: `pnpm-lock.yaml`

Policy: use Corepack and keep lockfile changes reviewable.

Codex may change dependencies: Human approval required for new runtime dependencies or dependency upgrades with security/build/release impact.

## Environment Variables

| Name | Required? | Environment | Owner | Secret? | Source | Status |
|---|---|---|---|---|---|---|
| PENDING_CONFIRMATION | PENDING_CONFIRMATION | local / preview / staging / production | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION |

Important rule:
Record variable names and ownership only. Never record secret values.

## Secret Boundary

Secret values must never be written into this file.

Secret storage: PENDING_CONFIRMATION

Who can access: PENDING_CONFIRMATION

Codex must not:

- create or edit `.env` files
- read or write secret values into workflow docs
- commit private keys, service account JSON, production credentials, or connection strings with embedded credentials

Rotation / incident owner: PENDING_CONFIRMATION

## External Services

| Service | Used for | Environment | Owner | Status |
|---|---|---|---|---|
| Backend/API | Future business persistence and authorization | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION |
| Database | Future data persistence | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION |
| Object storage | Future document/voucher/file storage | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION |
| Email/notification/OA/Feishu | Optional future integration | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION |
| Bank/tax systems | Optional future finance/tax integration | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION |

## Test Environment

Test command: `corepack pnpm test:web`

Typecheck command: `corepack pnpm typecheck`

Lint command: `corepack pnpm lint`

Build command: `corepack pnpm build:web`

AI Native workflow checks:

- `corepack pnpm ai-native:next`
- `corepack pnpm ai-native:baseline`
- `corepack pnpm ai-native:check`

Test data policy: frontend mock/session data only until backend integration.

Mock / real service policy: do not treat mock frontend data as production, audit, tax, accounting, payroll, or legal evidence.

CI test command: PENDING_CONFIRMATION

## Preview / Staging / Production

| Environment | Exists? | URL / Ref | Owner | Deploy command | Rollback path | Status |
|---|---|---|---|---|---|---|
| Preview | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION |
| Staging | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION |
| Production | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION | PENDING_CONFIRMATION |

## CI / CD

CI system: PENDING_CONFIRMATION

Required checks: local confirmed commands are `lint`, `typecheck`, `test:web`, `build:web`, and relevant workflow/document checks.

Build command: `corepack pnpm build:web`

Deploy command: PENDING_CONFIRMATION

Codex may modify CI: Human approval required

## Release Process

Release owner: PENDING_CONFIRMATION

Release checklist: `docs/release/rollout-rollback-plan.md` exists, but real release ownership/evidence remains PENDING_CONFIRMATION.

Approval required: yes for any production or release-impacting action.

Evidence required: build/test results, release record, rollback plan, monitoring/recovery evidence, and accepted exceptions where relevant.

## Rollback Process

Rollback owner: PENDING_CONFIRMATION

Rollback command or process: PENDING_CONFIRMATION

Rollback evidence: `docs/release/rollout-rollback-plan.md` exists as planning evidence only until real release evidence is recorded.

Codex must stop when:

- rollback ownership is unknown
- production config is needed
- release approval is missing
- secret values or production credentials are needed

## Logs / Monitoring / Alerts

Logs: PENDING_CONFIRMATION

Metrics: PENDING_CONFIRMATION

Alerts: PENDING_CONFIRMATION

Incident owner: PENDING_CONFIRMATION

Evidence refs:

- `docs/operations/observability-signals.md`
- `docs/incident/runbook.md`
- `docs/incident/incident-record.md`

These are governance/planning assets unless backed by project-specific runtime evidence.

## Open Environment Decisions

| Decision | Options | Recommended | Owner | Status |
|---|---|---|---|---|
| Confirm Node.js version policy | `.nvmrc` / Volta / package manager only / human-run local version | Add explicit version policy before backend/CI hardening | human | PENDING_CONFIRMATION |
| Confirm CI provider and required checks | GitHub Actions / other / none yet | Do not claim CI readiness until evidence exists | human | PENDING_CONFIRMATION |
| Confirm release and rollback state | CONFIRMED / PENDING_CONFIRMATION / NOT_APPLICABLE | PENDING_CONFIRMATION | human | PENDING_CONFIRMATION |
| Confirm secret ownership | named owner / team / not applicable | PENDING_CONFIRMATION | human | PENDING_CONFIRMATION |

# Project Profile: StartupManageSystem

## Status

Draft status: CONFIRMED

Human decision status: CONFIRMED

Last reviewed: 2026-06-28

## Project Type

- Category: Web frontend + future Backend/API/Database/Storage + Auth + Operations/Governance
- Target platform(s): Web admin console
- Delivery model: Internal management tool / enterprise operations platform
- Expected lifecycle: Long-lived governed product with iterative business-module hardcuts

## Selected Profiles

- `web-app`
- `internal-admin`

## Profile Rationale

| Profile | Why it applies | Human confirmed |
|---|---|---|
| `web-app` | Vite React web frontend, route-based admin app, package scripts for web build/lint/typecheck/test | Yes |
| `internal-admin` | Internal enterprise management console with personnel, task, finance, salary, tax, permission, and governance modules | Yes |

## Purpose

StartupManageSystem is an enterprise operations management platform for internal business workflows such as personnel organization, customer/store/contracts, tasks, performance, salary/social insurance, finance, tax, and system configuration.

## Users / Actors

| Actor | Goal | Access needs | Risk notes |
|---|---|---|---|
| Internal operator | Handle daily operations and business records | Role-scoped management access | May touch personnel, finance, tax, salary, and task data |
| Finance / accounting operator | Review cash-flow, reconciliation, receivable/payable, voucher, tax, and salary-related finance data | Finance-scoped management access | Financial records require audit-grade boundaries before backend integration |
| HR / people operator | Maintain personnel, attendance, movements, positions, and employee records | People-scoped management access | Personnel and salary-related data is sensitive |
| Employee / reviewer | Use `我的工作` self-service and review workbench surfaces | Employee/reviewer scoped access | Frontend currently does not enforce backend authorization |
| System administrator | Maintain role, task, calendar, finance category, account, social-insurance, and tax policy configuration | Admin configuration access | Permission and configuration changes are high-risk |

## Success Criteria

- Business modules remain aligned with the current project route/page inventory and data contracts.
- Non-trivial changes include baseline preflight, gate classification, test/evidence updates, and close-out.
- Financial, payroll, personnel, permission, tax, release, recovery, and production-impacting changes stop for explicit decisions.
- AI Native workflow checks provide workflow-state visibility without weakening the Web industrial baseline.

## Non-goals

- Native iOS, native Android, desktop app, browser extension, and unrelated backend platforms unless explicitly added.
- Production deployment, production data migration, or secret handling without explicit approval.
- Full AI Native BL2 / industrial-pack activation by default.
- Replacing the existing Web industrial baseline or project AGENTS.md with generic templates.

## Data Sensitivity

- Public: none by default
- Internal: route/page inventory, business module docs, mock operational data
- Sensitive: personnel, salary, finance, tax, permission, customer/store/contract, and task workflow data
- Regulated: financial/accounting/tax-related records may require statutory/audit controls before backend integration
- Unknown: production environment, real secret inventory, real release ownership, real monitoring/alert ownership

## Default Task Level

L2

Rationale: most active work affects cross-module contracts, admin workflows, financial/personnel/tax data, route behavior, tests, or governance evidence. Purely local UI copy fixes may be L1 only after explicit classification.

## High-risk Boundaries

Stop before:

- production release or deployment
- production DNS/TLS/CDN/WAF/hosting/infrastructure changes
- production environment variables or secret changes
- production backend endpoint changes
- production feature-flag rollout
- auth/session/token/cookie policy changes with material impact
- database schema changes affecting production compatibility
- destructive migration or data cleanup
- production data access/export/migration/repair
- secret/token/certificate/private-key handling
- backup restore or disaster recovery operation
- security/privacy/release/recovery/production-risk exception acceptance
- payment, financial, health, identity, personnel, salary, tax, or regulated-data handling decisions

## Required Project Docs

- [x] `AGENTS.md`
- [x] `docs/project/project-definition.md`
- [x] `docs/project/code-structure.md`
- [x] `docs/project/environment-matrix.md`
- [x] `docs/web/route-page-inventory.md`
- [x] `docs/data/frontend-cross-module-contracts.md`
- [x] `docs/api/api-contract-placeholder.md`
- [x] `docs/testing/test-plan.md`
- [x] `docs/security/auth-permission-model.md`
- [x] `docs/release/rollout-rollback-plan.md`
- [x] `docs/recovery/recovery-drill-record.md`
- [x] `docs/evidence/frontend-baseline-evidence.md`
- [x] `docs/governance/ai-native-dev-kit-adoption-v1.md`
- [x] `docs/environment-baseline.md`

## Open Assumptions

| Assumption | Impact | Needs human confirmation |
|---|---|---|
| Backend/API/database implementation is planned but not yet production-ready | Determines API, migration, auth, and recovery gates | Yes |
| Current frontend mock data is not audit or production evidence | Prevents overclaiming release/accounting readiness | No |
| CI/CD and production deployment ownership remain pending | Blocks release-readiness claims | Yes |
| AI Native BL2 and industrial packs are not enabled by this migration | Prevents accidental stricter pack claims or unrelated platform scope | No |

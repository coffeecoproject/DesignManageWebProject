# Project Definition

## 1. Basic Information

- Project name: StartupManageSystem
- Owner: TBD
- Start date: 2026-06-03
- Repository: `/Users/liushan/Developer/StartupManageSystem`
- Upstream baseline: `/Users/liushan/Developer/CodingFlow/for-web-industrial-baseline`
- Project type: admin console / internal management tool

## 2. Product Purpose

- Problem to solve: multi-customer, multi-brand design-service operations management, task delivery, personnel settlement, and operating-finance visibility.
- Primary users: owner/executive, project or delivery manager, reviewer/design lead, finance/settlement operator, HR/admin, designer/executor, system admin.
- Admin or operations users: multi-role internal operations users.
- Business workflows: draft confirmed in `docs/requirements/0002-business-modules-draft.md`.
- Out of scope: native mobile apps, desktop app, browser extension, unrelated backend platform, production deployment until approved.

## 3. Web Surface

- Public routes: none planned for current admin console baseline.
- Authenticated routes: expected, but auth/session enforcement is not implemented yet.
- Admin routes: `/`, `/people`, `/people/overview`, `/people/roles`, `*`.
- SEO requirement: likely low for internal admin, pending confirmation.
- Accessibility requirement: baseline applies; target level TBD.
- Browser support: modern desktop browsers for local baseline; exact support matrix TBD.
- Responsive scope: desktop browser adaptive layout only; mobile-specific layout is not in scope yet.

## 4. Backend And Data Scope

- Backend/API responsibility: expected for customer/contract, store order, task, rule, personnel, quality, settlement, finance, reporting, permission, and audit workflows; final architecture pending.
- Backend runtime units (API/worker/scheduler/consumer/queue/cron): TBD.
- Runtime-unit ownership and execution boundary: TBD.
- Runtime-unit contract/data/storage impact: TBD.
- Runtime-unit remote deployment mode (container/non-container) by unit: TBD.
- Non-container equivalent controls and ADR reference where applicable: pending if non-container is selected.
- Database responsibility: expected for operating records, rule versions, tasks, settlement, finance, and audit data; concrete schema pending.
- Storage responsibility: expected for delivery files/evidence if file archive is implemented; storage provider pending.
- Auth responsibility: role and resource-scope authorization expected; provider/session model pending.
- Third-party integrations: TBD; possible external customer system import or Excel import remains undecided.
- Data sensitivity: personnel identity, bank card, contact, address, settlement, finance, contract, and customer business data are sensitive; detailed inventory pending.

## 5. Environment And Infrastructure

- Local: Docker Compose Postgres configured on `127.0.0.1:55432`; frontend dev server on `http://127.0.0.1:5173`.
- Dev: TBD.
- Preview: TBD.
- Test: TBD.
- Staging: TBD.
- Production: TBD; no production action approved.
- Hosting/platform: TBD.
- DNS/TLS/CDN/WAF: TBD; high-risk boundary.

## 6. Release And Operations

- Release model: TBD.
- Rollback model: TBD.
- Observability requirement: TBD.
- Incident response expectation: TBD.
- Backup/recovery expectation: TBD.

## 7. Initial Decisions

| Decision | Status | Owner | Evidence |
| --- | --- | --- | --- |
| Use Web industrial bootstrap kit | confirmed | user/Codex | User requested baseline first on 2026-06-03. |
| Project type is admin console / internal management tool | provisional | user/Codex | Derived from current discussion; confirm during business scoping. |
| Business scope | draft_confirmed | user/Codex | `docs/requirements/0002-business-modules-draft.md` |
| UI baseline style | accepted | user/Codex | `docs/adr/0002-ui-baseline-ant-design-pro.md` |
| Frontend framework | accepted_for_baseline | user/Codex | Vite + React + TypeScript in `apps/web`. |
| Frontend UI/navigation scope | accepted_for_baseline | user/Codex | Ant Design Pro-style shell with `人员组织` only; `docs/web/route-page-inventory.md`. |
| Backend/API/database/storage/auth | pending | user/Codex | Scope intentionally deferred. |
| Production infrastructure | pending | user | High-risk boundary; no production decision. |

## 8. Open Questions

| Question | Impact | Owner | Due date |
| --- | --- | --- | --- |
| What authentication/session provider should be used? | Security, privacy, route protection | user/Codex | TBD |
| What exact permission matrix is required by role and resource scope? | Security, privacy, task/settlement access | user/Codex | TBD |
| What environments are required initially? | Environment, CI/CD, release | user | TBD |

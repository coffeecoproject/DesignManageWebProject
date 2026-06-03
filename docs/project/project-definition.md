# Project Definition

## 1. Basic Information

- Project name: StartupManageSystem
- Owner: TBD
- Start date: 2026-06-03
- Repository: `/Users/liushan/Developer/StartupManageSystem`
- Upstream baseline: `/Users/liushan/Developer/CodingFlow/for-web-industrial-baseline`
- Project type: admin console / internal management tool

## 2. Product Purpose

- Problem to solve: TBD after business discussion.
- Primary users: TBD.
- Admin or operations users: TBD.
- Business workflows: TBD.
- Out of scope: native mobile apps, desktop app, browser extension, unrelated backend platform, production deployment until approved.

## 3. Web Surface

- Public routes: TBD.
- Authenticated routes: TBD.
- Admin routes: TBD.
- SEO requirement: likely low for internal admin, pending confirmation.
- Accessibility requirement: baseline applies; target level TBD.
- Browser support: TBD.
- Responsive scope: TBD.

## 4. Backend And Data Scope

- Backend/API responsibility: TBD.
- Backend runtime units (API/worker/scheduler/consumer/queue/cron): TBD.
- Runtime-unit ownership and execution boundary: TBD.
- Runtime-unit contract/data/storage impact: TBD.
- Runtime-unit remote deployment mode (container/non-container) by unit: TBD.
- Non-container equivalent controls and ADR reference where applicable: pending if non-container is selected.
- Database responsibility: TBD.
- Storage responsibility: TBD.
- Auth responsibility: TBD.
- Third-party integrations: TBD.
- Data sensitivity: TBD.

## 5. Environment And Infrastructure

- Local: Docker Compose Postgres configured on `127.0.0.1:55432`; app runtime pending.
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
| Business scope | pending | user | User said business will be discussed later. |
| Frontend framework | pending | user/Codex | No framework selected during baseline bootstrap. |
| Backend/API/database/storage/auth | pending | user/Codex | Scope intentionally deferred. |
| Production infrastructure | pending | user | High-risk boundary; no production decision. |

## 8. Open Questions

| Question | Impact | Owner | Due date |
| --- | --- | --- | --- |
| What exact business workflows should the admin console cover? | Routes, data model, API, permissions, tests | user | TBD |
| Which frontend framework and package manager should be used? | Engineering, testing, CI/CD | user/Codex | TBD |
| Is backend/API in scope for the first prototype? | API/data/security/environment | user | TBD |
| What authentication and role model is required? | Security, privacy, route protection | user | TBD |
| What environments are required initially? | Environment, CI/CD, release | user | TBD |

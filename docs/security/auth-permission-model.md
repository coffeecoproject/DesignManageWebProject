# Security And Permission Model

## 1. Status

Status: `planned_gap`.

No authentication, authorization, session, token, cookie, tenant, resource-scope, or audit model has been selected.

## 2. Initial Assumptions

- The project is expected to be an admin console or internal management tool.
- Admin routes will likely require authentication.
- Role/resource scope is TBD.
- Sensitive data handling is TBD.

These are assumptions, not final decisions.

## 3. High-Risk Decisions

Codex must ask before:

- selecting auth provider or session/token strategy
- changing cookie/session/token policy with material impact
- implementing role/resource permissions
- handling secrets or production config
- accepting security exceptions

## 4. Required Future Evidence

- Auth model decision.
- Permission matrix.
- Backend authorization checks if backend exists.
- Route protection evidence.
- Audit/logging evidence.
- Security test evidence.

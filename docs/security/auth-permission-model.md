# Security And Permission Model

## 1. Status

Status: `draft_scope_identified`.

No authentication, authorization, session, token, cookie, tenant, resource-scope, or audit model has been selected.

## 2. Initial Assumptions

- The project is expected to be an admin console or internal management tool.
- Admin routes will likely require authentication.
- Current frontend prototype separates future account-level system roles from business roles. Account system roles are not rendered or edited in personnel overview, personnel archive, position management, task, customer, finance, or performance business surfaces.
- Future account system roles are expected to be `超级管理员`, `管理员`, and `普通人员`. They belong to the account/auth domain and must not be inferred from personnel archive or business position edits.
- `/system/roles` seeds six mock business roles as read-only default permission packages: `经营管理角色`, `财务角色`, `行政人事角色`, `设计执行角色`, `设计审核角色`, and `外协执行角色`. The current frontend prototype does not create business roles, edit role names/status, or add/remove default permission items from this page.
- `/people/position-permissions` binds positions to business roles and maintains position-level extra permissions. Effective position permissions in the frontend prototype equal enabled business-role default permissions plus position extra permissions. Changing a position's bound business roles updates the bound-position display on the business-role page; disabled business roles can remain visible in existing position bindings for governance review, but they do not contribute to effective position permissions.
- Personnel records currently carry one primary position. Multi-position inheritance is a deferred authorization-design item and must be resolved before backend permission implementation if a person can hold multiple positions.
- Personnel records contain business identity, relationship, position, task capability, salary/contract, file, and audit data, but do not carry account system roles.
- This shared frontend state is only prototype behavior and is not backend authorization, persistence, or audit evidence.
- Resource scopes are still expected around management role, customer, brand/project, store order, task, personnel self-access, settlement, finance, and system settings.
- Sensitive data handling is required for personnel identity, bank card, contact, address, settlement, finance, customer contract, and task evidence data.

These are assumptions, not final decisions.

## 3. High-Risk Decisions

Codex must ask before:

- selecting auth provider or session/token strategy
- changing cookie/session/token policy with material impact
- implementing role/resource permissions
- handling secrets or production config
- accepting security exceptions

## 3.1 Personnel Detail Sensitive Fields

Current frontend personnel archive detail is prototype-only and displays plaintext static mock identity/contact examples for review.

Before real values are implemented, the project must define:

- which roles may view full identity number, address, emergency contact, and settlement account data
- whether viewing requires secondary confirmation
- access audit fields, including actor, target person, reason, time, and source IP/device where applicable
- export/copy/print restrictions for sensitive personnel data
- backend authorization checks; hiding fields in the frontend is not sufficient

## 4. Required Future Evidence

- Auth model decision.
- Account management and account-system-role decision.
- Permission matrix.
- Sensitive-data access log policy.
- Backend authorization checks if backend exists.
- Route protection evidence.
- Audit/logging evidence.
- Security test evidence.

# Code Structure

## 1. Current Structure

Current foundation assets:

```text
AGENTS.md
README.md
docker-compose.yml
.editorconfig
.env.local.example
.gitignore
scripts/local/
docs/
```

## 2. Planned Implementation Structure

Implementation structure is pending stack and business decisions.

Potential future directories must be confirmed before creation:

- `apps/web`
- `services/api`
- `packages/*`
- `infra/*`
- `scripts/*`

Existing `scripts/local/` scope:

- Local dependency helpers only.
- No destructive cleanup script.
- Scripts must resolve the repository root before invoking Docker Compose.

## 3. Structure Rules

- Do not introduce framework-specific directories before stack decision.
- Route/page changes must update `docs/web/route-page-inventory.md`.
- API or DTO changes must update `docs/api/`.
- Data model changes must update `docs/data/`.
- Security/permission changes must update `docs/security/`.
- Test-impacting changes must update `docs/testing/test-plan.md`.

## 4. Dependency Direction

Dependency direction is TBD until stack and module layout are confirmed.

## 5. Evidence Boundary

This file defines structure governance only. It does not prove code structure readiness.

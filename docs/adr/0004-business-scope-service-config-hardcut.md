# ADR 0004: Business Scope And Service Configuration Hard Cut

Date: `2026-06-13`

Status: `accepted_for_frontend_baseline`

## Context

The current frontend prototype temporarily introduced three related concepts:

- `人员组织 / 业务范围`
- `岗位管理 / 默认业务范围`
- `客户管理 / 服务配置`

These concepts made the prototype too early-coupled across people, position, customer, brand, store, task type, delivery standard, and future task acceptance rules. The current project has not yet finalized the customer-task lifecycle or backend resource-scope authorization model, so keeping these surfaces would create misleading business meaning.

## Decision

Perform a no-compat frontend hard cut.

## Target State

- `人员组织` keeps `人员总览`, `人员档案`, `人事异动`, `岗位管理`, `考勤假勤`, and `考勤月报`.
- `岗位管理` manages position definition, bound business roles, position extra permissions, effective-permission preview, position files, associated people, status, and update time.
- `岗位管理` does not configure brand, region, store, task, or service scope.
- `业务范围` is removed as a routed personnel submodule.
- `客户管理` keeps `客户档案`, `品牌管理`, and `门店管理`.
- `客户管理` stores customer, brand, and store master data only in this frontend baseline.
- `客户管理` does not show task range, service region, service configuration, delivery standard, acceptance standard, SLA, or task-rule copy.
- Task type, delivery standard, acceptance standard, customer-specific rules, and SLA belong to later task/rule modules after the task lifecycle is confirmed.

## In Scope

- Remove `/people/business-scope` from router and sidebar.
- Remove the `PeopleBusinessScopePage` active import and route usage.
- Remove business-scope state from `PeopleOrganizationState`.
- Remove `BusinessScopeControls` and `businessScopeModel` from active source.
- Remove `默认业务范围` column and drawer tab from `PeoplePositionManagementPage`.
- Remove business-scope related permission items from the frontend business-role permission catalog.
- Remove `/customers/service-config` route and sidebar entry.
- Remove `ServiceConfigPage` from active source.
- Remove `ServiceConfigRecord`, service-config mock data, service-config status helpers, and task-range fields from customer mock data where they are only supporting service/scope concepts.
- Remove customer/brand/store task-range and service-region columns, filters, tabs, and detail fields.
- Sync route inventory, code structure, test plan, frontend evidence, and this ADR.

## Out Of Scope

- No backend/API/database/storage changes.
- No production release, CI/CD, or deployment changes.
- No real auth/resource-scope enforcement.
- No task lifecycle, task creation, task acceptance, pricing, settlement, or customer-specific rule module.
- No customer file upload/storage workflow.

## Compatibility Stance

`no-compat hardcut`.

Removed routes should fall through to the normal not-found route unless a later product decision adds an explicit redirect.

## Affected Paths

- `apps/web/src/app/router.tsx`
- `apps/web/src/app/shell.tsx`
- `apps/web/src/features/people/PeopleOrganizationState.tsx`
- `apps/web/src/features/people/PeoplePositionManagementPage.tsx`
- `apps/web/src/features/people/rolePermissionModel.ts`
- `apps/web/src/features/people/PeopleBusinessScopePage.tsx`
- `apps/web/src/features/people/BusinessScopeControls.tsx`
- `apps/web/src/features/people/businessScopeModel.ts`
- `apps/web/src/features/customers/*`
- `docs/web/route-page-inventory.md`
- `docs/project/code-structure.md`
- `docs/testing/test-plan.md`
- `docs/evidence/frontend-baseline-evidence.md`

## Verification Plan

- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm build:web`
- `git diff --check`
- Browser smoke:
  - `/people/position-permissions` renders without `默认业务范围`.
  - `/people/business-scope` no longer renders the removed business-scope page.
  - `/customers/archives`, `/customers/brands`, and `/customers/stores` render.
  - `/customers/service-config` no longer renders the removed service-configuration page.
  - Sidebars contain no `业务范围` or `服务配置`.
  - No body horizontal overflow and no page warn/error logs.

## Stop Conditions

- Any requirement to preserve the removed routes.
- Any request to implement real backend resource scope, task rules, delivery standards, or customer-specific SLA in this same cut.
- Any API/database/auth/production change.

## Governance Note

The industrial hardcut skill references AiCoffeeCo-specific workflow documents that do not exist in this project. This project uses `AGENTS.md`, `docs/governance/gate-register.md`, `docs/web/route-page-inventory.md`, and this ADR as the hardcut governance source for this frontend baseline task.

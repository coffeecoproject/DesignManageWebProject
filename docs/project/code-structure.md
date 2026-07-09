# Code Structure

## 1. Current Structure

Current foundation and frontend assets:

```text
AGENTS.md
README.md
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
docker-compose.yml
.editorconfig
.env.local.example
.gitignore
apps/
  api/
    package.json
    tsconfig.json
    src/
      finance/
        periodCloseContract.ts
        periodCloseContract.test.ts
        periodCloseRoutes.ts
        periodCloseRoutes.test.ts
        periodCloseSourceMutationGuard.ts
        periodCloseSourceMutationGuard.test.ts
        periodCloseSourceMutationRoutes.ts
        periodCloseSourceMutationRoutes.test.ts
  web/
    index.html
    package.json
    vite.config.ts
    tsconfig.json
    eslint.config.js
    src/
      main.tsx
      app/
        RootApp.tsx
        router.tsx
        shell.tsx
      features/
        my-work/
        people/
        customers/
        tasks/
        performance/
        finance/
        system/
      components/
      styles/
        global.css
scripts/local/
docs/
```

## 2. Implemented Boundaries

| Boundary | Status | Notes |
| --- | --- | --- |
| `apps/api` | contract_skeleton | Local TypeScript API/domain contract skeleton. It currently contains executable finance period-close contract rules, a framework-agnostic route adapter for backend-owned `close-checks`, `close`, and exceptional `reopen`, a framework-agnostic source mutation guard adapter, and a local source-mutation route adapter catalog for closed-period direct API-style rejection. It is not yet a listening HTTP backend, database-backed service, migration, auth boundary, real source API service integration, or production API. |
| `apps/web` | implemented_baseline | Vite React admin frontend baseline. |
| `apps/web/src/app` | implemented_baseline | Root app, router, and custom Ant Design admin shell. |
| `apps/web/src/components` | implemented_baseline | Shared workbench/detail primitives: `ManagementTable`, `ManagementPageScaffold`, `MetricGrid`/`MetricCard`, `FilterControls`, `DetailTabs`, `DetailSection`/`DetailInfoGrid`/`DetailDrawerTitle`/`StatusTag`, `RelatedFileTable`, `FileSlot`/`FileSlotGrid`/`FileRequirementPanel`, and `FileUploadDropzone`. These components own repeated structure and interaction styling; feature pages pass structured data/callbacks instead of composing component internals. |
| `apps/web/src/features/my-work` | implemented_baseline | Employee-facing read-only aggregation pages for `工作概览`, `我的任务`, `我的档案`, `我的薪资`, and `我的绩效`; `myWorkModel.ts` owns current-employee slicing for task rows, archive summary, salary reports, and task-performance scoring sources, while `MyWorkShared.tsx` resolves provider-backed customer/brand/store/task/performance/salary display data. No create/edit/submit/accept/confirm actions are exposed here. |
| `apps/web/src/features/people` | implemented_baseline | Static personnel/organization pages only. Personnel workbench pages are split by route into `PeopleOverviewPage.tsx`, `PeopleArchivesPage.tsx`, `PeopleMovementPage.tsx`, `PeoplePositionManagementPage.tsx`, `PeopleAttendancePage.tsx`, `PeopleAttendanceMonthlyPage.tsx`, and `PeopleRolesPage.tsx`; `PeoplePositionManagementPage.tsx` remains personnel-organization business master data rather than system configuration and owns position business-role bindings, position extra permissions, and effective-permission preview; `PeopleRolesPage.tsx` renders the system-side read-only `业务角色` default permission package view; `peopleDomain.ts` owns backend-ready frontend domain selectors and commands for personnel status, archive summary, attendance availability, movement effects, work-calendar display, task-access derivation, and position member counts; `peopleExpiryModel.ts` owns personnel lifecycle-expiry derivation that is consumed by `PeopleOverviewPage.tsx` as risk/reminder data instead of a standalone module; `peopleAttendanceMonthlyDomain.ts` owns payroll-attendance monthly report derivation from default workdays, attendance exceptions, monthly adjustments, confirmations, and salary-settlement locks; `peopleRepository.ts` is the mock-backed repository adapter boundary; `PeopleOrganizationState.tsx` owns active-session personnel/position/movement/attendance/monthly-adjustment/monthly-settlement-lock linkage for the prototype; `PermissionRoleState.tsx` owns active-session business-role package state and bound-position synchronization; `peopleFileSlotModel.ts` holds feature-local shared file-slot rules. |
| `apps/web/src/features/customers` | implemented_baseline | Static customer-management pages for `客户档案`, `品牌管理`, `门店管理`, and lightweight `合同管理`; `customerData.ts` holds frontend mock customer/brand/store/contract records and `CustomerShared.tsx` holds feature-local customer UI helpers. |
| `apps/web/src/features/tasks` | implemented_baseline | Static task-management pages for `任务列表`, `人员任务`, `任务提交`, `任务验收`, and `甲方反馈`; `TaskManagementState.tsx` owns active-session task rows and task-file records; `taskDisplayModel.ts`, `taskAcceptanceModel.ts`, `taskFileModel.ts`, and `taskOperationModel.ts` own shared frontend task display, acceptance/scoring, file-record, and operation-record rules; `features/tasks/components/*` owns task-specific reusable UI wrappers such as `TaskStatusTag`, `TaskScheduleCell`, `TaskDetailTable`, `TaskFilesSection`, and `TaskOperationSection`; `TaskAssignmentCandidateSelect.tsx` and `taskAssignmentCandidates.ts` own frontend-only assignment candidate rules that combine task capability, active task count, comprehensive performance score, attendance/leave exceptions, and work-calendar availability; `personTaskViewModel.ts` owns personnel-centric task aggregation, excludes closed tasks from current-task detail rows, and keeps current-month completed tasks only as executor-side summary counts. |
| `apps/web/src/features/performance` | implemented_baseline | Static performance management pages for `绩效看板`, `绩效规则`, `绩效签署`, and `绩效明细`; no backend rule engine, payroll execution, or settlement ledger. |
| `apps/web/src/features/finance` | implemented_baseline | Static finance-management pages for transaction registration/review, fund handling, public account, and bank reconciliation; no real payment, accounting, banking, or audit-grade finance backend. |
| `apps/web/src/features/system` | implemented_baseline | Static system-configuration pages for read-only business roles, task configuration, work calendars, finance categories, public-account configuration, social-insurance/housing-fund configuration, and tax policy; shared frontend-session providers expose configuration rows to feature pages without backend persistence. |
| `scripts/local` | implemented_baseline | Local Docker Postgres helper scripts. |
| `docs` | implemented_baseline | Governance, requirements, route, UI, test, and evidence docs. |
| `services/api` | not_created | Separate deployed backend/API service pending business and architecture decisions. Current `apps/api` is only a local contract/domain skeleton. |
| `packages/*` | not_created | Shared packages pending need. |
| `infra/*` | not_created | Remote infrastructure pending explicit production/dev environment decision. |

## 3. Structure Rules

- Do not add new business route groups until the user confirms module scope.
- Route/page changes must update `docs/web/route-page-inventory.md`.
- UI baseline changes must update `docs/web/design-system-scope.md`.
- Dependency changes must update `docs/governance/dependency-admission.md`.
- API or DTO changes must update `docs/api/`.
- Data model changes must update `docs/data/`.
- Security/permission changes must update `docs/security/`.
- Test-impacting changes must update `docs/testing/test-plan.md`.

## 4. Dependency Direction

Current frontend dependency direction:

```text
main.tsx -> RootApp -> router -> shell/pages
app/shell.tsx -> route outlet + navigation model
features/my-work/* -> Ant Design primitives + shared components + PeopleOrganizationProvider + TaskManagementProvider + CustomerManagementProvider + TaskConfigProvider + PerformanceRuleProvider + SalaryMonthlyReportBuilder read-only aggregation; feature pages must not own create/edit workflow state
features/people/* -> Ant Design primitives + shared components + peopleDomain and peopleAttendanceMonthlyDomain selectors/commands + PeopleOrganizationProvider + peopleRepository mock adapter; page components must not directly import raw personnel mock data
features/customers/* -> Ant Design primitives + shared components + CustomerManagementProvider customer/brand/store/contract state
features/tasks/* -> Ant Design primitives + shared components + TaskManagementProvider + read-only customer/performance/system/personnel configuration providers
features/performance/* -> Ant Design primitives + shared components + local performance mock/provider state only
features/finance/* -> Ant Design primitives + shared components + finance mock/provider state only
features/system/* -> Ant Design primitives + shared components + feature-local configuration providers
```

Current rule: feature pages may depend on app-level route conventions and UI libraries. Shared components should be introduced only after stable cross-page reuse evidence. App shell must not import future business modules until they are admitted into navigation.

## 5. Evidence Boundary

This file records implemented structure and structure rules. It does not prove backend, auth, data, release, security, privacy, recovery, or operational readiness.

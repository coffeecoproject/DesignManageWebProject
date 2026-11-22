# Code Structure

## 1. Current Structure

Current foundation and frontend assets:

```text
AGENTS.md
README.md
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
compose.yaml
testpace.json                 # test commands and test-file rules (testpace)
.modwall/config.json          # module boundaries (modwall)
.testcraft/                   # test-writing checklist and provisional rules (testcraft)
apps/
  api/
    vitest.config.mjs
    src/
      modules/finance/        # the only API module: period close, ledger, statements, HTTP runtime contracts
      shared/                 # no business meaning (node:http type declarations)
      __tests__/              # test support
  web/
    vite.config.ts
    vitest.config.ts
    scripts/                  # hardcut source checks (a test file) and the acceptance-ID reporter, which checks
                              # coverage against executed results whenever the whole web suite runs
    src/
      main.tsx                # assembly
      app/                    # assembly: RootApp (providers), router, shell, moduleLinks (cross-module wiring)
      modules/<module>/       # one directory per business module; index.ts and pages.ts are its entries
      shared/                 # no business meaning: UI components, business clock, money/score formatting
      __tests__/              # test support and the cross-module business scenario test
scripts/
  local/                      # local Postgres helpers (napbox)
  testpace/                   # files/full commands for testpace
docs/
```

## 2. Implemented Boundaries

| Boundary | Status | Notes |
| --- | --- | --- |
| `apps/api` | contract_skeleton | Local TypeScript API/domain contract skeleton. It currently contains executable finance period-close contract rules, a framework-agnostic route adapter for backend-owned `close-checks`, `close`, and exceptional `reopen`, a framework-agnostic source mutation guard adapter, and a local source-mutation route adapter catalog for closed-period direct API-style rejection. It is not yet a listening HTTP backend, database-backed service, migration, auth boundary, real source API service integration, or production API. |
| `apps/web` | implemented_baseline | Vite React admin frontend baseline. |
| `apps/web/src/app` | implemented_baseline | Root app, router, and custom Ant Design admin shell. |
| `apps/web/src/shared/components` | implemented_baseline | Shared workbench/detail primitives: `ManagementTable`, `ManagementPageScaffold`, `MetricGrid`/`MetricCard`, `FilterControls`, `DetailTabs`, `DetailSection`/`DetailInfoGrid`/`DetailDrawerTitle`/`StatusTag`, `RelatedFileTable`, `FileSlot`/`FileSlotGrid`/`FileRequirementPanel`, and `FileUploadDropzone`. These components own repeated structure and interaction styling; feature pages pass structured data/callbacks instead of composing component internals. |
| `apps/web/src/modules/my-work` | implemented_baseline | Employee-facing aggregation and self-service pages for `工作概览`, `我的任务`, `我的档案`, `我的薪资`, and `我的绩效`; `myWorkModel.ts` owns current-employee slicing for task rows, archive summary, formal payslip reports, and task-performance scoring sources, while `MyWorkShared.tsx` resolves provider-backed customer/brand/store/task/performance/salary display data. `我的薪资` excludes management drafts, maps confirmed payslips to `待发放`, and exposes only frozen formal payslip, calculation-basis, and payment-lifecycle facts. `MyPerformancePage.tsx` reads current formal results from `PerformanceResultState` and allows the current employee to confirm or object without editing money; task submission, acceptance, expense and reimbursement-review writes remain owned by their dedicated pages. |
| `apps/web/src/modules/people` | implemented_baseline | Static personnel/organization pages only. Personnel workbench pages are split by route into `PeopleOverviewPage.tsx`, `PeopleArchivesPage.tsx`, `PeopleMovementPage.tsx`, `PeoplePositionManagementPage.tsx`, `PeopleAttendancePage.tsx`, `PeopleAttendanceMonthlyPage.tsx`, and `PeopleRolesPage.tsx`; `PeoplePositionManagementPage.tsx` remains personnel-organization business master data rather than system configuration and owns position business-role bindings, position extra permissions, and effective-permission preview; `PeopleRolesPage.tsx` renders the system-side read-only `业务角色` default permission package view; `peopleDomain.ts` owns backend-ready frontend domain selectors and commands for personnel status, archive summary, attendance availability, movement effects, work-calendar display, task-access derivation, and position member counts; `peopleExpiryModel.ts` owns personnel lifecycle-expiry derivation that is consumed by `PeopleOverviewPage.tsx` as risk/reminder data instead of a standalone module; `peopleAttendanceMonthlyDomain.ts` owns payroll-attendance monthly report derivation from default workdays, attendance exceptions, monthly adjustments, confirmations, and salary-settlement locks; `peopleRepository.ts` is the mock-backed repository adapter boundary; `PeopleOrganizationState.tsx` owns active-session personnel/position/movement/attendance/monthly-adjustment/monthly-settlement-lock linkage for the prototype; `PermissionRoleState.tsx` owns active-session business-role package state and bound-position synchronization; `peopleFileSlotModel.ts` holds feature-local shared file-slot rules. |
| `apps/web/src/modules/customers` | implemented_baseline | Static customer-management pages for `客户档案`, `品牌管理`, `门店管理`, and lightweight `合同管理`; `customerData.ts` holds frontend mock customer/brand/store/contract records and `CustomerShared.tsx` holds feature-local customer UI helpers. |
| `apps/web/src/modules/tasks` | implemented_baseline | Static task-management pages for `任务列表`, `人员任务`, `任务提交`, `任务验收`, and `甲方反馈`; `TaskManagementState.tsx` owns active-session task rows and task-file records; `taskDisplayModel.ts`, `taskAcceptanceModel.ts`, `taskFileModel.ts`, and `taskOperationModel.ts` own shared frontend task display, acceptance/scoring, file-record, and operation-record rules; `modules/tasks/components/*` owns task-specific reusable UI wrappers such as `TaskStatusTag`, `TaskScheduleCell`, `TaskDetailTable`, `TaskFilesSection`, and `TaskOperationSection`; `TaskAssignmentCandidateSelect.tsx` and `taskAssignmentCandidates.ts` own frontend-only assignment candidate rules that combine task capability, active task count, comprehensive performance score, attendance/leave exceptions, and work-calendar availability; `personTaskViewModel.ts` owns personnel-centric task aggregation, excludes closed tasks from current-task detail rows, and keeps current-month completed tasks only as executor-side summary counts. |
| `apps/web/src/modules/performance` | implemented_baseline | Static performance management pages for `绩效看板`, `绩效规则`, `绩效签署`, and `绩效明细`; no backend rule engine, payroll execution, or settlement ledger. |
| `apps/web/src/modules/finance` | implemented_baseline | Static finance-management pages for transaction registration/review, fund handling, public account, and bank reconciliation; no real payment, accounting, banking, or audit-grade finance backend. |
| `apps/web/src/modules/{task-types,public-accounts,social-insurance}` | implemented_baseline | Former system-configuration area split by owner: task type configuration, public-account configuration, and social-insurance/housing-fund enrollment, contributions and policy configuration. Finance categories and tax policy live in `modules/finance`; work calendars and read-only business roles live in `modules/people`. |
| `apps/web/src/modules/{performance-rules,people-overview}` | implemented_baseline | Performance rules (rule presets, applicability, calculation; used by tasks) split from performance results; the personnel overview page aggregates people, finance, performance, salary and task data. |
| `scripts/local` | implemented_baseline | Local Postgres helper scripts (napbox). |
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

Module boundaries are enforced by modwall (`.modwall/config.json`, `modwall check`; also run first in `testpace full`). Other code reaches a module only through its entry (`index.ts`; `pages.ts` holds route pages for lazy loading), and modules must not form cycles. Current web module order (a module may use only modules to its left):

```text
task-types, public-accounts -> people -> customers -> performance-rules -> tasks -> performance -> social-insurance -> salary -> finance -> people-overview, my-work
```

Where a lower module needs data from a higher one, the lower module declares the shape it needs and `apps/web/src/app/moduleLinks.ts` wires the provider in (people ← salary, people archive ← social insurance, customer contracts ← finance receipts, brand management ← task contract usage, tasks ← latest published performance, social insurance ← finance postings, payroll ← finance).

## 5. Evidence Boundary

This file records implemented structure and structure rules. It does not prove backend, auth, data, release, security, privacy, recovery, or operational readiness.

## 6. Task Customer Receivable Extension

- `modules/customers/brandTaskPricingModel.ts` owns versioned brand settlement policies, versioned task prices, and contract eligibility.
- `CustomerManagementState.tsx` owns settlement-policy and price-version session state.
- `modules/tasks/taskCustomerBillingModel.ts` owns hidden task billing snapshots, acceptance facts, settlement batches, contract caps, and month-close grouping.
- `TaskManagementState.tsx` resolves snapshots at task creation and owns billing facts together with task acceptance state.
- `modules/finance/financeCustomerTaskSettlementModel.ts` adapts task batches into source-owned receivables and creates separate later-period adjustment receivables for late monthly facts.
- `FinanceManagementState.tsx` merges task receivables without overwriting existing settlement, invoice, or voucher lifecycle state.
- No task-settlement route or page is added. Brand pricing is edited only in brand management; task UI does not display customer money; downstream handling stays in existing finance pages.

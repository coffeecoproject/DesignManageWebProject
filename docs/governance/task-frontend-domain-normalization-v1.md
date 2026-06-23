# Task Frontend Domain Normalization V1

## 1. Scope

This structural remediation normalizes the task frontend before backend integration.

In scope:

- Extract shared task display, file, and operation-record models under `apps/web/src/features/tasks`.
- Extract task acceptance/scoring/rework validation rules under `apps/web/src/features/tasks/taskAcceptanceModel.ts`.
- Reuse task-specific components for status tags, schedule cells, file sections, operation sections, and task detail tables.
- Refactor `任务列表`, `人员任务`, `任务提交`, `任务验收`, and `甲方反馈` to consume the shared task frontend model.
- Add unit coverage for task status/deadline, file record generation, and operation-record behavior.

Out of scope:

- Backend/API implementation.
- Database schema, migrations, persistence, or audit storage.
- Auth, permission enforcement, notification dispatch, capacity optimizer, or production scheduler.
- Feishu API integration, file permission sync, object storage, CAD parsing, or real file preview/download.
- Performance settlement, payroll execution, finance posting, or operating-loss booking.

## 2. Current Problem

Task pages were accumulating page-local versions of the same rules:

- Primary task status tone and calculated overdue/closed state.
- Task type and store-context lookup.
- Feishu file-link row construction.
- Uploaded screenshot file construction.
- Operation-record append behavior.
- Repeated task detail table columns in personnel/task views.
- Acceptance scoring, client-feedback draft, and rejection blocker rules mixed into the workflow page component.

Keeping these rules in pages made later backend/API integration brittle because the same business meaning could drift between task list, submit, acceptance, feedback, and personnel workload views.

## 3. Target State

The task frontend should follow this dependency direction:

```text
task page components
  -> task-specific shared components
  -> task frontend domain models
  -> current frontend providers / mock seed data
```

Page components still own page interaction state such as create drawer form values, selected task, active tabs, and validation messages. Shared task models own reusable task meaning.

## 4. Domain Boundary

The first normalized task layer owns:

- Task status tone.
- Closed-task and overdue derivation.
- Task deadline display state.
- Task type name lookup.
- Store display context.
- Keyword search text construction.
- Feishu file-link record generation for original and delivery files.
- Business-server screenshot record generation for client feedback and rejection screenshots.
- Operation-record creation and prepend/update behavior.
- Acceptance-scoring draft construction, quality-score completion checks, client-feedback readiness, rejection blockers, and task-performance scoring record construction.

The task layer does not own:

- Page layout, Ant Design form state, drawer state, or filter state.
- Candidate selection UI internals.
- Monthly performance settlement.
- Feishu link authorization, upload transport, or file retention.
- Backend task lifecycle persistence or audit guarantees.

## 5. Shared Components

Reusable task components introduced or normalized:

- `TaskStatusTag` and `TaskDeadlineStatus`
- `TaskScheduleCell`
- `TaskDetailTable`
- `TaskFilesSection`
- `TaskOperationSection`

These components wrap shared generic table/detail components but preserve task-specific wording and visual rules so page files do not re-create task-table or task-file presentation contracts.

## 6. Compatibility Stance

Compatibility stance: `frontend hardcut structural remediation`.

Old page-local helper functions are intentionally removed from task pages instead of kept as compatibility wrappers. Current behavior remains frontend-session prototype behavior and does not imply backend readiness.

## 7. Affected Paths

Expected code paths:

- `apps/web/src/features/tasks/taskDisplayModel.ts`
- `apps/web/src/features/tasks/taskAcceptanceModel.ts`
- `apps/web/src/features/tasks/taskFileModel.ts`
- `apps/web/src/features/tasks/taskOperationModel.ts`
- `apps/web/src/features/tasks/components/`
- `apps/web/src/features/tasks/StoreTasksPage.tsx`
- `apps/web/src/features/tasks/PeopleTasksPage.tsx`
- `apps/web/src/features/tasks/TaskWorkflowPages.tsx`
- `apps/web/src/features/tasks/TaskClientFeedbackPage.tsx`
- `apps/web/src/features/tasks/taskDomainModel.test.ts`
- `apps/web/scripts/run-unit-tests.mjs`

Expected docs:

- `docs/project/code-structure.md`
- `docs/web/route-page-inventory.md`
- `docs/testing/test-plan.md`
- `docs/evidence/frontend-baseline-evidence.md`
- this contract document

## 8. Stop Conditions

Stop and ask before:

- Adding or removing task submodules.
- Changing confirmed task lifecycle states.
- Introducing real API endpoints, DTOs, persistence claims, or storage claims.
- Integrating Feishu API or storing customer/task files in business-server storage.
- Moving finance, payroll, settlement, or performance-month logic into task pages.
- Changing candidate-rule hard/soft boundary beyond confirmed task capability and time availability rules.

## 9. Verification Plan

Required verification:

- `corepack pnpm --filter @startupmanage/web test`
- `corepack pnpm --filter @startupmanage/web typecheck`
- `corepack pnpm lint`
- `corepack pnpm build:web`
- `git diff --check`
- Browser smoke for `/tasks/list`, `/tasks/people`, `/tasks/submit`, `/tasks/acceptance`, and `/tasks/client-feedback`.

## 10. Governance Notes

The task module remains frontend-only prototype state. Shared task frontend models are allowed to make UI behavior consistent, but they are not API contracts, database contracts, permission gates, dispatch guarantees, file-storage guarantees, or production operational evidence.

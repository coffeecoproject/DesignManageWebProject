# Task Configuration And Brand Boundary Hard Cut V1

Date: `2026-07-24`

## Decision

The frontend uses four independent responsibilities:

1. `系统管理 / 任务配置` owns the global task-type library and delivery hints.
2. `客户管理 / 品牌管理` selects which enabled task types may be created for that brand and maintains task settlement configuration.
3. `绩效管理 / 绩效规则` owns employee or position performance calculation. It does not control brand task availability.
4. A created task freezes its task-definition snapshot. Historical task display does not read mutable task master data.

Delivery hints are informational. They do not validate submitted files and do not replace task acceptance rules.

## Frontend Contract

- A new task is allowed only when customer, brand, store, task type, executor, and acceptor are valid at the domain entry.
- The selected task type must be enabled globally and selected by the brand.
- The frozen task definition contains task type ID, code, name, category, delivery hints, and capture time.
- Renaming or stopping a task type affects future creation only.
- Removing a task type from a brand affects future creation only.
- Performance scoring resolves the applicable employee or position rule during acceptance and performance calculation.
- Existing task settlement, customer acceptance, receivable, part-time payable, and performance facts retain their existing snapshots.

## Acceptance Matrix

| ID | Scenario | Expected frontend result | Evidence |
| --- | --- | --- | --- |
| TCB-01 | Brand selects an enabled task type | Type appears in new-task options | `taskDomainModel.test.ts` |
| TCB-02 | Brand removes a task type | Type no longer appears for new tasks | `taskDomainModel.test.ts` |
| TCB-03 | Global task type is stopped | Type no longer appears for new tasks | `taskDomainModel.test.ts` |
| TCB-04 | Brand has no performance-rule binding | Brand task selection and creation availability remain independent | Type contract and `taskDomainModel.test.ts` |
| TCB-05 | Task type is renamed after task creation | Historical task keeps snapshot name | `taskDomainModel.test.ts` |
| TCB-06 | Delivery hints change after creation | Historical task keeps copied hints | `taskDomainModel.test.ts` |
| TCB-07 | Brand/type mismatch reaches domain create entry | Creation is rejected | `taskCreationEligibilityModel.ts` and `taskDomainModel.test.ts` |
| TCB-08 | Existing acceptance/performance/settlement flows run | Existing cross-domain tests remain green | `corepack pnpm test:web` |

## Boundaries

- Frontend only; no API, database, authorization backend, deployment, or production changes.
- No compatibility path for `BrandRecord.performanceRuleId` or `deliveryFileRequirements`.
- Backend integration must persist the same frozen snapshot and repeat brand/task authorization server-side.

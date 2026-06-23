# Frontend Cross-Module Data Contracts

Status: `frontend_prototype_contract`.

These contracts describe frontend-domain data boundaries before backend/API integration. They are not database schema, backend authorization, persistence, audit, or production API evidence.

## Payroll Attendance Monthly Contract

Owner: `人员组织 / 考勤月报`.

Consumer: `薪酬社保 / 薪酬明细`.

Code evidence:

- Type: `apps/web/src/features/people/peopleAttendanceSalaryContract.ts`
- Producer adapter: `toPayrollAttendanceMonthlyContract` in `apps/web/src/features/people/peopleAttendanceMonthlyDomain.ts`
- Consumer: `buildSalaryMonthlyReports` in `apps/web/src/features/salary/salaryDomain.ts`
- Unit evidence: `apps/web/src/features/people/peopleAttendanceMonthlyDomain.test.ts`, `apps/web/src/features/salary/salaryDomain.test.ts`

Contract version: `payroll-attendance-monthly-v1`.

### Field Shape

| Field | Required | Meaning |
| --- | --- | --- |
| `contractVersion` | yes | Contract version for frontend/back-end alignment. |
| `sourceModule` | yes | Fixed as `考勤月报`; salary does not own the attendance source. |
| `reportId` | yes | Source attendance monthly report id. |
| `memberId` | yes | Personnel id / work number used by salary. |
| `month` | yes | Payroll-attendance month, formatted as `YYYY-MM`. |
| `reportStatus` | yes | Attendance report confirmation status: `待确认` or `已确认`. |
| `salarySettlementStatus` | yes | Salary lock state propagated from salary settlement: `未结算` or `已结算`. |
| `expectedWorkdayDates` | yes | Effective workday dates after joining/leaving date, work calendar, and annual exceptions. |
| `expectedWorkHours` | yes | Expected work hours for this member in the month. |
| `payableAttendanceHours` | yes | Final payable attendance hours after deductions and manual attendance adjustments. |
| `payrollIncreaseHours` | yes | Payroll-attendance increase hours; current make-up work does not automatically populate this field. |
| `payrollDeductionHours` | yes | Total payroll-attendance deduction hours. |
| `payrollDeductionEntries` | yes | Date-scoped deduction entries used by salary to apply the salary rate valid on each deduction date. |
| `adjustmentHours` | yes | Signed manual attendance-adjustment hours. |
| `leaveHours` | yes | Leave hours summarized by attendance monthly. |
| `makeupWorkHours` | yes | Make-up work hours that create compensatory-rest credit. |
| `restHours` | yes | Compensatory-rest hours requested/recorded. |
| `restCoveredHours` | yes | Rest hours covered by available earlier make-up work credit. |
| `restUncoveredHours` | yes | Rest hours not covered by available credit; these must enter `payrollDeductionEntries`. |
| `restBalanceHours` | yes | Remaining make-up work credit after covering rest in chronological order. |

`payrollDeductionEntries` item shape:

| Field | Required | Meaning |
| --- | --- | --- |
| `dateText` | yes | Deduction date, formatted as `YYYY-MM-DD`. |
| `hours` | yes | Deduction hours on that date. |
| `recordId` | yes | Source attendance/leave record id. |
| `type` | yes | `请假` or `调休超额`. |

### Business Rules

- Salary must consume attendance deductions through `payrollDeductionEntries` when date-specific entries exist.
- Salary may fall back to `payrollDeductionHours` only for residual hours not represented by date-specific entries.
- Leave and uncovered compensatory rest are both salary deductions.
- Make-up work creates compensatory-rest credit; it does not automatically create salary increase.
- Compensatory rest can only consume already-existing make-up work credit in chronological order.
- Later make-up work does not retroactively cover earlier rest.
- Covered compensatory rest does not deduct salary.
- Uncovered compensatory rest must produce `payrollDeductionEntries` with type `调休超额`.
- The current contract does not support negative compensatory-rest balance or advance rest.

### UI Boundary

The contract intentionally excludes UI-only fields such as day-equivalent display values, drawer tab data, related attendance record arrays, confirmation note objects, and work-calendar display names. Pages can still render those fields from local frontend report models, but salary calculation must not depend on them.

## Performance Execution Contract

Owner: `绩效管理 / 绩效规则` and `绩效管理 / 绩效签署`.

Producer adapter: `绩效管理 / 绩效明细`.

Consumers: `绩效管理 / 绩效明细`, `绩效管理 / 绩效看板`, and `薪酬社保 / 薪酬明细`.

Code evidence:

- Type: `PerformanceExecutionContract` in `apps/web/src/features/performance/performanceTypes.ts`
- Resolver: `resolvePerformanceExecutionContract` in `apps/web/src/features/performance/performanceExecutionContract.ts`
- Producer adapter: `buildPerformanceMonthlyRecords` in `apps/web/src/features/performance/performanceMonthlyModel.ts`
- Consumers: `PerformanceMonthlyPage.tsx`, `PerformanceDashboardPage.tsx`, `salaryReportBuilder.ts`
- Unit evidence: `performanceMonthlyModel.test.ts`, `performanceDashboardModel.test.ts`

Contract version: `performance-execution-contract-v1`.

### Field Shape

| Field | Required | Meaning |
| --- | --- | --- |
| `workNo` | yes | Employee work number used to connect monthly result and signed-file archive. |
| `category` | yes | Performance category such as `绘图任务制`, `岗位职责考核`, or `项目奖金`. |
| `position` | yes | Position snapshot on the monthly result. |
| `ruleName` | yes | Rule name resolved from structured rule rows or signature rule options. |
| `ruleVersion` | yes | Rule version resolved for the monthly result. |
| `ruleSource` | yes | `结构化规则`, `签署规则选项`, or `未匹配`. |
| `ruleId` | no | Matched structured rule id or signature rule option id. |
| `applicablePositions` | yes | Position scope from the matched rule source. |
| `signedFileId` | no | Matched signed-file id. |
| `signedFileName` | no | Matched signed-file name. |
| `signedRuleName` | no | Rule name carried by the signed file. |
| `signedRuleVersion` | no | Rule version carried by the signed file. |
| `signedAt` | no | Signed-file date from the signature archive. |
| `status` | yes | `已匹配`, `缺少签署`, `签署版本不一致`, `岗位不适用`, `规则未发布`, or `规则未配置`. |
| `note` | yes | Compact explanation for the contract status. |

### Business Rules

- Monthly performance rows must carry an execution contract before they are rendered in `绩效明细`, aggregated in `绩效看板`, or consumed by `薪酬明细`.
- Contract matching uses stable frontend identifiers: `workNo + category + ruleVersion`, plus position applicability from the rule source.
- Structured `绩效规则` rows are preferred when available. Categories that are not yet fully structured, such as current `岗位职责考核` and `项目奖金` mock rows, may temporarily resolve their applicability from signature rule options.
- Historical signed files can satisfy historical monthly rows when the rule version matches. This keeps historical result ledgers readable before backend effective-date logic exists.
- `绩效看板` treats non-`已匹配` contract statuses as risk rows.
- `薪酬明细` consumes the adjusted monthly performance rows after this contract is attached. It must not read raw performance mock rows directly.

### UI Boundary

The execution contract is visible only as compact basis information in performance detail drawers and risk information in performance dashboard summaries. It does not expose full rule formula tables, signature-file maintenance actions, task process details, legal e-sign evidence, backend authorization, or payroll posting controls.

### Backend Integration Notes

Before backend integration, this frontend contract should become an API/data contract with immutable result snapshots. Backend should decide whether `executionContract`, `employmentScope`, and `prorationSummary` are stored as denormalized monthly result snapshots or rebuilt from versioned rule/signature sources. Production use must add authorization, audit logging, effective-date ordering, signature-file storage authorization, and persistence guarantees.

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

## Personal Income Tax Withholding Contract

### Ownership

- `/salary/personal-income-tax` owns resident wage-and-salary withholding profiles by `employeeNo + taxYear`.
- A profile owns personnel-reporting result, deduction-acquisition result, employment scenario, first-employment month, deduction-item effective periods, source evidence, and update dates. The statutory monthly basic deduction is owned by tax policy, not by the employee profile.
- Personnel identity facts remain owned by the personnel archive. Consumers may use the employee number and a masked identity number only.

### Salary Consumption

- `/salary/monthly` requires a resident profile with successful personnel reporting and acquired deduction information matching the salary year before a full-time row can enter salary-result validation. An acquired zero-deduction profile is ready; a missing or merely unknown result is not.
- Taxable salary income is current gross salary after attendance-related wage deductions and before after-tax recovery items.
- The cumulative withholding snapshot carries cumulative income, basic deduction, social-insurance/housing-fund deductions, special additional deductions, other lawful deductions, cumulative taxable income, rate, quick deduction, cumulative tax, and prior actual withholding.
- Current withholding equals cumulative tax minus prior actual withholding and cannot be negative. The next snapshot must roll forward actual withholding rather than overwrite it with recomputed cumulative tax.
- For a confirmed first-employment profile, the first payroll month may apply the cumulative basic deduction from January through that calendar month when no prior cumulative basic deduction exists.
- Salary confirmation validates the payroll result but does not advance cumulative withholding history. An immutable salary-payment record advances that history only after actual payment is recorded.
- A payment record keeps both `payrollMonth` and `taxPeriod`: `payrollMonth` owns salary attribution, while `taxPeriod` is derived from the actual payment date and owns withholding declaration attribution.

### Declaration Preparation And Tax Handling

- `/tax/declaration-preparation` automatically creates a monthly personal-income-tax preparation from immutable salary-payment records whose `taxPeriod` matches the declaration period. It exposes masked employee filing facts, current-period totals, cumulative withholding fields, source readiness, and one final `确认申报数据` action.
- Salary rows that are only calculated or confirmed remain in salary review and are excluded from filing totals until actual payment is recorded.
- Confirming stores the payment-source snapshot, summary, and employee rows. A later payment-source collection change returns the preparation to `准备中` unless it has already entered external tax handling.
- `/tax/handling` consumes only a confirmed preparation result and renders a compact handling basis. It does not repeat employee review or directly consume mutable salary rows.
- Official filing result, filing receipt, payment, correction, and annual comprehensive-income settlement remain owned by the external natural-person tax workflow and future backend integration.

### Validation Boundary

- Housing-loan-interest and housing-rent deductions cannot be active together for the same profile period.
- Profiles from a different tax year, non-resident profiles, missing profiles, unreported personnel, and deduction information that is pending acquisition or update cannot satisfy salary settlement readiness.
- The frontend stores deduction aggregates only. Family-member identity details and official declaration payloads are not part of this contract.

## Formal Payslip And Payment Lifecycle Contract

### Ownership

- `/salary/monthly` owns employee-month salary calculation, source readiness, confirmation, and the frozen formal payslip snapshot.
- Finance payment registration and review own the actual cash-flow fact. Salary does not mark a payslip as paid merely because payroll was confirmed.
- `/my-work/salary` is a current-employee read model. It does not own salary calculation, confirmation, payment registration, finance review, or reversal.

### Formal Snapshot

- A salary row in `结算中` or `待确认` remains a management draft and must not appear in `/my-work/salary`.
- Confirming a salary row freezes the salary totals, salary composition lines, settlement-source records, payroll number, performance-settlement references, and confirmation operation record.
- Later mutable attendance, statutory-deduction, performance, or salary-profile source changes must not rewrite that confirmed payslip. A correction must use the existing salary adjustment or reversal lifecycle instead of silently rebuilding the formal result.
- An `已确认` formal payslip is employee-facing `待发放`. Only a reviewed and posted salary-payment transaction changes it to employee-facing `已发放`.
- `workflow.payrollNo` is the sole formal wage-list identity. A management preview has no formal number, and UI consumers must not derive a second `SLIP-*` identifier.
- The current payslip is a structured wage list, not a generated file or archive object. It has no `已生成 / 已锁定 / 生成时间` file lifecycle and exposes no preview/download action until a persisted immutable file derivative exists.

### Payment And Reversal

- The payment transaction keeps the frozen payroll number as its salary identity while retaining the payable relationship required by finance settlement.
- Posting the transaction settles the linked employee net-pay payable and creates the salary payment fact. This payment fact, not the salary confirmation date, owns the personal-income-tax payment period.
- Reversing the posted salary-payment transaction removes the active payment fact, returns the salary workflow to `已确认`, and therefore returns the employee display to `待发放`.
- Reversal must preserve the frozen payslip, performance-settlement references, composition lines, source records, payroll number, and payment/reversal operation history.

### Employee UI Boundary

- `/my-work/salary` returns only the signed-in employee's `已确认` and `已发放` formal payslips, ordered by salary month descending.
- The employee list exposes `月份 / 发放状态 / 应发合计 / 扣减合计 / 绩效薪酬 / 实发工资`; it does not expose management readiness, internal aggregation status, source-module blockers, or finance posting controls.
- The read-only drawer uses `工资单 / 计薪依据 / 发放记录`. Employee-visible operation history is limited to formal confirmation, payment linkage, and payment reversal facts.
- The `工资单` tab exposes the payroll number, salary month, employee/work number/position, payment status, confirmation time, actual payment time, summary amounts, and frozen composition lines. It does not imply that a PDF, archive package, or downloadable file exists.
- Frontend filtering is not an authorization boundary. Backend integration must enforce current-user scope, persist immutable snapshots and idempotent payment relationships, and apply reversal atomically.

## Performance Rule Applicability Contract

Owner: `绩效管理 / 绩效规则`.

Producer adapter: `绩效管理 / 绩效明细`.

Consumers: `绩效管理 / 绩效明细`, `绩效管理 / 绩效看板`, and `薪酬社保 / 薪酬明细`.

Code evidence:

- Type: `PerformanceRuleApplicability` in `apps/web/src/features/performance/performanceTypes.ts`
- Resolver: `resolvePerformanceRuleApplicability` in `apps/web/src/features/performance/performanceRuleApplicabilityModel.ts`
- Producer adapter: `buildPerformanceMonthlyRecords` in `apps/web/src/features/performance/performanceMonthlyModel.ts`
- Consumers: `PerformanceMonthlyPage.tsx`, `PerformanceDashboardPage.tsx`, `salaryReportBuilder.ts`
- Unit evidence: `performanceRuleApplicabilityModel.test.ts`, `performanceMonthlyModel.test.ts`, `performanceDashboardModel.test.ts`

Contract version: `performance-rule-applicability-v2`.

### Field Shape

| Field | Required | Meaning |
| --- | --- | --- |
| `workNo` | yes | Employee work number used to resolve the personnel snapshot. |
| `category` | yes | Performance category. The current result generator only supports `绘图任务制`; other enum values are reserved and must not produce current results. |
| `position` | yes | Position snapshot on the monthly result. |
| `personnelType` | no | Personnel type used by the rule scope check. |
| `ruleName` | yes | Rule name resolved from structured rule rows. |
| `ruleVersion` | yes | Rule version resolved for the monthly result. |
| `ruleId` | no | Matched structured rule id. |
| `applicablePositions` | yes | Position scope from the matched rule source. |
| `effectiveStartAt` | no | Rule effective start date. |
| `effectiveEndAt` | no | Rule effective end date. |
| `status` | yes | `适用`, personnel/scope/effective-period failures, `规则未配置`, `规则冲突`, or `规则版本不一致`. |
| `note` | yes | Compact explanation for the contract status. |

### Business Rules

- Monthly performance rows must carry a rule-applicability result before they are rendered in `绩效明细`, aggregated in `绩效看板`, or consumed by `薪酬明细`.
- Applicability is resolved from `workNo + personnel type + position + category + performance month` against published, effective structured rule rows.
- A single applicable rule is required. No rule, multiple rules, an unpublished rule, an out-of-period rule, or a rule-version drift produces an explicit non-applicable status.
- Publishing a new rule version closes the previous effective period. Historical monthly rows continue to resolve against the version effective in their own month.
- Offline signed files are evidence archives only. Missing, archived, or replaced files never enable, disable, or change rule applicability.
- `绩效看板` treats non-`适用` applicability statuses as risk rows.
- `薪酬明细` consumes monthly performance rows after applicability is attached. It must not read raw performance mock rows directly.

### UI Boundary

Rule applicability is visible only as compact basis information in performance detail drawers and risk information in performance dashboard summaries. `签署档案` separately manages employee-uploaded offline signed files and does not expose online confirmation, legal e-sign, rule-enablement, task process, backend authorization, or payroll posting controls.

### Backend Integration Notes

Before backend integration, this frontend contract should become an API/data contract with immutable result snapshots. Backend should decide whether `ruleApplicability`, `employmentScope`, and `prorationSummary` are stored as denormalized monthly-result snapshots or rebuilt from versioned personnel and rule sources. Signed-file archive storage remains a separate evidence contract. Production use must add authorization, audit logging, effective-date ordering, file-storage authorization, and persistence guarantees.

## Task Acceptance To Monthly Performance Source Contract

Owner: `任务管理 / 任务验收` owns task completion and scoring facts. `绩效管理 / 绩效明细` owns monthly aggregation and calculation.

Producer adapter: `buildTaskPerformanceMonthlySourceRecords` in `apps/web/src/features/performance/taskPerformanceMonthlySourceModel.ts`.

Consumers: `绩效明细`, `绩效看板`, and the performance part of `薪酬明细`.

Contract version: `task-acceptance-performance-source-v1`.

### Stable Source Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `taskId` | yes | Unique accepted-task identity and deduplication key. |
| `acceptedAt` | yes | Acceptance fact time; its month owns the performance source period. |
| `employeeId` | yes | Executor work number from the accepted task snapshot. |
| `ruleId / ruleVersion` | yes | Published rule version resolved for the employee and source month. |
| `scoreItemId / scoreValue` | yes | Structured task score item and accepted score. |
| `qualityDimensionScores` | yes | Complete dimension-level scores; the weighted result is recalculated from the matched rule. |
| `sourceRecordIds` | yes | Immutable scoring-source identities attached to the monthly result. |

### Business Rules

- Only a completed task with `acceptedAt`, an `已计入` scoring row, a full-time salary-paid executor, and one applicable published drawing-task rule can become a source fact.
- `taskId` is the uniqueness key. If duplicate scoring rows exist, only the latest valid row is retained and the task is counted once.
- Unaccepted, rejected, cancelled, part-time, rule-version-mismatched, incomplete-quality, and unsupported-category rows are excluded rather than repaired with fallback data.
- Prepay ratio, below-baseline factor, quality weights, quality bands, and excess bands are structured rule fields. Calculation must not parse display text or use hidden coefficients.
- Task score remains the accepted business fact. For mid-month joining or leaving, only full score, baseline score, and base performance amount are prorated by actual workdays.
- Source months come from effective periods of published drawing-task rules through the current frontend business date. Therefore an applicable full-time employee receives a zero-task `0分 / 0元` monthly draft even when no task row exists for that month.
- `岗位职责考核` and `项目奖金` remain unavailable until a real source contract exists. They must not generate monthly rows, appear as enabled result tabs, or enter salary consumption.
- Offline signed files remain outside this contract and never participate in task-source eligibility or calculation.

### Frontend And Backend Boundary

The current implementation is a frontend-session domain adapter over task, people, rule, and work-calendar state. Backend integration must persist accepted-task scoring facts with idempotent task identities, immutable rule/source snapshots, server-owned acceptance timestamps, authorization, and audit evidence. It must not recreate old static monthly result rows or use the signed-file archive as a calculation gate.

## Performance Result Snapshot Contract

Owner: `PerformanceResultState` under `绩效管理 / 绩效明细`.

Producer adapter: `usePerformanceResults` over current monthly calculations, quarterly aggregation, and formal result state.

Current consumers: `绩效明细`, `绩效看板`, `人员总览`, `工作概览`, `我的绩效`, task-assignment and personnel-task summaries, and `薪酬明细`.

Contract version: `performance-result-snapshot-v3-frontend-session`.

### Identity And Version Rules

- One monthly result lineage is identified by `employee work number + performance month + performance category`, not by a mutable source-record ID or rule ID.
- One quarterly result lineage is identified by `employee work number + natural quarter + performance category`. Its expected months come from the actually applicable monthly read model; months before employment or rule applicability are not fabricated as missing.
- An unpublished result is a live draft. Source changes recompute that draft and its source hash without creating formal history.
- Publishing freezes the employee, position, rule, calculation, source IDs, source hash, amount, prepay, publisher, delivery time, feedback deadline, and work-calendar deadline snapshot.
- A quarterly draft can publish only after the quarter ends and every applicable month has a current published monthly result. Its calculated amount and prepay total come only from those monthly snapshots; a nonzero adjustment requires a reason and is frozen with optional evidence references.
- Quarterly results expose the quarter-end `salarySettlementMonth` and one quarterly-difference settlement reference. Performance does not own a free settlement date or payment date.
- Repeated publication is rejected. A published result is never overwritten in place.
- A monthly correction requires a changed current source and a reason. A quarterly correction may also correct a frozen quarterly manual adjustment even when monthly sources are unchanged. Both create the next version and keep prior versions in history. An unsettled prior version becomes `已更正`; a settled prior version remains frozen as `已结算` and records its successor.
- A changed monthly source can produce a monthly V2 and a recalculated quarterly V2. The quarterly correction is explicit and never silently overwrites a published or settled quarter.
- Current downstream consumers receive only the current `已发布 / 已结算` version. Drafts and corrected historical versions are excluded.

### Employee Feedback Rules

- `/my-work/performance` exposes only the current employee's current formal monthly and quarterly versions. It does not expose drafts or superseded history as actionable results.
- An employee may confirm or object only between delivery and the frozen three-working-day deadline. Confirmation records employee, time and version without changing money; objection accepts a required reason and optional evidence references, never an employee-entered amount.
- Pending results remain ineligible for performance-pay consumption during the feedback window. A confirmed result, a no-objection result after the deadline, or a management-resolved objection is eligible; an open objection is not.
- Management may close an objection by maintaining the current result with a resolution note, or by publishing a corrected version when the formal source has changed. This is result correction, not an approval workflow.
- These writes remain frontend-session state. Authorization, idempotency, delivery proof, evidence-file persistence, concurrency and backend audit storage remain future API responsibilities.

### Salary Consumption Rules

- Salary consumes only the current formal version after employee confirmation, after the frozen feedback deadline with no objection, or after an objection has been resolved. An active objection and a pending result still inside the feedback window are excluded.
- A monthly result contributes only its `prepayAmount`. A quarterly result contributes only its `quarterDifferenceAmount`; salary must not pay the quarterly final amount again.
- `salarySettlementReference` is the idempotency identity. One reference can be claimed by only one salary workflow.
- Salary confirmation changes only the referenced formal results from `已发布` to `已结算` and freezes an audit event. It does not settle unreferenced results.
- If V1 has already been claimed, V2 contributes only `V2 settlement amount - latest claimed prior-version settlement amount`.
- A confirmed or paid salary month is immutable. A later monthly or quarterly correction is moved to the next unlocked salary month while retaining the originally requested settlement month.

### Read-Only Consumer Rules

- Work overview, personnel overview, performance dashboard, task-assignment candidates, and personnel-task summaries read the latest current formal monthly result through the shared performance result consumer model.
- Drafts and superseded history never become current score summaries.
- An open-objection result remains visible in the performance risk summary, but is excluded from normal trend amounts, personnel averages, personnel-risk conclusions, and task-candidate score hints until the objection is resolved or a corrected version is published.
- Task assignment may use the formal performance score only as a soft ranking or warning signal. A low score does not make an otherwise eligible employee unavailable.
- Legacy `PeopleWorkEvaluationRecord` and `workEvaluationSummary / workEvaluationRecords` have been removed from the personnel contract and Mock data. Historical performance must come from formal performance-result versions; no dual-read compatibility is allowed.

### Current UI And Session Boundary

- `/performance/monthly` owns monthly and quarterly draft publication in one management ledger. Monthly and quarterly correction remain available only for changed sources. These actions are result freezing and delivery, not approval.
- `/performance/dashboard` and `/people/overview` are read-only consumers and do not recalculate or mutate formal results.
- No formal-result mock is pre-seeded. Before an in-session publication, management statistics and personnel performance summaries show no formal result rather than treating drafts as published data.
- Result writes persist only for the current frontend session. Route changes retain state; browser refresh restores the source-derived draft baseline.
- Quarterly generation, publication, delivery, employee confirmation/objection, salary consumption and later-difference allocation use the same result contract. Authorization, concurrency, cross-session idempotency, delivery proof and backend persistence remain outside this frontend phase.

## Finance Bank Reconciliation Contract

Owner: `财务管理 / 银行对账`.

Related frontend modules: `收支流水`, `流水复核`, `应收应付`, `费用与代收`.

Contract document: `docs/data/finance-bank-reconciliation-contract.md`.

Contract version: `finance-bank-reconciliation-contract-v1-draft`.

This contract hard-cuts bank reconciliation from a single system-flow match to a
relationship model. One bank statement can link to one `主流水` reviewed cash-flow
row plus `补差流水 / 冲正流水` detail rows. Amount differences are handled through
reviewed system adjustment rows; original reviewed cash-flow amounts are not
mutated by bank reconciliation.

Backend integration must persist an auditable relationship header plus
relationship detail rows. The frontend bank-statement `matchedTransactionIds`
array is only a lightweight candidate/read-model helper for page rendering; the
confirmed frontend session state uses `bankReconciliationRows.linkedTransactions`
to mirror the backend header/detail model.

## Finance VAT And Surcharge Accounting Contract

Owner: `申报准备 / 税务办理 / 会计凭证`.

Contract document: `docs/governance/vat-surcharge-accounting-hardcut-v1.md`.

Contract version: `finance-vat-surcharge-accounting-v1`.

- `FinanceVatTaxSettlementSnapshot` carries the confirmed VAT amount, VAT liability already recognized by source vouchers, the three surcharge components, and the combined payable amount.
- Tax handling creates only the surcharge accrual entry. It must not accrue VAT again after the source business voucher has recognized `2221.01`.
- A combined VAT payment transaction carries `FinanceTaxPaymentAllocation[]` for VAT, urban maintenance tax, education surcharge, and local education surcharge.
- Payment allocations must total the transaction amount. Missing or inconsistent allocations block the cash voucher instead of falling back to a combined tax subject.
- Multiple payments subtract prior active allocation details. A legacy linked payment without allocations blocks automatic remainder generation.
- Backend cutover must persist immutable settlement snapshots and payment-allocation rows with stable IDs, decimal precision, audit metadata, period guards, and booking idempotency.

## Tax Declaration Detail Snapshot Contract

Owner: `申报准备 / 税务办理`.

- `税务办理 / 申报明细` is a read-only projection of the preparation result confirmed before the matter entered tax handling.
- Personal income tax reads the confirmed employee declaration rows; VAT reads the confirmed unbilled taxable-income facts; corporate income tax reads the confirmed accounting-source summary; stamp duty reads the confirmed taxable-document sources.
- Later upstream changes must not silently rewrite an in-progress or completed tax matter. Corrections require a new preparation/correction flow and a new auditable snapshot.
- Backend integration must persist the confirmed summary and detail snapshot together with the tax matter, including stable source IDs, period, confirmation time, confirmer, and source snapshot key.

## Finance Funds Voucher Phase 1 Backend Contract

Owner: `财务管理 / 收支流水 / 流水复核 / 银行对账 / 会计凭证`.

Related frontend modules: `收支流水`, `流水复核`, `银行对账`, `会计凭证`.

Contract document:
`docs/data/finance-funds-voucher-phase1-backend-contract.md`.

Contract version: `finance-funds-voucher-phase1-backend-contract-v1-draft`.

This contract defines the first backend step for the funds-voucher line:
persisted system cash-flow rows, cash-flow evidence files, cash-flow review
events, imported bank statements, bank reconciliation relationship header/detail
rows, and read-only `资金凭证 / 调整凭证` candidate derivation.

Phase 1 does not create formal accounting vouchers, voucher numbers, general
ledger entries, or period-close state. The accounting-voucher page can consume
the read-only candidate API to show whether reviewed cash-flow rows are
`待生成`, `需处理`, or `待记账`; it must not treat candidate rows as official
accounting documents.

## Finance General Ledger Frontend Contract

Owner: `系统管理 / 账套初始化`, `财务管理 / 会计凭证 / 总账`.

Related frontend modules: `账套初始化`, `会计凭证`, `会计科目`, `应收应付`, `收支流水`,
`流水复核`, `银行对账`, `税务办理`.

Contract document: `docs/data/finance-accounting-voucher-ledger-contract.md`.

Contract version: `finance-general-ledger-frontend-contract-v1-draft`.

`总账` is a read-only result surface. It consumes ledger entries only after an
accounting voucher reaches `已记账`. Candidate rows, prepared-but-unbooked
vouchers, cash-flow review rows, bank statement rows, and invoice rows do not
directly affect subject balances. Original vouchers marked `已冲销` keep their
historical booked entries; the linked booked `冲销凭证` contributes opposite
entries that offset the original.

The current frontend model returns a period response with visible subject rows,
period-level metrics, period status, trial-balance status, and opening-balance
source. Subject/category/keyword filters can reduce visible table rows, but
they must not change period-level debit, credit, or trial-balance totals.
The model keeps signed balances for calculation and additionally resolves the
actual debit/credit balance side plus absolute display amount for opening,
ending, and running balances. UI should not display opposite-side balances as
negative amounts.

The main subject-balance page is scoped to one accounting month through
`当月 / 按月份`. Cross-period subject ledgers, annual balances, and financial
statements should be handled by later ledger-detail or statement surfaces rather
than overloading the main subject-balance table.

Opening balances are currently supplied by the frontend `系统管理 / 账套初始化`
workbench model for display only. The workbench exposes the initialization state machine
`未开始 / 基础设置完成 / 科目已确认 / 期初已录入 / 试算平衡 / 试算不平 / 已启用`,
workflow steps, operation records, enabled chart-of-accounts confirmation,
opening-balance rows, manual/import/system entry sources, import-batch preview,
trial-balance validation, and the enabled lock state. `/finance/general-ledger`
must consume opening balances only from an enabled, balanced, locked account-set
context in the current frontend prototype. Import preview application updates or
adds matching imported rows into the full opening-balance draft and must not drop
manual-entry or system-carried rows. Backend integration must provide account-set
profile records, persisted initialization workflow state, controlled opening-balance
rows from import/manual-entry/prior closed-period balances, import batch and
validation records, operator/time snapshots, trial-balance validation, enablement
lock state, and accounting-period status from `accounting_periods`.

Post-enablement opening adjustments are not opening-balance rewrites. The current
frontend session treats them as `账套初始化` source records for
`/finance/accounting-vouchers`; they become `调整凭证` candidates, enter the same
`记账` lifecycle as other vouchers, and affect `/finance/general-ledger`
only after booking. Until backend exposes an explicit contra-subject field or
mapping decision, the frontend prototype uses `3104 利润分配` as the opposite
entry for opening-adjustment vouchers.

## Finance Accounting Voucher Status Contract

Owner: `财务管理 / 会计凭证`.

Related frontend modules: `应收应付`, `收支流水`, `流水复核`, `银行对账`, `发票台账`, `税务办理`.

Contract version: `finance-accounting-voucher-status-v8`.

Tax policy source boundary:

- `apps/web/src/features/finance/financeTaxPolicyModel.ts` owns the current
  frontend tax-policy profile for tax-basis derivation. It is structured
  configuration for the prototype, not official filing evidence and not the
  future source of truth after backend cutover.
- Backend cutover must follow
  `docs/data/finance-tax-accounting-backend-contract.md`: versioned
  `tax_policy_profiles`, immutable `invoice_tax_facts`, confirmed
  `receivable_payable_tax_facts`, effective
  `finance_category_accounting_mappings`, and active `accounting_subjects`
  become the authoritative facts for tax-basis and accounting-subject
  derivation.
- Accounting subjects are system-maintained and business-side read-only.
  Business documents and employee self-service flows select business/finance
  categories only; they must not expose accounting-subject selection or mapping
  editing. Finance-category to accounting-subject mapping is finance/system
  configuration with effective-period and audit controls.
- `financeTaxBasisModel.ts`, `financeDeclarationPreparationData.ts`,
  `financeInvoiceAssociationModel.ts`, and `system/taxPolicyData.ts` consume this
  profile instead of keeping their own VAT rate, taxpayer type, input-treatment,
  exemption-threshold, or small-low-profit parameter copies.
- Imported invoice rows still carry their own invoice tax rate and tax amount as
  external invoice facts. The shared policy decides how those facts are used by
  accrual, declaration-preparation, and display logic; it does not overwrite an
  imported invoice.
- Final taxable/payable results still require official tax-handling result and
  receipt evidence before they can be treated as backend-grade tax facts.

The frontend voucher page is a statusized voucher-candidate result, not a posted
general-ledger record. Rows are derived from immutable frontend facts:

- confirmed and frontloaded-ready `应收应付` rows plus matched `发票台账`
  facts create `权责凭证` candidate rows;
- reviewed `收支流水` rows with a structured `银行对账` source link create
  `资金凭证` candidate rows; reviewed but unreconciled cash-flow rows stay as
  `待生成`;
- reviewed and bank-reconciled `流水冲正` and `流水补差` rows create `调整凭证`
  candidate rows; reviewed but unreconciled adjustment rows stay as `待生成`.
- unresolved red invoices in `发票台账` create `调整凭证` handling rows when the
  original blue invoice relation is missing.
- confirmed `税务办理` rows with a payable amount create `税费凭证` candidate
  rows. Tax matters that are confirmed but not completed stay as `待生成`; completed
  tax matters missing required declaration/payment receipts stay as `需处理`.
- registered tax payments create `税费缴纳` pending-review payment rows; registered
  tax refunds create `税费退还` pending-review receipt rows. Both retain the tax
  matter number and matching bank proof, and neither bypasses `流水复核 / 银行对账`.
- tax-handling completion records `declarationDate` as the actual filing date.
  Matters with a payable amount must also record `paymentDate` as the actual
  payment date; payment cash-flow occurrence and accounting period are derived
  from `paymentDate`, never from the receipt-upload timestamp. A zero or no-payable
  filing has no `paymentDate` and requires only the filing receipt.

Voucher status is hard-cut to `待生成`, `需处理`, `待记账`, `已记账`, and
`已冲销`. The current frontend generator emits `待记账` when the source facts can
produce balanced entries, and `需处理` when a non-accrual blocking issue is found. A
frontend-session lifecycle overlay freezes a voucher snapshot when `待记账` rows are
booked as `已记账`, and simulates reversal only after a user-confirmed
reversal date and reason by marking the original snapshot `已冲销` while adding
a linked booked `冲销凭证` snapshot with opposite entries. Before `已记账`, the page must use the source document number as the
primary visible identity and treat generated candidate identifiers as internal
derivation keys rather than formal voucher numbers. Backend readiness still
requires tax/accounting source facts, persisted vouchers, formal voucher
numbers, booking events, period locks, and general-ledger entries as defined in
`docs/data/finance-tax-accounting-backend-contract.md` and
`docs/data/finance-accounting-voucher-ledger-contract.md`.

`issueReasons` is the explicit blocking reason list. The first implemented
frontend checks are:

- missing or incomplete source document facts outside the frontloaded accrual path;
- missing original evidence such as cash-flow vouchers or tax receipts;
- missing accounting subject mapping outside the frontloaded accrual path;
- invalid amount;
- unbalanced debit and credit entries.
- tax basis pending on non-frontloaded voucher sources;
- output invoice tax missing when invoice-ledger tax is the selected basis, or invoice amount exceeding the confirmation amount;
- red invoice missing its original blue-invoice relation.
- reviewed cash-flow row still waiting for bank reconciliation;
- bank reconciliation amount mismatch or abnormal reconciliation state.
- confirmed tax matter still waiting for external handling completion;
- completed tax matter missing required tax declaration or payment receipt files.

For receivable accrual vouchers, resolved tax basis splits the confirmation
amount into revenue and output-tax lines. The debit remains the full receivable
amount. Fully matched normal output invoices are preferred as the tax basis.
If invoices are partial or not yet issued, the confirmed source tax basis on
the receivable/payable fact is used, and invoice evidence remains visible as
`发票部分匹配` or `发票待补` without blocking accrual generation. Only a missing
source tax basis or matched invoice tax fact keeps the receivable/payable row
outside the voucher queue until `应收应付` or the `发票台账` shared association supplies the missing fact.
Invoice amount exceeding the confirmation amount or unresolved red-invoice
relation also prevents the accrual row from entering the voucher queue.

For payable accrual vouchers, matched normal input invoices are retained as
cost evidence in `invoiceRefs`, but the current small-scale taxpayer baseline
does not generate a VAT input-deduction line. Input tax is therefore not posted
to `2221` in this frontend phase.

Rows expose `sourceRefs`, `taxBasis`, and `invoiceRefs` so the detail drawer can
show the source module, source number, selected tax-basis source, invoice
evidence status, invoice number, direction, status, declaration treatment,
tax-exclusive amount, tax amount, and tax-included amount without requiring
users to inspect internal mock-data fields.

Bank reconciliation is a prerequisite for frontend cash-voucher preparation in
this phase. A reviewed public-account cash-flow row with
`reconciliationStatus = 未对账` is rendered as `待生成` with
`bank_reconciliation_pending`; it is not counted as `待记账`. A row with
`reconciliationStatus = 对账异常` is rendered as `需处理` with
`bank_amount_mismatch`. Once bank reconciliation confirms the system cash-flow
row, `reconciliationStatus = 已对账` allows the cash voucher to become
`待记账` only when the shared finance state also contains a concrete
`bankReconciliationRows` relationship whose `linkedTransactions` contains that
system cash-flow row. That relationship is exposed in voucher `sourceRefs` as
`银行对账 / 银行依据`; if the row says `已对账` but the relationship detail is
missing, the voucher is `需处理` with
`bank_reconciliation_source_missing`.

Employee reimbursement and employee collection stay upstream-owned. When
`我的工作 / 费用报销审核` approves a reimbursement, it creates a source-generated
`应付` confirmation item for the approved business-expense amount; any amount
classified as taxable salary is transferred once into the employee's salary
adjustment source, and any employee-borne amount creates neither payable nor
salary. This is a single existing review action, not a new tax approval flow.
The review does not create a payment cash-flow row. When
`我的工作 / 费用与代收` submits a collection after transfer to a company account, it
creates a `待复核` cash-flow row with `relatedReceivableNo`. After `流水复核`
posts that row, `应收应付` settlement progress is written back through the
related receivable number.

Natural-person payments use one cross-module fact contract. Full-time monthly
and quarterly performance results enter salary and cannot create independent
performance payables or payments. Resident individual labor settlement stores
the agreement gross amount, deductible expense, taxable income, withheld IIT,
bank net payment, stable person id, settlement batch and source task numbers.
`应收应付` reserves and settles the gross amount, while `收支流水` records the
bank net amount. The cash voucher debits gross payable and credits bank net plus
`2221.03` withheld IIT. IIT preparation consumes posted salary and labor facts;
posted reversals remove the original fact, while an unmatched posted salary or
labor payment blocks confirmation instead of being silently omitted.

Tax matters are consumed as tax-accrual facts, not as payment facts. A confirmed
tax matter with `processStatus != 已完成` is rendered as `待生成` with
`tax_matter_pending`. A completed tax matter missing required `申报回执` or
`缴款回单` files is rendered as `需处理` with `tax_receipt_missing`. Completed tax
matters with required receipts can emit `税费凭证`; linked tax-payment
cash-flow rows still emit their own `资金凭证` after review and bank
reconciliation, so payment rows do not duplicate tax accrual.

Adjustment cash-flow rows must carry structured `adjustmentContext`:

| Field | Required | Meaning |
| --- | --- | --- |
| `mode` | yes | `冲正` or `补差`. |
| `originTransactionNo` | yes | Original reviewed cash-flow number. |
| `reason` | yes | Business reason for the adjustment. |
| `bankSerialNo` | no | Bank statement serial number when the adjustment is caused by bank reconciliation. |

Backend integration must persist vouchers separately before supporting booking,
period close, reversal, formal voucher numbers, and audit-grade accounting
evidence. Until then, frontend vouchers remain recalculable generation rows, but
they no longer use a generic `草稿` status. The frontend `bookAccountingVoucher`
mock currently simulates generation plus booking in one action and assigns a
mock formal voucher number. The backend contract separates candidate listing,
voucher generation, booking, reversal, period close, and general-ledger reads.
Voucher lifecycle actor/time fields are server-owned in backend integration:
prepared, booked, and reversed operator snapshots must resolve from the
authenticated account, and timestamps must use trusted server time. Frontend
clients must not submit or override those fields. The active voucher lifecycle
does not introduce a separate approval/review status; source readiness and issue
reasons remain the blocking model before preparation.

Backend integration must add a repository boundary before replacing the current
mock generator. Page components should consume backend candidate/persisted
voucher responses through a dedicated accounting-voucher repository, while
`buildAccountingVouchers` remains a mock-data fallback only. The expanded API
and data boundary is defined in
`docs/data/finance-accounting-voucher-ledger-contract.md`, including candidate
detail, batch generation/booking, source snapshots, invoice refs, idempotency
keys, accounting-period close checks, general-ledger entries, subject ledger,
and subject balances.

### Stamp-duty source and filing preparation

Stamp duty is sourced from signed taxable documents and capital-book increases;
it is not derived from receivable/payable, invoice, collection, payment, or
settlement status. Customer contracts expose business nature, tax display mode,
separately stated VAT, signed version, and supplemental-agreement delta facts.
Customer master data owns the counterparty taxpayer identification number.

`FinanceStampDutySourceRecord` is the shared source snapshot between contract
management, declaration preparation, and tax handling. The source identity is
`sourceId + sourceVersion`; a confirmed multi-tax-item split adds a stable
`allocationId` for each filing line. The internal `sourceNo` and optional
document-owned `documentNo` are separate identities. Tax item, taxable basis,
legal rate, six-tax/two-fee reduction, estimated payable amount, policy version,
and evidence files are frozen when declaration preparation is confirmed.

Uncertain business facts must not be classified by a default tax item. The
operator records one auditable `FinanceStampDutySourceResolution`: taxable,
non-taxable, or decrease offset; taxable and offset conclusions may allocate the
complete source basis across several legal tax items. The allocation sum must
equal the source basis. Resolution writes are guarded by the source obligation
period, not by the operator's action date.

Documents not owned by a current upstream module enter through per-document
`补录应税凭证`; the UI cannot input a tax rate or payable amount. Open-amount
documents first enter as `待后续结算` with zero taxable basis. Each later actual
settlement produces an independent next-filing-period event and never overwrites
the original execution fact. Capital-book stamp duty reads posted general-ledger
balances for `3001 实收资本` and `3002 资本公积`, and taxes only the increase over
the historical maximum basis already taxed. A missing historical basis blocks
calculation; a page-level fixed current capital balance is not a valid source.

Confirmed stamp-duty preparation is the only source for the stamp-duty tax
matter. Tax handling cannot edit item, basis, rate, reduction, or payable amount.
Completed tax handling emits the accrual entry `Dr 5403 / Cr 2221.05`; a reviewed
and reconciled tax-payment transaction emits `Dr 2221.05 / Cr 1002`. Neither step
creates a receivable/payable row.

### Task customer receivable contract

Customer task revenue uses three owners and one dependency direction:

```text
CustomerManagementState
  -> TaskManagementState
  -> FinanceManagementState
```

`CustomerManagementState` owns versioned brand settlement policy and versioned task prices.
A billable price version must point to a signed, effective contract owned by the
same customer. Updating a price closes the previous version and creates a new
version; updating an existing brand settlement policy schedules a new version
from the next month. Neither operation rewrites a task snapshot.

`TaskManagementState` resolves the active version when a task is created and
stores a hidden `TaskCustomerBillingSnapshot`. The snapshot freezes customer and
brand names, price version, unit price, contract identity/name/amount mode, and
settlement policy. Internal acceptance creates one deterministic
`CustomerTaskBillingFact` per task and one stable acceptance archive file with a
real file URL. The archive is frozen into the settlement line and reused as the
receivable source evidence; a label-only file without a URL is not acceptable
accounting evidence. Employee-facing task views must not render
the snapshot, customer price, contract, or receivable identity.

Internal acceptance is the unified customer-revenue trigger. It does not wait
for customer confirmation and does not introduce a second approval flow. A
part-time executor's labor-tax or identity data can block the employee labor
payable, but it cannot roll back the accepted task, customer billing fact, or
performance source.

Task facts derive either one per-task settlement batch or one closed-month batch
for the same customer, brand, contract, and accounting period. A non-billable
fact remains traceable but produces no batch. A late fact discovered after a
monthly receivable exists does not mutate that receivable; it creates an explicit
adjustment receivable in the later discovery period and retains the original
monthly receivable unchanged.

Fixed contract amount is a management observation, not a settlement gate.
`TaskManagementState` derives contract usage only from effective accepted
billable facts, marks usage at 80% as near the limit and usage at or above 100%
as exceeded, and exposes the summary only to the management-side brand detail.
It must not reserve in-progress task amounts or suppress task creation,
acceptance, settlement batches, or receivables.

`FinanceManagementState` is the only owner of the generated receivable and all
later invoice, collection, voucher, ledger, close, and report state. A task batch
creates an already-confirmed source receivable with `sourceType = 任务结算` and a
frozen task-settlement snapshot. The receivable is source-owned and cannot be
edited as a manual business record. Customer receivable and employee
performance/salary/part-time labor payable are separate facts even when they
originate from the same task.

Acceptance reversal is audit-preserving. It returns the task to pending
acceptance, marks the acceptance archive and billing fact as reversed, removes
the employee labor source from settlement calculation while retaining it as
reversed history, and stops the performance source from contributing.
If finance has not consumed the receivable, the receivable is voided or the
reversed task line is removed from its monthly batch. If an invoice allocation,
voucher, settlement, or closed period has consumed it, the original receivable remains immutable and
an explicit finance correction issue requires reversal or a later-period
adjustment.

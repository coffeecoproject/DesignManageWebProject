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

## Finance Bank Reconciliation Contract

Owner: `财务管理 / 银行对账`.

Related frontend modules: `收支流水`, `流水复核`, `应收应付`, `费用与代收`.

Contract document: `docs/data/finance-bank-reconciliation-contract.md`.

Contract version: `finance-bank-reconciliation-contract-v1-draft`.

This contract hard-cuts bank reconciliation from a single system-flow match to a
relationship model. One bank statement can link to one primary reviewed
cash-flow row plus adjustment rows. Amount differences are handled through
reviewed system adjustment rows; original reviewed cash-flow amounts are not
mutated by bank reconciliation.

Backend integration must replace the frontend mock `matchedTransactionIds`
array with an auditable relationship table while keeping a read-model array for
simple page rendering if needed.

## Finance Accounting Voucher Status Contract

Owner: `财务管理 / 会计凭证`.

Related frontend modules: `应收应付`, `收支流水`, `流水复核`, `银行对账`, `发票台账`, `税务办理`.

Contract version: `finance-accounting-voucher-status-v5`.

The frontend voucher page is a statusized generation result, not a posted
general-ledger record. Rows are derived from immutable frontend facts:

- confirmed `应收应付` rows plus matched `发票台账` facts create `权责凭证`
  generation rows;
- reviewed and bank-reconciled `收支流水` rows create `资金凭证` generation
  rows; reviewed but unreconciled cash-flow rows stay as `待生成`;
- reviewed and bank-reconciled `流水冲正` and `流水补差` rows create `调整凭证`
  generation rows; reviewed but unreconciled adjustment rows stay as `待生成`.
- unresolved red invoices in `发票台账` create `调整凭证` handling rows when the
  original blue invoice relation is missing.
- confirmed `税务办理` rows with a payable amount create `税费凭证` generation
  rows. Tax matters that are confirmed but not completed stay as `待生成`; completed
  tax matters missing required declaration/payment receipts stay as `需处理`.

Voucher status is hard-cut to `待生成`, `需处理`, `已生成`, `已入账`, and `已冲销`.
The current frontend generator emits `已生成` when the source facts can produce
balanced entries, and `需处理` when a blocking issue is found. A frontend-session
lifecycle overlay can mark a generated row as `已入账` or `已冲销` for prototype
verification. Backend readiness still requires persisted vouchers, formal
voucher numbers, posting events, period locks, and general-ledger entries as
defined in `docs/data/finance-accounting-voucher-ledger-contract.md`.

`issueReasons` is the explicit blocking reason list. The first implemented
frontend checks are:

- missing or incomplete source document facts;
- missing original evidence such as source attachments or cash-flow vouchers;
- missing accounting subject mapping;
- invalid amount;
- unbalanced debit and credit entries.
- missing matched output invoice for receivable confirmation;
- partial output invoicing that still needs unbilled-income handling;
- output invoice tax missing or amount exceeding the confirmation amount;
- red invoice missing its original blue-invoice relation.
- reviewed cash-flow row still waiting for bank reconciliation;
- bank reconciliation amount mismatch or abnormal reconciliation state.
- confirmed tax matter still waiting for external handling completion;
- completed tax matter missing required tax declaration or payment receipt files.

For receivable accrual vouchers, matched normal output invoices split the
confirmation amount into revenue and output-tax lines. The debit remains the
full receivable amount. If matched normal output invoices cover only part of
the confirmed receivable amount, the row stays `需处理` with
`unbilled_income_pending` instead of silently duplicating unbilled income.

For payable accrual vouchers, matched normal input invoices are retained as
cost evidence in `invoiceRefs`, but the current small-scale taxpayer baseline
does not generate a VAT input-deduction line. Input tax is therefore not posted
to `2221` in this frontend phase.

Rows expose `sourceRefs` and `invoiceRefs` so the detail drawer can show the
source module, source number, invoice number, direction, status, declaration
treatment, tax-exclusive amount, tax amount, and tax-included amount without
requiring users to inspect internal mock-data fields.

Bank reconciliation is a prerequisite for frontend cash-voucher generation in
this phase. A reviewed public-account cash-flow row with
`reconciliationStatus = 未对账` is rendered as `待生成` with
`bank_reconciliation_pending`; it is not counted as `已生成`. A row with
`reconciliationStatus = 对账异常` is rendered as `需处理` with
`bank_amount_mismatch`. Once bank reconciliation confirms the system cash-flow
row, `reconciliationStatus = 已对账` allows the cash voucher to become
`已生成` if all other source facts are complete.

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

Backend integration must persist vouchers separately before supporting posting,
period close, reversal, formal voucher numbers, and audit-grade accounting
evidence. Until then, frontend vouchers remain recalculable generation rows, but
they no longer use a generic `草稿` status. The frontend `postAccountingVoucher`
mock currently simulates generation plus posting in one action and assigns a
mock formal voucher number. The backend contract separates candidate listing,
voucher generation, posting, reversal, period close, and general-ledger reads.

Backend integration must add a repository boundary before replacing the current
mock generator. Page components should consume backend candidate/persisted
voucher responses through a dedicated accounting-voucher repository, while
`buildAccountingVouchers` remains a mock-data fallback only. The expanded API
and data boundary is defined in
`docs/data/finance-accounting-voucher-ledger-contract.md`, including candidate
detail, batch generation/posting, source snapshots, invoice refs, idempotency
keys, accounting-period close checks, general-ledger entries, subject ledger,
and subject balances.

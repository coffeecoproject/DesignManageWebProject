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

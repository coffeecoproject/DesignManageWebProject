# Finance Accrual Voucher Frontloaded Readiness Plan

Status: `draft_plan`

Last updated: `2026-06-28`

Owner: `财务管理 / 应收应付 / 会计凭证`

Related docs:

- `docs/governance/finance-accounting-voucher-full-workflow-plan-v1.md`
- `docs/data/finance-accounting-voucher-ledger-contract.md`
- `docs/data/frontend-cross-module-contracts.md`
- `docs/web/route-page-inventory.md`

## 1. Purpose

This plan defines how to hard-cut the accrual voucher line so that accounting
voucher pages no longer act as a repair center for incomplete accrual facts.

Target principle:

```text
Incomplete source fact -> stays in the source module
Complete accrual fact -> enters accounting vouchers as 待制单
待制单 -> 制单 -> 已制单 -> 记账 -> 已记账 -> 冲销 -> 已冲销
```

The immediate scope is the `权责凭证` line derived from `应收应付`. Cash vouchers,
tax vouchers, adjustment vouchers, and bank reconciliation rules can later adopt
the same frontloaded pattern, but they should not be silently changed in the
same pass without a separate decision.

## 2. Current Code Evidence

### 2.1 应收应付确认过于宽松

Current confirmed boundary is only:

```ts
record.confirmationStatus === '已确认'
```

Evidence:

- `apps/web/src/features/finance/financeReceivablesPayablesModel.ts:130`

The current form validation only requires period, amount, category, dates,
owner, and source title. It does not require source number, original evidence,
tax basis, or accounting subject readiness.

Evidence:

- `apps/web/src/features/finance/financeReceivablesPayablesModel.ts:216`

Current form data can hold files, source number, source title, category, and
source type, but the validation does not yet make every accrual readiness field
mandatory before confirmation.

Evidence:

- `apps/web/src/features/finance/financeReceivablesPayablesModel.ts:184`

### 2.2 会计凭证页当前承接了异常

Current accounting voucher finalization adds issue reasons and emits `需处理`
when the candidate has invalid amount, missing accounting subject, or unbalanced
entries.

Evidence:

- `apps/web/src/features/finance/financeAccountingVoucherModel.ts:558`

Earlier voucher generation included every confirmed receivable/payable row and
then decided whether it was the old complete-candidate state or `需处理`.

Evidence:

- `apps/web/src/features/finance/financeAccountingVoucherModel.ts:1040`

This means the current flow is:

```text
应收应付已确认
-> 进入会计凭证候选
-> 会计凭证页发现问题
-> 显示 需处理
```

Target flow should become:

```text
应收应付待确认/待补资料
-> 来源模块补齐前置事实
-> 应收应付已确认
-> 会计凭证页显示 待制单
```

### 2.3 财务类目存在会计科目 fallback

Current category snapshot falls back to `6602 管理费用` when the category or
subject mapping cannot be found.

Evidence:

- `apps/web/src/features/finance/financeData.ts:457`

That behavior conflicts with the target accounting boundary. Missing category
or missing accounting subject should block upstream confirmation, not silently
fall back to a default posting subject.

### 2.4 发票匹配已经接近目标边界

Current invoice matching applies only to confirmed receivable/payable rows whose
source type is invoice-applicable and whose tax basis is not `不涉及发票`.

Evidence:

- `apps/web/src/features/finance/financeInvoiceMatchingModel.ts:24`

This is directionally correct, but after the hard cut, invoice matching should
become one of the upstream evidence/settlement tasks that determines whether
the receivable/payable can become confirmed, instead of letting accounting
vouchers expose `tax_basis_pending`.

## 3. Target Position

### 3.1 应收应付 owns accrual readiness

`应收应付` should own whether an accrual fact is ready for accounting vouchers.

It should answer:

- Which period does this business fact belong to?
- Who is the counterparty?
- What is the confirmed amount?
- What is the source document?
- What original evidence supports the fact?
- Which finance category and accounting subject apply?
- What is the tax basis?
- Does this fact require invoice matching, and what is the current invoice
  evidence position?

### 3.2 会计凭证 owns formal accounting lifecycle

`会计凭证` should own only:

- showing prepared accrual facts as `待制单`;
- freezing a formal voucher through `制单`;
- booking the voucher to the ledger through `记账`;
- preserving immutability after booking;
- reversing or adjusting booked vouchers.

It should not own:

- uploading missing original evidence for receivable/payable source facts;
- choosing finance category or accounting subject for a business fact;
- deciding whether tax basis exists;
- matching invoices to accrual facts;
- editing source business amounts.

## 4. Target Status Model

### 4.1 权责凭证 visible statuses

For `权责凭证`, replace the visible candidate statuses:

```text
待生成
需处理
旧完整候选状态
```

with:

```text
待制单
已制单
已记账
已冲销
```

Meaning:

| Status | Meaning | Ledger impact |
| --- | --- | --- |
| `待制单` | Source fact is complete and can be prepared as a formal voucher | No |
| `已制单` | Formal voucher is persisted and has a voucher number, but is not booked | No |
| `已记账` | Voucher lines are booked to ledger | Yes |
| `已冲销` | Booked voucher has been reversed by a linked reversal voucher | Reversed |

### 4.2 Upstream readiness statuses

Do not move `需处理` wording into accounting vouchers. Instead, model source
readiness in `应收应付`.

Recommended readiness state:

```text
待确认
待补资料
待补票税
待配置
可确认
已确认
已作废
```

These are source-level states, not accounting-voucher states.

Suggested meaning:

| Status | Meaning | User action |
| --- | --- | --- |
| `待确认` | Source fact exists but has not entered finance confirmation | review source fields |
| `待补资料` | Original evidence or source document is missing | complete source files |
| `待补票税` | tax basis or invoice treatment is not clear | complete tax basis or invoice link |
| `待配置` | finance category or accounting subject mapping is missing | fix finance category/accounting subject config |
| `可确认` | all accrual readiness checks pass | confirm receivable/payable |
| `已确认` | accrual fact can enter voucher queue | no source edit after linked voucher is prepared |
| `已作废` | source fact is voided | excluded |

If this feels too many statuses for the main list, the page can expose one
primary state:

```text
待确认 / 可确认 / 已确认 / 已作废
```

and use a compact reason list inside the drawer for missing documents, tax
basis, or configuration.

## 5. Accrual Readiness Rules

An `应收应付` row can become `已确认` only when all checks below pass.

### 5.1 Required source facts

Required:

- `accountingPeriod`
- `confirmDate`
- `documentNo`
- `sourceNo`
- `sourceTitle`
- `sourceType`
- `counterparty`
- `counterpartyType`
- `direction`
- `amount > 0`
- `dueDate`
- `owner`

Current gap:

- `sourceNo` is not required by current form validation.
- `counterparty` is not required by current form validation.
- source readiness is not represented as a first-class model.

### 5.2 Original evidence

Required original evidence depends on source type.

| Source type | Required original evidence examples |
| --- | --- |
| `合同应收` | contract, stage confirmation, acceptance record, settlement statement |
| `项目阶段确认` | project confirmation, acceptance record, settlement statement |
| `员工报销` | reimbursement form, approval trail, invoice/receipt or exception note |
| `外协结算` | outsourcing task acceptance, settlement statement, contract if applicable |
| `材料采购` | purchase request, delivery/acceptance evidence, invoice/receipt if applicable |
| `运营费用` | expense application, supplier evidence, invoice/receipt if applicable |
| `薪酬发放` | payroll detail, attendance basis, performance basis, IIT result |
| `月度绩效` | performance detail, payroll linkage |
| `季度绩效` | quarterly performance detail, payroll linkage |

Target behavior:

- missing source evidence blocks `应收应付` confirmation;
- accounting vouchers do not show `缺少原始凭证` for `权责凭证`;
- drawer can show read-only evidence snapshots after the fact is confirmed.

### 5.3 Tax basis

Tax basis means the source can provide:

- tax-included amount;
- tax-excluded amount;
- tax amount;
- tax rate;
- basis source: `发票台账`, `来源单据`, or `不涉及发票`.

Target behavior:

| Situation | Upstream result | Voucher result |
| --- | --- | --- |
| fully matched invoice | `可确认` | `待制单` with invoice tax basis |
| partial/missing invoice but source tax basis complete | `可确认` | `待制单` with source tax basis and invoice evidence status |
| not invoice-applicable | `可确认` with `不涉及发票` | `待制单` |
| invoice/tax basis unknown | `待补票税` | no voucher row |
| red invoice missing original invoice | invoice matching todo | no accrual voucher mutation until resolved |

Current gap:

- source tax basis exists in mock data, but it is defaulted in seed creation and
  not controlled by an explicit confirmation flow.
- default tax rate is prototype data, not a production tax policy.

### 5.4 Accounting subject mapping

Target behavior:

- every enabled finance category used by `应收应付` must map to an existing
  accounting subject;
- unknown categories must not fall back to `6602 管理费用`;
- missing mapping blocks source confirmation as `待配置`.

Current gap:

- `getFinanceCategorySnapshot` has a fallback to `6602 管理费用`.
- test coverage currently accepts fallback for unknown categories.

### 5.5 Balance and amount validation

Target behavior:

- generated accrual lines must always balance before the row reaches the voucher
  page;
- unbalanced line generation is an internal system error, not a user-facing
  voucher status;
- invalid amount blocks source confirmation.

Accounting voucher model should still keep defensive assertions, but these
should fail tests or block prepare API responses, not create daily `需处理`
work items in the voucher page.

## 6. Module Changes

### 6.1 应收应付

Add source readiness calculation:

```ts
type FinanceReceivablePayableReadinessStatus =
  | '待确认'
  | '待补资料'
  | '待补票税'
  | '待配置'
  | '可确认'
  | '已确认'
  | '已作废';
```

Add issue codes:

```ts
type FinanceReceivablePayableReadinessIssue =
  | 'missing_source_document'
  | 'missing_original_evidence'
  | 'tax_basis_pending'
  | 'missing_accounting_subject'
  | 'amount_invalid';
```

Add functions:

```ts
buildFinanceReceivablePayableReadiness(record, invoiceRows, categoryRows, subjectRows)
canConfirmFinanceReceivablePayable(record, readiness)
confirmFinanceReceivablePayable(record, readiness)
```

UI changes:

- Main list keeps settlement state separate from accrual readiness.
- Drawer adds `确认条件` or `权责依据` section.
- Confirmation action is disabled until readiness is `可确认`.
- Editing is blocked after a formal voucher is prepared.

### 6.2 发票匹配

Target:

- Continue to resolve invoices against `应收应付` or business confirmation
  references.
- Feed invoice evidence status into receivable/payable readiness.
- Do not create accounting-voucher `需处理` rows for ordinary unmatched invoice
  work.

Recommended wording:

- `发票待关联业务`
- `发票证据待补`
- `发票部分匹配`
- `税额依据待确认`
- `红票待关联原票`

These remain invoice workbench tasks, not accounting voucher tasks.

### 6.3 财务类目 / 会计科目

Target:

- Remove unknown-category fallback from accounting-relevant paths.
- Enabled secondary categories require valid accounting subject mapping.
- Category save/create drawer already asks for default accounting subject; use
  that as the source of truth.
- Unknown category in source data should become source readiness `待配置`.

### 6.4 会计凭证

For `权责凭证` only:

- `buildAccountingVouchers` should receive only confirmed and ready accrual
  facts, or filter with a dedicated readiness check.
- Rename the old complete-candidate display to `待制单` for accrual rows.
- Remove `需处理` metrics, table values, and issue section for accrual rows.
- Keep formal statuses: `已制单`, `已记账`, `已冲销`.
- Keep defensive internal checks, but do not expose them as ordinary accrual
  workflow states.

For other voucher types:

- Cash vouchers may still show waiting behavior until bank reconciliation is
  fully frontloaded.
- Tax vouchers may still show waiting behavior until tax handling readiness is
  fully frontloaded.
- Do not remove global candidate status for all voucher types without separate
  approval.

## 7. Backend/Data Contract Impact

Earlier backend-contract wording defined derived candidates as:

```text
待生成 / 需处理 / 旧完整候选状态
```

For this hard cut, introduce an accrual-specific contract:

```text
GET /api/finance/accrual-confirmations
POST /api/finance/accrual-confirmations/{id}/confirm
GET /api/finance/accounting-voucher-candidates?businessType=权责凭证
POST /api/finance/accounting-vouchers/prepare
```

Backend target:

- `accrual-confirmations` exposes source readiness and issue reasons.
- `accounting-voucher-candidates` for `权责凭证` returns only `待制单` rows.
- `prepare` rejects stale or unready source facts with machine errors, but the
  normal UI should direct users back to the source module before they reach
  prepare.

Suggested error model:

```text
ACCRUAL_SOURCE_NOT_READY
ACCRUAL_SOURCE_CHANGED
ACCOUNTING_SUBJECT_MAPPING_MISSING
ORIGINAL_EVIDENCE_MISSING
TAX_BASIS_PENDING
CLOSED_ACCOUNTING_PERIOD
```

## 8. Frontend Test Impact

Update or add tests:

### 应收应付 model tests

- missing original evidence blocks confirmation;
- missing source number blocks confirmation;
- missing tax basis blocks confirmation;
- missing accounting subject mapping blocks confirmation;
- complete source fact becomes `可确认`;
- confirmed source fact can enter voucher queue.

### 发票匹配 tests

- unmatched invoice-applicable source remains in invoice/source readiness work,
  not voucher `需处理`;
- full invoice match feeds invoice tax basis;
- partial invoice plus source tax basis is confirmable;
- missing tax basis remains `待补票税`.

### 会计凭证 tests

- accrual rows from complete confirmed source facts display `待制单`;
- accrual rows with missing evidence/tax/mapping are absent from voucher page;
- `制单` creates `已制单`;
- `记账` creates ledger entries;
- period lock blocks `制单`, `记账`, and `冲销`;
- defensive generation failure is tested as model/API failure, not visible
  workflow status.

### 财务类目 tests

- unknown category no longer falls back to `6602`;
- enabled finance categories must map to valid subjects;
- source readiness becomes `待配置` when mapping is missing.

## 9. Documentation Impact

When implementing the hard cut, update:

- `docs/governance/finance-accounting-voucher-full-workflow-plan-v1.md`
- `docs/data/finance-accounting-voucher-ledger-contract.md`
- `docs/data/frontend-cross-module-contracts.md`
- `docs/web/route-page-inventory.md`
- `docs/testing/test-plan.md`
- `docs/evidence/frontend-baseline-evidence.md`

Required wording shift:

```text
Old:
Confirmed receivable/payable facts generate candidates that can be 待生成,
需处理, or the old complete-candidate state.

New:
Only accrual-ready confirmed receivable/payable facts enter the accounting
voucher queue. Accrual voucher rows are 待制单 until prepared as formal vouchers.
Incomplete source facts remain in 应收应付 / 发票匹配 / 财务类目配置.
```

## 10. Implementation Sequence

### Phase A: Source readiness model

- Add readiness types and issue functions to `financeReceivablesPayablesModel`.
- Make `sourceNo`, `counterparty`, original files, tax basis, and category
  mapping part of confirm readiness.
- Add tests.

### Phase B: Category mapping hard cut

- Remove unknown-category fallback from accounting-sensitive paths.
- Change tests that currently expect fallback.
- Make missing mapping visible in source readiness.

### Phase C: Invoice readiness integration

- Let invoice matching feed receivable/payable readiness.
- Keep invoice tasks in the invoice matching module.
- Do not produce accrual voucher issue rows for unmatched ordinary invoices.

### Phase D: Accrual voucher page hard cut

- Map ready accrual candidates to `待制单`.
- Remove accrual `需处理` display.
- Keep `制单 / 记账 / 冲销`.
- Ensure the drawer shows read-only source basis, tax basis, invoice evidence,
  and lines.

### Phase E: Contract/docs/gates

- Update backend contract and frontend cross-module contract.
- Update route inventory and test plan.
- Run frontend gates and browser smoke.

## 11. Acceptance Criteria

Implementation is complete when:

- No `权责凭证` row can display `待生成`, `需处理`, or the old complete-candidate label.
- Complete accrual rows display `待制单`.
- Incomplete accrual source facts stay in `应收应付` or `发票匹配`.
- Missing source document/evidence/tax basis/category mapping is represented
  before confirmation.
- Unknown category no longer silently maps to `6602 管理费用` in accounting
  paths.
- `制单` creates `已制单` and does not create ledger entries.
- `记账` creates ledger entries.
- Existing cash/tax/adjustment voucher behavior is not changed unless explicitly
  included in the implementation scope.
- Unit tests cover readiness and voucher lifecycle.
- `typecheck`, `test:web`, `lint`, `build:web`, and `git diff --check` pass.

## 12. Open Decisions

1. Should the main `应收应付` list expose all readiness statuses, or show only
   `待确认 / 可确认 / 已确认 / 已作废` and move reason detail into the drawer?
2. Should cash/tax/adjustment vouchers keep the current candidate model for now,
   or should they receive the same frontloaded treatment in follow-up phases?
3. Should `制单` remain visible as the user action, or should it be renamed to
   `生成凭证` for non-accounting users while keeping backend operation name
   `prepare`?
4. Should confirmed but not yet prepared `应收应付` still be editable, or should
   edits require a formal adjustment workflow after confirmation?
5. Should source tax basis be user-entered in `应收应付`, derived from upstream
   contracts/expense forms, or only editable through source modules?

## 13. Explicit Non-Goals For This Plan

- No production migration.
- No backend database schema change in this document-only phase.
- No statutory tax filing or official invoice verification integration.
- No formal monthly close implementation.
- No financial statement generation.
- No replacement for accountant review, audit policy, or statutory compliance
  advice.

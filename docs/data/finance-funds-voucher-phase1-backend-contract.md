# Finance Funds Voucher Phase 1 Backend Contract

Status: `backend_phase1_contract_draft`

Last updated: `2026-06-29`

Owner: `财务管理 / 收支流水 / 流水复核 / 银行对账 / 会计凭证`

Related contracts:

- `docs/data/finance-bank-reconciliation-contract.md`
- `docs/data/finance-accounting-voucher-ledger-contract.md`
- `docs/data/finance-tax-accounting-backend-contract.md`

## 1. Purpose

This document fixes the first backend implementation boundary for the funds
voucher line. It turns the current frontend prototype into an auditable cash
fact pipeline without implementing formal voucher posting, period close, or
general ledger writes in the same step.

The phase 1 objective is:

```text
business/source action
-> persisted system cash-flow row
-> cash-flow review
-> imported bank statement
-> bank reconciliation relationship
-> read-only funds-voucher candidate
```

The phase 2 objective is kept separate:

```text
read-only candidate
-> formal voucher preparation
-> voucher posting
-> general ledger
-> accounting period close
```

## 2. Industrial Decisions

| Decision | Phase 1 rule | Reason |
| --- | --- | --- |
| Cash-flow row persistence | Implement now | `收支流水`, `流水复核`, `银行对账`, and `资金凭证` must read the same cash fact. |
| Cash-flow review | Implement now | Review is the point where a system cash-flow row becomes an accounting-grade cash fact candidate. |
| Bank statement import | Implement now | Real bank movement is independent evidence and must be stored separately from system cash-flow rows. |
| Bank reconciliation relationship | Implement now | Voucher candidates must point to the bank evidence relationship, not only a status flag. |
| Funds-voucher candidate API | Implement now as read-only | The accounting-voucher page can show what is ready without creating official vouchers. |
| Formal voucher preparation | Defer to phase 2 | Requires voucher number sequence, source hash locking, period checks, and idempotent writes. |
| Posting/general ledger | Defer to phase 2 | Requires transaction-safe ledger entries and period locking. |
| Direct bank API pull | Out of scope | Phase 1 starts with uploaded/imported statement files. |
| Online payment | Out of scope | Real payment/collection happens offline; the system records and verifies evidence. |

## 3. Source Of Truth

| Fact | Owner | Phase 1 source of truth |
| --- | --- | --- |
| System cash-flow row | `finance_transactions` | Created from upstream source modules or bank-reconciliation supplement flow. |
| Uploaded voucher/evidence | `finance_transaction_files` | Required before review posting. |
| Cash-flow lifecycle | `finance_transaction_events` | Append-only review, return, void, and correction event stream. |
| Bank statement row | `finance_bank_statements` | Imported bank movement, account scoped. |
| Bank import batch | `finance_bank_statement_import_batches` | Import file identity, range, account, and duplicate/precheck result. |
| Bank reconciliation relationship | `finance_bank_reconciliation_links` | One confirmed relationship header per bank statement. |
| Linked system rows | `finance_bank_reconciliation_link_transactions` | Relationship detail rows with `主流水 / 补差流水 / 冲正流水`. |
| Funds-voucher candidate | derived read model | Recomputed from reviewed cash-flow rows plus active bank reconciliation relationship. |

The candidate service must not persist official accounting vouchers in phase 1.
It returns a recomputed read model only.

## 4. Phase 1 Data Model

### 4.1 `finance_transactions`

System cash-flow row.

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Internal id. |
| `transaction_no` | yes | Business-facing cash-flow number. |
| `direction` | yes | `收入` or `支出` from company account perspective. |
| `amount` | yes | Positive amount. |
| `occurred_date` | yes | Real cash-flow occurrence date entered from evidence. |
| `finance_period` | yes | Accounting period, formatted as `YYYY-MM`. |
| `public_account_id` | yes | Company account affected by the row. |
| `public_account_snapshot` | yes | Account display snapshot at row creation time. |
| `first_category_id` | yes | First-level finance category. |
| `second_category_id` | yes | Second-level finance category. |
| `category_snapshot` | yes | Category names, reporting group, and accounting mapping snapshot when available. |
| `payment_method` | yes | Collection/payment method. |
| `source_type` | yes | `应收收款`, `应付款项`, `员工代收`, `税费缴款`, `银行补录`, `流水补差`, `流水冲正`, etc. |
| `source_id` | yes | Upstream source id when available. |
| `source_no` | yes | Upstream source number. |
| `source_description` | yes | Compact business description. |
| `related_receivable_payable_id` | no | Receivable/payable relation used for settlement writeback. |
| `related_receivable_payable_no` | no | Display no snapshot. |
| `review_status` | yes | `待复核`, `退回修改`, `已入账`, or `已作废`. |
| `voucher_status` | yes | `待补充` or `已上传`. |
| `reconciliation_status` | yes | `未对账`, `已对账`, or `对账异常`. |
| `reviewed_at` | no | Review posting time. |
| `reviewed_by` | no | Reviewer account snapshot. |
| `created_at` | yes | Creation time. |
| `created_by` | yes | Creator account snapshot. |
| `version` | yes | Optimistic concurrency. |

Rules:

- A row starts as `待复核`.
- `已入账` means cash-flow review has accepted the row into the system cash
  ledger. It does not mean bank reconciliation or accounting voucher posting is
  complete.
- `已入账` rows cannot be directly edited. Correction must use `流水冲正` or
  `流水补差`.
- `已作废` rows are excluded from voucher candidates.
- `finance_period` is derived from the business accounting rule, not from the
  bank statement month. Bank date and accounting period can differ.

### 4.2 `finance_transaction_files`

Evidence files attached to one cash-flow row.

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Internal id. |
| `finance_transaction_id` | yes | Related cash-flow row. |
| `file_id` | yes | Storage file id. |
| `file_name` | yes | Display file name. |
| `file_type` | yes | `PDF`, `JPG`, `PNG`, or future storage MIME type. |
| `file_role` | yes | `收款凭证`, `付款凭证`, `转账凭证`, `银行回单`, or `其他依据`. |
| `uploaded_at` | yes | Upload time. |
| `uploaded_by` | yes | Uploader account snapshot. |

Rules:

- Review posting requires at least one effective evidence file unless a future
  approved system-source exception explicitly marks the row as evidence-free.
- The page must use preview/download file components. File ids are not exposed
  as raw editable text.

### 4.3 `finance_transaction_events`

Append-only operation stream.

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Internal id. |
| `finance_transaction_id` | yes | Related row. |
| `event_type` | yes | `created`, `file_uploaded`, `review_posted`, `returned`, `voided`, `correction_created`, `reconciled`, or `reconciliation_reversed`. |
| `before_state` | no | Compact JSON snapshot before change. |
| `after_state` | no | Compact JSON snapshot after change. |
| `reason` | no | Required for return, void, and reversal. |
| `created_at` | yes | Event time. |
| `created_by` | yes | Actor account snapshot. |

### 4.4 Bank Statement And Reconciliation Tables

Phase 1 uses the bank tables defined by
`docs/data/finance-bank-reconciliation-contract.md`:

- `finance_bank_statement_import_batches`
- `finance_bank_statements`
- `finance_bank_reconciliation_links`
- `finance_bank_reconciliation_link_transactions`
- reconciliation events / audit events

The critical phase 1 rule is that `finance_transactions.reconciliation_status =
已对账` is not enough for a funds-voucher candidate. The candidate service must
also find an active relationship header and detail row that references the
system cash-flow row.

## 5. State Model

### 5.1 Cash-Flow Review Status

| Status | Meaning | Candidate impact |
| --- | --- | --- |
| `待复核` | Submitted but not reviewed. | Excluded from candidates. |
| `退回修改` | Returned to source owner. | Excluded from candidates. |
| `已入账` | Reviewed and accepted as system cash fact. | Eligible for bank-reconciliation checks. |
| `已作废` | Voided record. | Excluded from candidates. |

### 5.2 Cash-Flow Reconciliation Status

| Status | Meaning | Candidate impact |
| --- | --- | --- |
| `未对账` | No confirmed bank relationship. | `待生成` with `bank_reconciliation_pending`. |
| `已对账` | Confirmed against bank statement. | Can become `待制单` only with active relationship detail. |
| `对账异常` | Mismatch, reversal, or disputed relation. | `需处理` with a bank issue reason. |

### 5.3 Funds-Voucher Candidate Status

Candidate rows returned by phase 1 use the shared candidate statuses:

```text
待生成
需处理
待制单
```

| Status | Meaning |
| --- | --- |
| `待生成` | Source exists but a required upstream step is not complete. |
| `需处理` | Source claims readiness but has an inconsistency that must be corrected upstream. |
| `待制单` | Source facts are complete enough for phase 2 voucher preparation. |

Phase 1 does not return `已制单`, `已入账`, or `已冲销` as candidate statuses.
Those belong to persisted voucher lifecycle in phase 2.

## 6. Funds-Voucher Candidate Rules

The candidate service is server-derived and read-only.

Inclusion:

- Include `finance_transactions.review_status = 已入账` rows.
- Include ordinary cash-flow rows as `资金凭证`.
- Include `流水补差 / 流水冲正` rows as `调整凭证`.
- Exclude `待复核`, `退回修改`, and `已作废` rows.

Readiness rules:

| Condition | Candidate status | Issue code |
| --- | --- | --- |
| `voucher_status = 待补充` | `需处理` | `cash_voucher_file_missing` |
| `reconciliation_status = 未对账` | `待生成` | `bank_reconciliation_pending` |
| `reconciliation_status = 对账异常` | `需处理` | `bank_amount_mismatch` |
| `reconciliation_status = 已对账` but no active relationship detail | `需处理` | `bank_reconciliation_source_missing` |
| Active relationship detail exists and amount/category/accounting mapping is valid | `待制单` | none |
| Debit/credit proposal cannot balance | `需处理` | `voucher_not_balanced` |
| Accounting subject mapping missing from category snapshot | `需处理` | `accounting_subject_missing` |

Candidate source references:

| Source module | Required role | Meaning |
| --- | --- | --- |
| `收支流水` | `主来源` | Reviewed system cash-flow row. |
| `银行对账` | `银行依据` | Active bank reconciliation relationship header/detail. |
| `应收应付` | optional `业务依据` | Settlement source for a collection/payment row. |
| `税务办理` | optional `业务依据` | Tax payment source when the row came from tax handling. |

## 7. API Contract

All mutating endpoints require authentication, authorization, idempotency key,
optimistic concurrency, and audit events. Concrete permission scopes are pending
backend authorization design.

### 7.1 Cash-Flow Rows

`GET /api/finance/transactions`

Query:

```ts
type FinanceTransactionListQuery = {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  direction?: '收入' | '支出';
  reviewStatus?: '待复核' | '退回修改' | '已入账' | '已作废';
  reconciliationStatus?: '未对账' | '已对账' | '对账异常';
  publicAccountId?: string;
  keyword?: string;
};
```

`POST /api/finance/transactions`

Creates a source-generated cash-flow row. It is used by upstream source
services, employee collection after transfer proof, tax payment records, and
bank-reconciliation supplement flows. It is not a general UI "新增流水" entry.

Request:

```ts
type CreateFinanceTransactionRequest = {
  direction: '收入' | '支出';
  amount: number;
  occurredDate: string;
  financePeriod: string;
  publicAccountId: string;
  firstCategoryId: string;
  secondCategoryId: string;
  paymentMethod: string;
  sourceType: string;
  sourceId?: string;
  sourceNo: string;
  sourceDescription: string;
  relatedReceivablePayableId?: string;
  evidenceFileIds?: string[];
  idempotencyKey: string;
};
```

Rules:

- The backend resolves `public_account_snapshot` and `category_snapshot`.
- Created rows enter `待复核`.
- Direct business UI must still use upstream modules, not this endpoint as a
  free-form manual ledger editor.

`GET /api/finance/transactions/{transactionId}`

Returns transaction detail, evidence files, review events, bank relationship
summary, and source references.

### 7.2 Cash-Flow Review

`POST /api/finance/transactions/{transactionId}/review`

Posts a row from `待复核` to `已入账`.

Request:

```ts
type ReviewFinanceTransactionRequest = {
  version: number;
  idempotencyKey: string;
};
```

Rules:

- Requires at least one effective evidence file.
- Requires active public account and valid first/second category snapshot.
- Rejects rows already `已入账` unless the idempotency key is an exact replay.
- Writes `review_posted` event.

`POST /api/finance/transactions/{transactionId}/return`

Returns a row to its source owner.

```ts
type ReturnFinanceTransactionRequest = {
  reason: string;
  version: number;
  idempotencyKey: string;
};
```

`POST /api/finance/transactions/{transactionId}/void`

Voids a row before review posting. Voiding a reviewed row is blocked in phase 1;
use correction rows instead.

```ts
type VoidFinanceTransactionRequest = {
  reason: string;
  version: number;
  idempotencyKey: string;
};
```

### 7.3 Evidence Files

`POST /api/finance/transactions/{transactionId}/evidence-files`

Binds uploaded file records to the transaction. The actual upload/storage API
is outside this contract.

```ts
type AttachTransactionEvidenceRequest = {
  files: Array<{
    fileId: string;
    fileName: string;
    fileRole: '收款凭证' | '付款凭证' | '转账凭证' | '银行回单' | '其他依据';
  }>;
  version: number;
  idempotencyKey: string;
};
```

### 7.4 Bank Statement Import And Reconciliation

Phase 1 uses the endpoints defined in
`docs/data/finance-bank-reconciliation-contract.md`:

- `POST /api/finance/bank-statement-imports/preview`
- `POST /api/finance/bank-statement-imports`
- `GET /api/finance/bank-reconciliation/items`
- `GET /api/finance/bank-reconciliation/items/{bankStatementId}`
- `POST /api/finance/bank-reconciliation/items/{bankStatementId}/system-flows`
- `POST /api/finance/bank-reconciliation/items/{bankStatementId}/amount-adjustments`
- `POST /api/finance/bank-reconciliation/items/{bankStatementId}/confirm`
- `POST /api/finance/bank-reconciliation/items/{bankStatementId}/reverse`

These endpoints must persist relationship header/detail rows. A UI-only
`matchedTransactionIds` array cannot be the backend source of truth.

### 7.5 Read-Only Funds-Voucher Candidates

`GET /api/finance/accounting-voucher-candidates`

Phase 1 supported query:

```ts
type FundsVoucherCandidateQuery = {
  period?: string;
  businessType?: '资金凭证' | '调整凭证';
  status?: '待生成' | '需处理' | '待制单';
  keyword?: string;
};
```

Response row:

```ts
type FundsVoucherCandidateRow = {
  candidateId: string;
  businessType: '资金凭证' | '调整凭证';
  voucherKind: '收款凭证' | '付款凭证' | '转账凭证';
  candidateStatus: '待生成' | '需处理' | '待制单';
  accountingPeriod: string;
  voucherDate: string;
  amount: string;
  summary: string;
  sourceHash: string;
  issueReasons: Array<{
    code:
      | 'cash_voucher_file_missing'
      | 'bank_reconciliation_pending'
      | 'bank_amount_mismatch'
      | 'bank_reconciliation_source_missing'
      | 'accounting_subject_missing'
      | 'voucher_not_balanced';
    message: string;
    sourceModule: string;
    sourceNo?: string;
  }>;
  sourceRefs: Array<{
    sourceModule: '收支流水' | '银行对账' | '应收应付' | '税务办理';
    sourceId: string;
    sourceNo: string;
    role: '主来源' | '银行依据' | '业务依据';
    snapshot: Record<string, unknown>;
  }>;
  proposedLines: Array<{
    side: '借方' | '贷方';
    subjectCode: string;
    subjectName: string;
    amount: string;
    summary: string;
  }>;
  preparedVoucherId: null;
};
```

`GET /api/finance/accounting-voucher-candidates/{candidateId}`

Returns the same row plus detailed source snapshots, linked transaction rows,
bank relationship header, and evidence file metadata.

Phase 1 rules:

- `preparedVoucherId` is always `null`.
- `POST /api/finance/accounting-vouchers/prepare` is documented in the general
  ledger contract but not implemented in phase 1.
- The backend must recompute candidates from source facts on every read. The
  frontend must not submit proposed lines as source truth.

## 8. Error Semantics

| Code | HTTP | Meaning |
| --- | --- | --- |
| `FINANCE_TRANSACTION_NOT_FOUND` | 404 | Cash-flow row does not exist or is outside access scope. |
| `FINANCE_TRANSACTION_STATE_CONFLICT` | 409 | Current status/version does not allow the operation. |
| `FINANCE_TRANSACTION_EVIDENCE_REQUIRED` | 422 | Review posting attempted without required evidence. |
| `PUBLIC_ACCOUNT_INVALID` | 422 | Account missing, disabled, or unsupported for the action. |
| `FINANCE_CATEGORY_INVALID` | 422 | Category missing, disabled, or lacks required accounting mapping. |
| `BANK_RECONCILIATION_RELATION_REQUIRED` | 422 | Candidate source says reconciled but active relation detail is missing. |
| `IDEMPOTENCY_KEY_REPLAY_MISMATCH` | 409 | Same idempotency key used with a different request body. |

## 9. Frontend Integration Boundary

Current frontend pages remain prototype consumers:

- `/finance/transactions` displays reviewed and historical system cash-flow rows.
- `/finance/review` operates only on `待复核` rows.
- `/finance/bank-reconciliation` owns bank statement import and matching work.
- `/finance/accounting-vouchers` shows server-derived candidate rows for
  `资金凭证 / 调整凭证` but does not become the owner of cash-flow correction.

The frontend must continue to avoid:

- free-form general "新增流水" in `收支流水`;
- directly editing reviewed cash-flow amount;
- manually setting `已对账` without a relationship header/detail;
- manually selecting accounting subjects in business pages;
- treating candidate rows as official accounting vouchers.

## 10. Verification Plan

Before backend readiness can be claimed:

- Contract tests for all phase 1 endpoints.
- Database migrations and rollback path for phase 1 tables.
- Idempotency tests for mutating endpoints.
- State transition tests for review, return, void, reconciliation confirm, and
  reconciliation reversal.
- Candidate derivation tests for `未对账`, `对账异常`, missing relation detail,
  missing evidence, missing mapping, and complete `待制单`.
- Authorization/resource-scope tests for finance users and source-module users.
- Audit-event tests for every mutating operation.

## 11. Explicit Non-Readiness

This document is not evidence of:

- production database schema;
- deployed API implementation;
- official accounting-voucher posting;
- general-ledger readiness;
- period close readiness;
- bank API integration;
- tax filing readiness;
- production finance compliance readiness.

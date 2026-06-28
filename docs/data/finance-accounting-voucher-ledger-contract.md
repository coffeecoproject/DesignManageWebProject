# Finance Accounting Voucher And General Ledger Contract

Status: `backend_contract_expanded`

Last updated: `2026-06-28`

Owner: `财务管理 / 会计凭证`

## 1. Purpose

This contract defines the backend boundary for accounting voucher persistence,
formal voucher numbers, posting, reversal, accounting-period locks, and general
ledger entries.

It upgrades the frontend prototype from recalculated voucher rows into a future
backend workflow. The current frontend may still show derived rows, but backend
readiness requires persisted records and transaction-safe operations.

## 2. Core Position

There are four separate layers:

| Layer | Meaning | Persistent |
| --- | --- | --- |
| Voucher candidate | Derived from source facts such as receivable/payable, invoice, cash-flow, tax matter, or adjustment | no, query result |
| Accounting voucher | Persisted accounting document with formal voucher number and immutable lines after posting | yes |
| Posting result | State transition from `已生成` to `已入账`; writes general ledger entries atomically | yes |
| General ledger | Subject-level debit/credit ledger consumed by later reports | yes |

The backend must not treat a frontend candidate row as an official accounting
voucher until `POST /api/finance/accounting-vouchers/generate` persists it.

## 2.1 Source Fact Boundary

Accounting vouchers are not generated directly from page rows. The backend
voucher service consumes source facts from upstream modules and recomputes
candidate rows server-side.

| Source fact | Upstream owner | Candidate type | Minimum source status | Blocking facts |
| --- | --- | --- | --- | --- |
| Receivable/payable confirmation | `应收应付` | `权责凭证` | confirmation status `已确认` and not voided | missing source document, missing original evidence, missing accounting subject, invoice/tax mismatch |
| Output invoice / input invoice | `发票台账` and `发票匹配` | supports `权责凭证` or `调整凭证` | invoice status complete enough for accounting treatment | missing original blue invoice for red invoice, missing tax amount, unmatched issued invoice |
| System cash-flow row | `收支流水` and `流水复核` | `资金凭证` or `调整凭证` | cash-flow status `已入账` after review | missing voucher file, unreconciled bank statement, bank amount mismatch |
| Bank statement reconciliation | `银行对账` | supports `资金凭证` | reconciliation status `已对账` | unmatched bank row, unresolved difference, duplicate or disputed import |
| Tax matter | `税务办理` | `税费凭证` | tax matter confirmed and completed when payable amount exists | missing declaration receipt, missing payment receipt, external handling incomplete |
| Accounting adjustment | controlled accounting workflow | `调整凭证` | reviewed adjustment source exists | missing reason, missing original voucher/source, closed period |
| Reversal request | `会计凭证` | `冲销凭证` | original voucher status `已入账` | original period closed, already reversed, missing reason |

Source facts keep their own lifecycle. The accounting service may read and
snapshot them, but it must not mutate upstream business facts while generating
or posting vouchers. If upstream facts change after a candidate is shown, the
backend must recompute the candidate and reject stale generate requests with
`VOUCHER_SOURCE_CHANGED`.

## 2.2 Accounting Recognition Boundary

The system uses one accounting-voucher ledger, not separate books:

```text
权责事实 -> 权责凭证 -> 已入账 -> 总账
资金事实 -> 资金凭证 -> 已入账 -> 总账
票税事实 -> 权责/税费/调整凭证 -> 已入账 -> 总账
```

`权责凭证` answers whether income, cost, expense, tax, or receivable/payable
should be recognized in a period. `资金凭证` answers whether cash or bank
deposit actually moved. Invoice and tax facts provide evidence and amount
splits; they are not cash facts by themselves.

## 3. Status Model

### Candidate Status

Candidate rows can be:

```text
待生成
需处理
可生成
```

`可生成` is backend-facing wording for a complete candidate that can be
persisted. The frontend may render the same state as `已生成` while it is still a
prototype-only generation row.

### Persisted Voucher Status

Persisted vouchers use:

```text
已生成
已入账
已冲销
```

Rules:

- `已生成` means persisted voucher exists, has a formal voucher number, and is not
  posted yet.
- `已入账` means voucher lines were written to the general ledger.
- `已冲销` means the original voucher has been reversed by a linked reversal
  voucher. Original voucher lines are not edited in place.
- A closed accounting period blocks generation, posting, and reversal.

## 4. Minimal Data Model

### `accounting_periods`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `period` | text | yes | `YYYY-MM`, primary key |
| `status` | enum | yes | `开放`, `已结账` |
| `closed_at` | timestamptz | no | required when closed |
| `closed_by` | uuid | no | operator account |
| `close_reason` | text | no | required for manual close |
| `reopened_at` | timestamptz | no | exceptional reopen only |
| `reopened_by` | uuid | no | exceptional reopen operator |
| `reopen_reason` | text | no | required for reopen |
| `version` | integer | yes | optimistic concurrency |

### `accounting_voucher_sequences`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `period` | text | yes | sequence scope |
| `voucher_kind` | enum | yes | `转账凭证`, `收款凭证`, `付款凭证` |
| `next_sequence` | integer | yes | allocated under row lock |

Unique key: `(period, voucher_kind)`.

Voucher number allocation must happen in the same database transaction that
creates the persisted voucher. Use row-level locking on the sequence row, not
client-generated numbers.

Suggested voucher number format:

```text
记-YYYYMM-0001
收-YYYYMM-0001
付-YYYYMM-0001
```

### `accounting_vouchers`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `voucher_no` | text | yes | unique within period |
| `voucher_kind` | enum | yes | transfer/receipt/payment |
| `business_type` | enum | yes | `权责凭证`, `资金凭证`, `税费凭证`, `调整凭证`, `冲销凭证` |
| `status` | enum | yes | `已生成`, `已入账`, `已冲销` |
| `accounting_period` | text | yes | references `accounting_periods.period` |
| `voucher_date` | date | yes | must fall inside or be explicitly allowed for period |
| `amount` | numeric(18,2) | yes | absolute voucher amount |
| `summary` | text | yes | user-facing summary |
| `source_hash` | text | yes | deterministic hash of source facts used for idempotency |
| `reversal_of_voucher_id` | uuid | no | set on reversal voucher |
| `reversed_by_voucher_id` | uuid | no | set on original voucher after reversal |
| `generated_at` | timestamptz | yes | creation time |
| `generated_by` | uuid | yes | operator |
| `posted_at` | timestamptz | no | set on posting |
| `posted_by` | uuid | no | posting operator |
| `reversed_at` | timestamptz | no | set on original after reversal |
| `reversed_by` | uuid | no | reversal operator |
| `reversal_reason` | text | no | required for reversal |
| `version` | integer | yes | optimistic concurrency |

Required constraints:

- Unique `(accounting_period, voucher_no)`.
- Unique active `source_hash` for non-reversal vouchers to prevent duplicate
  generation from the same source fact.
- `debit_total = credit_total` must be verified before insert and before post.
- `已入账` vouchers cannot update lines, source refs, amount, or period.

### `accounting_voucher_lines`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `voucher_id` | uuid | yes | references `accounting_vouchers.id` |
| `line_no` | integer | yes | stable order |
| `side` | enum | yes | `借方` or `贷方` |
| `subject_code` | text | yes | references accounting subject |
| `subject_name_snapshot` | text | yes | snapshot for audit display |
| `auxiliary_type` | text | no | customer/employee/project/tax/etc. |
| `auxiliary_id` | text | no | optional future reference |
| `auxiliary_name_snapshot` | text | no | snapshot |
| `amount` | numeric(18,2) | yes | positive amount |
| `summary` | text | yes | line summary |

Required indexes:

- `(voucher_id, line_no)`
- `(subject_code, voucher_id)`
- `(auxiliary_type, auxiliary_id)` when auxiliary accounting is later enabled.

### `accounting_voucher_source_refs`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `voucher_id` | uuid | yes | references voucher |
| `source_module` | text | yes | e.g. `应收应付`, `收支流水`, `发票台账`, `税务办理` |
| `source_id` | text | yes | upstream record id |
| `source_no` | text | yes | upstream display no |
| `role` | enum | yes | `主来源`, `发票依据`, `申报依据`, `缴款依据`, `冲销依据` |
| `source_version` | integer | no | source version at generation time |
| `source_hash` | text | yes | hash of source facts used when the voucher was generated |
| `snapshot` | jsonb | yes | minimal immutable display/audit snapshot; no secret values |

Required constraints:

- Unique `(voucher_id, source_module, source_id, role)`.
- `snapshot` must include the user-facing source number/title, source amount,
  accounting period, and source status used for candidate generation.

### `accounting_voucher_invoice_refs`

Invoice facts are first-class references because they carry tax-exclusive
amounts, tax amounts, invoice color, and red/blue invoice relations.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `voucher_id` | uuid | yes | references voucher |
| `invoice_id` | uuid | yes | invoice ledger id |
| `invoice_no` | text | yes | snapshot |
| `direction` | enum | yes | `销项` or `进项` |
| `invoice_color` | enum | yes | `蓝票` or `红票` |
| `invoice_status` | enum | yes | snapshot |
| `tax_excluded_amount` | numeric(18,2) | yes | snapshot |
| `tax_amount` | numeric(18,2) | yes | snapshot |
| `tax_included_amount` | numeric(18,2) | yes | snapshot |
| `declaration_treatment` | text | yes | snapshot |
| `original_invoice_id` | uuid | no | required for red invoice when available |

Required constraints:

- Unique `(voucher_id, invoice_id)`.
- Red invoices that affect a generated voucher must either link an original
  blue invoice or produce `reversal_required` before generation.

### `general_ledger_entries`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `voucher_id` | uuid | yes | references posted voucher |
| `voucher_line_id` | uuid | yes | references voucher line |
| `accounting_period` | text | yes | copied from voucher |
| `voucher_date` | date | yes | copied from voucher |
| `voucher_no` | text | yes | copied from voucher |
| `subject_code` | text | yes | line subject |
| `subject_name_snapshot` | text | yes | snapshot |
| `debit_amount` | numeric(18,2) | yes | 0 or positive |
| `credit_amount` | numeric(18,2) | yes | 0 or positive |
| `auxiliary_type` | text | no | copied from line |
| `auxiliary_id` | text | no | copied from line |
| `summary` | text | yes | copied from line |
| `posted_at` | timestamptz | yes | posting time |

Unique key: `(voucher_line_id)`.

The unique key makes posting idempotent and prevents duplicate ledger writes.

### `general_ledger_subject_balances`

This table is optional as a stored aggregate, but the API contract reserves the
shape because reports and period close need stable subject balances.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `accounting_period` | text | yes | `YYYY-MM` |
| `subject_code` | text | yes | accounting subject |
| `subject_name_snapshot` | text | yes | snapshot |
| `opening_debit` | numeric(18,2) | yes | period opening debit balance |
| `opening_credit` | numeric(18,2) | yes | period opening credit balance |
| `period_debit` | numeric(18,2) | yes | posted debit amount in period |
| `period_credit` | numeric(18,2) | yes | posted credit amount in period |
| `closing_debit` | numeric(18,2) | yes | computed closing debit balance |
| `closing_credit` | numeric(18,2) | yes | computed closing credit balance |
| `updated_at` | timestamptz | yes | last recalculation/posting time |

Unique key: `(accounting_period, subject_code)`.

If the backend does not store this aggregate initially, it must produce the same
response by querying `general_ledger_entries`.

### `accounting_voucher_events`

Append-only operation log:

| Field | Type | Required |
| --- | --- | --- |
| `id` | uuid | yes |
| `voucher_id` | uuid | yes |
| `event_type` | enum | yes |
| `actor_id` | uuid | yes |
| `event_at` | timestamptz | yes |
| `summary` | text | yes |
| `payload` | jsonb | no |

### `accounting_idempotency_keys`

Mutating voucher endpoints must be idempotent.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `idempotency_key` | text | yes | client-generated UUID or server-issued token |
| `scope` | text | yes | endpoint/action scope |
| `request_hash` | text | yes | hash of normalized request body |
| `response_status` | integer | yes | original HTTP status |
| `response_body` | jsonb | yes | original response |
| `created_by` | uuid | yes | operator |
| `created_at` | timestamptz | yes | creation time |
| `expires_at` | timestamptz | yes | retention policy |

Unique key: `(scope, idempotency_key)`.

If the same key is replayed with a different request hash, return
`IDEMPOTENCY_KEY_REPLAY_MISMATCH`.

## 5. API Contract

### List Candidates

`GET /api/finance/accounting-voucher-candidates`

Query:

| Field | Required | Notes |
| --- | --- | --- |
| `period` | no | `YYYY-MM`; omit for all open candidate periods |
| `businessType` | no | voucher business type |
| `status` | no | candidate status |
| `keyword` | no | source/voucher/object search |

Response includes candidate rows with source refs, proposed lines, issue reasons,
source hash, and whether the accounting period is closed.

Candidate response row shape:

```json
{
  "candidateId": "candidate-source-hash",
  "businessType": "权责凭证",
  "voucherKind": "转账凭证",
  "candidateStatus": "可生成",
  "accountingPeriod": "2026-06",
  "voucherDate": "2026-06-30",
  "amount": "68000.00",
  "summary": "确认客户回款收入",
  "sourceHash": "sha256-of-source-facts",
  "sourceRefs": [],
  "invoiceRefs": [],
  "lines": [],
  "issueReasons": [],
  "periodStatus": "开放",
  "alreadyGeneratedVoucherId": null
}
```

If a candidate source hash is already persisted as a non-reversal voucher,
`alreadyGeneratedVoucherId` must be populated and generation must be rejected as
`VOUCHER_ALREADY_GENERATED`.

### Read Candidate Detail

`GET /api/finance/accounting-voucher-candidates/{candidateId}`

Returns the server-recomputed candidate detail, including proposed entries,
source snapshots, invoice/tax/bank evidence, issue reasons, and period status.
This endpoint is the backend equivalent of the current frontend drawer detail
before a voucher is persisted.

### Generate Voucher

`POST /api/finance/accounting-vouchers/generate`

Request:

```json
{
  "candidateId": "candidate-source-hash",
  "sourceHash": "sha256-of-source-facts",
  "idempotencyKey": "client-generated-uuid"
}
```

Backend behavior:

- Recompute the candidate server-side.
- Reject if candidate has blocking issues.
- Reject if period is closed.
- Allocate formal voucher number inside the same transaction.
- Persist voucher, lines, source refs, invoice refs when present, and event log.
- Return persisted voucher in `已生成` status.

### Batch Generate Vouchers

`POST /api/finance/accounting-vouchers/batch-generate`

Request:

```json
{
  "candidateIds": ["candidate-source-hash-1", "candidate-source-hash-2"],
  "idempotencyKey": "client-generated-uuid"
}
```

Backend behavior:

- Recompute every candidate server-side.
- Generate only candidates that are complete and in open periods.
- Run every generated voucher in its own database transaction or return a
  per-row result list; do not partially hide failed rows.
- Return per-candidate status: `generated`, `skipped`, or `failed` with error
  code and source hash.

### Post Voucher

`POST /api/finance/accounting-vouchers/{voucherId}/post`

Request:

```json
{
  "version": 3,
  "idempotencyKey": "client-generated-uuid"
}
```

Backend behavior:

- Lock voucher row.
- Reject if voucher status is not `已生成`.
- Reject if accounting period is closed.
- Verify debit/credit balance again.
- Write one general-ledger entry per voucher line.
- Set voucher status to `已入账`.
- Append event log.

### Batch Post Vouchers

`POST /api/finance/accounting-vouchers/batch-post`

Request:

```json
{
  "voucherIds": ["voucher-id-1", "voucher-id-2"],
  "idempotencyKey": "client-generated-uuid"
}
```

Backend behavior:

- Apply the same validation as single-voucher posting.
- Return per-voucher results.
- Do not post vouchers in closed periods.
- Do not post if debit/credit totals are no longer balanced.

### Reverse Voucher

`POST /api/finance/accounting-vouchers/{voucherId}/reverse`

Request:

```json
{
  "reason": "冲销原因",
  "version": 4,
  "idempotencyKey": "client-generated-uuid"
}
```

Backend behavior:

- Lock original voucher.
- Reject if original voucher is not `已入账`.
- Reject if original accounting period is closed.
- Create a new `冲销凭证` with opposite debit/credit lines.
- Allocate a new formal voucher number.
- Post the reversal voucher in the same transaction, or return it as `已生成`
  only if the product later requires explicit review.
- Mark original voucher `已冲销` and link both voucher ids.

### List Persisted Vouchers

`GET /api/finance/accounting-vouchers`

Returns persisted vouchers only. It does not return candidate rows.

### Read Voucher Detail

`GET /api/finance/accounting-vouchers/{voucherId}`

Returns voucher header, lines, source refs, invoice refs, lifecycle event log,
and linked reversal information.

### General Ledger

`GET /api/finance/general-ledger`

Query:

| Field | Required | Notes |
| --- | --- | --- |
| `period` | no | accounting period |
| `subjectCode` | no | subject filter |
| `auxiliaryType` | no | future auxiliary filter |
| `auxiliaryId` | no | future auxiliary filter |

Returns posted ledger entries only.

### Subject Ledger

`GET /api/finance/general-ledger/subjects/{subjectCode}`

Query:

| Field | Required | Notes |
| --- | --- | --- |
| `periodFrom` | no | inclusive `YYYY-MM` |
| `periodTo` | no | inclusive `YYYY-MM` |
| `auxiliaryType` | no | future auxiliary filter |
| `auxiliaryId` | no | future auxiliary filter |

Returns posted entries for one subject plus opening and closing balance
summaries for the requested range.

### Subject Balances / Trial Balance

`GET /api/finance/general-ledger/balances`

Query:

| Field | Required | Notes |
| --- | --- | --- |
| `period` | yes | `YYYY-MM` |
| `subjectType` | no | asset/liability/equity/cost/profit/loss filter |

Returns one row per accounting subject with opening debit/credit, period
debit/credit, and closing debit/credit. The response must be balanced before
reports or period close can rely on it.

### List Accounting Periods

`GET /api/finance/accounting-periods`

Returns period status, close/reopen metadata, generated voucher count, posted
voucher count, unposted voucher count, blocking candidate count, and trial
balance status.

### Read Period Close Checks

`GET /api/finance/accounting-periods/{period}/close-checks`

Returns:

- unposted vouchers in the period;
- blocking candidate counts by issue reason;
- unresolved bank reconciliation rows that would block funds vouchers;
- tax matters that would block tax vouchers;
- trial-balance status;
- report-readiness summary.

### Close Accounting Period

`POST /api/finance/accounting-periods/{period}/close`

Request:

```json
{
  "reason": "月结",
  "version": 2
}
```

Backend behavior:

- Reject if any persisted voucher in the period is still `已生成`.
- Reject if any required source workflow has unresolved blocking candidate rows
  that the product decides must be closed before month-end.
- Reject if trial balance is not balanced.
- Lock period row.
- Set status to `已结账`.
- Append audit event.

### Reopen Accounting Period

`POST /api/finance/accounting-periods/{period}/reopen`

This is an exceptional operation. It requires elevated permission, reason, and
audit evidence. It is not part of normal frontend flow.

## 6. Error Semantics

| Code | Meaning |
| --- | --- |
| `ACCOUNTING_PERIOD_CLOSED` | Period is closed and blocks mutation |
| `ACCOUNTING_PERIOD_HAS_UNPOSTED_VOUCHERS` | Period close found generated but unposted vouchers |
| `ACCOUNTING_PERIOD_HAS_BLOCKING_CANDIDATES` | Period close found source facts that still block candidate generation |
| `ACCOUNTING_TRIAL_BALANCE_UNBALANCED` | Trial balance is not balanced and blocks period close/report readiness |
| `CANDIDATE_NOT_FOUND` | Candidate id cannot be recomputed from server facts |
| `CANDIDATE_NOT_GENERATABLE` | Candidate status is not complete enough to persist |
| `VOUCHER_SOURCE_CHANGED` | Candidate source hash no longer matches server facts |
| `VOUCHER_HAS_BLOCKING_ISSUES` | Candidate still has issue reasons |
| `VOUCHER_ALREADY_GENERATED` | Source hash already has a persisted active voucher |
| `VOUCHER_NOT_GENERATED` | Posting requires persisted generated voucher |
| `VOUCHER_ALREADY_POSTED` | Duplicate post attempt |
| `VOUCHER_ALREADY_REVERSED` | Duplicate reversal attempt |
| `VOUCHER_UNBALANCED` | Debit and credit totals differ |
| `VOUCHER_SEQUENCE_CONFLICT` | Sequence allocation failed and must retry |
| `IDEMPOTENCY_KEY_REPLAY_MISMATCH` | Same idempotency key was reused with a different request body |
| `SOURCE_FACT_LOCKED` | Source fact is locked by upstream workflow or period close |
| `VERSION_CONFLICT` | Optimistic concurrency version mismatch |

## 7. Authorization And Audit Boundary

Required permission scopes:

- `finance.accountingVoucher.read`
- `finance.accountingVoucher.candidateRead`
- `finance.accountingVoucher.generate`
- `finance.accountingVoucher.batchGenerate`
- `finance.accountingVoucher.post`
- `finance.accountingVoucher.batchPost`
- `finance.accountingVoucher.reverse`
- `finance.accountingPeriod.read`
- `finance.accountingPeriod.close`
- `finance.accountingPeriod.reopen`
- `finance.generalLedger.read`
- `finance.generalLedger.balanceRead`

Every mutating endpoint must write an operation event. Posting, reversal, period
close, and period reopen are financial-control operations and must be separately
auditable.

Audit event minimum payload:

| Field | Required | Notes |
| --- | --- | --- |
| `actorId` | yes | authenticated operator |
| `actorNameSnapshot` | yes | display snapshot |
| `requestId` | yes | request correlation id |
| `idempotencyKey` | no | present for mutating endpoints |
| `beforeStatus` | no | source/voucher/period status before mutation |
| `afterStatus` | no | source/voucher/period status after mutation |
| `sourceHash` | no | candidate/source hash when relevant |
| `reason` | no | required for reversal, period close, and reopen |
| `clientIp` | no | optional, depending on deployment logging policy |

## 8. Transaction And Concurrency Rules

- Generate voucher, allocate voucher number, persist lines/source refs/invoice
  refs, and append the event log in one database transaction.
- Post voucher and write ledger entries in one database transaction.
- Reverse voucher, create reversal voucher, post reversal entries, update the
  original voucher status, and append both event logs in one database
  transaction.
- Close period must lock the `accounting_periods` row before final validation.
- Voucher sequence allocation must lock one `(period, voucher_kind)` row.
- Mutating endpoints require optimistic `version` when a persisted row is
  already visible to the user.
- Re-running the same idempotency key must return the original response.
- Source facts are not edited during voucher operations. If source facts change,
  regenerate candidates and reject stale source hashes.

## 9. Contract Test Matrix

Backend implementation must add contract tests before API readiness is claimed.

| Scenario | Expected result |
| --- | --- |
| complete receivable plus matched output invoice | candidate `可生成`; generate creates transfer voucher with receivable/revenue/tax lines |
| receivable missing output invoice or unbilled treatment | candidate `需处理`; generate returns `VOUCHER_HAS_BLOCKING_ISSUES` |
| completed payable with input invoice under small-scale taxpayer baseline | cost/expense voucher generated without VAT input-deduction line |
| reviewed cash-flow not bank-reconciled | candidate `待生成`; generate returns `CANDIDATE_NOT_GENERATABLE` |
| reviewed and bank-reconciled cash-flow | candidate `可生成`; generate creates receipt/payment voucher |
| bank amount mismatch | candidate `需处理`; no voucher generation until adjustment facts resolve difference |
| completed tax matter missing receipt | candidate `需处理`; generate blocked |
| posting generated voucher | voucher becomes `已入账`; exactly one ledger entry per line |
| duplicate posting request | idempotent replay or `VOUCHER_ALREADY_POSTED`; no duplicate ledger rows |
| reverse posted voucher | linked reversal voucher created; original becomes `已冲销` |
| close period with generated unposted voucher | close returns `ACCOUNTING_PERIOD_HAS_UNPOSTED_VOUCHERS` |
| close period with unbalanced trial balance | close returns `ACCOUNTING_TRIAL_BALANCE_UNBALANCED` |
| closed period generate/post/reverse | mutation returns `ACCOUNTING_PERIOD_CLOSED` |
| changed source hash after candidate display | generate returns `VOUCHER_SOURCE_CHANGED` |

## 10. Frontend API Adapter Boundary

When backend implementation starts, frontend should not call persistence APIs
directly from page components. Add an adapter boundary such as:

```text
financeAccountingVoucherRepository
  listCandidates
  readCandidate
  generateVoucher
  batchGenerateVouchers
  listVouchers
  readVoucher
  postVoucher
  batchPostVouchers
  reverseVoucher
  listAccountingPeriods
  readPeriodCloseChecks
  closePeriod
  listGeneralLedgerEntries
  listSubjectBalances
```

The current `buildAccountingVouchers` frontend model can remain as a mock-data
fallback only. Once API integration starts, page components should consume the
repository response shape instead of reconstructing backend candidates locally.

## 11. Release / Rollback Boundary

Backend rollout must be non-production first.

Minimum release evidence before production use:

- database migration and rollback scripts for all voucher/ledger/period tables;
- seed data that replays at least one accrual, cash, tax, adjustment, and
  reversal path;
- API contract tests for all scenarios in this document;
- permission tests for read/generate/post/reverse/period-close scopes;
- idempotency and sequence-concurrency tests;
- backup/restore drill covering posted vouchers and ledger entries;
- report-readiness proof that trial balance reads only posted ledger entries.

Rollback policy:

- Before production posting is enabled, rollback can drop non-production tables.
- After production posting is enabled, destructive rollback is not allowed.
  Forward-fix with reversal/adjustment vouchers instead.
- Closed periods must not be reopened automatically during rollback.

## 12. Frontend Prototype Mapping

Current frontend mapping:

- Candidate rows are generated by `buildAccountingVouchers`.
- Frontend `已生成` rows are still recalculated candidates.
- Frontend `postAccountingVoucher` simulates backend generation plus posting in
  one session-local action and assigns a mock formal voucher number.
- Frontend `reverseAccountingVoucher` simulates reversal by marking the row
  `已冲销`; backend must create a linked reversal voucher instead.
- Frontend `buildAccountingLedgerEntries` derives ledger rows from session-local
  `已入账` vouchers only.

This mapping is prototype evidence only. Backend implementation must follow the
separated candidate -> persisted voucher -> posted ledger workflow above.

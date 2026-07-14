# Finance Accounting Voucher And General Ledger Contract

Status: `backend_contract_expanded`

Last updated: `2026-07-02`

Owner: `财务管理 / 会计凭证`

Implementation preplan: `docs/governance/finance-accounting-backend-implementation-preplan-v1.md`

Related tax/accounting source contract:
`docs/data/finance-tax-accounting-backend-contract.md`

Related funds-voucher phase 1 backend contract:
`docs/data/finance-funds-voucher-phase1-backend-contract.md`

Related period-close phase 1-3 contracts:

- `docs/api/finance-period-close-api-contract.md`
- `docs/data/finance-period-close-data-contract.md`

## 1. Purpose

This contract defines the backend boundary for accounting voucher persistence,
formal voucher numbers, booking, reversal, accounting-period locks, and general
ledger entries.

It upgrades the frontend prototype from recalculated voucher rows into a future
backend workflow. The current frontend may still show derived rows, but backend
readiness requires persisted records and transaction-safe operations.

## 2. Core Position

There are four separate layers:

| Layer | Meaning | Persistent |
| --- | --- | --- |
| Voucher candidate | Derived from source facts such as receivable/payable, invoice, cash-flow, tax matter, or adjustment | no, query result |
| Accounting voucher | Persisted accounting document with formal voucher number and immutable lines after booking | yes |
| Booking result | State transition from `待记账` candidate to `已记账` voucher snapshot; writes general ledger entries atomically | yes |
| General ledger | Subject-level debit/credit ledger consumed by later reports | yes |

The backend must not treat a frontend candidate row as an official accounting
voucher until the booking operation persists the voucher snapshot and ledger
entries.

## 2.1 Source Fact Boundary

Accounting vouchers are not generated directly from page rows. The backend
voucher service consumes source facts from upstream modules and recomputes
candidate rows server-side.

| Source fact | Upstream owner | Candidate type | Minimum source status | Blocking facts |
| --- | --- | --- | --- | --- |
| Receivable/payable confirmation | `应收应付` | `权责凭证` | confirmation status `已确认` and not voided | missing source document, missing original evidence, missing accounting subject, tax basis pending, invoice/tax amount mismatch |
| Output invoice / input invoice | `发票台账` shared association | supports `权责凭证` or `调整凭证` | invoice status complete enough for accounting treatment and linked to a receivable/payable or business confirmation fact | missing original blue invoice for red invoice, missing tax amount, unmatched issued invoice, unmatched business confirmation |
| System cash-flow row | `收支流水` and `流水复核` | `资金凭证` or `调整凭证` | cash-flow status `已入账` after review | missing voucher file, unreconciled bank statement, missing bank reconciliation source link, bank amount mismatch |
| Bank statement reconciliation | `银行对账` | supports `资金凭证` | reconciliation status `已对账` with a persisted relationship to one or more system cash-flow rows | unmatched bank row, missing relationship row, unresolved difference, duplicate or disputed import |
| Tax matter | `税务办理` | `税费凭证` | filing data confirmed; official filing result, filing date, and filing receipt recorded; social-insurance matters use confirmed contribution schedules | filing result pending, missing filing date or filing receipt, contribution source pending |
| Accounting adjustment | controlled accounting workflow | `调整凭证` | reviewed adjustment source exists | missing reason, missing original voucher/source, closed period |
| Reversal request | `会计凭证` | `冲销凭证` | original voucher status `已记账` | original period closed, already reversed, missing reason |
| Later-period voucher adjustment | `会计凭证` | `调整凭证` | original voucher status `已记账`, original period closed, target period open and later than original period | missing reason, target period closed, target period not later than original period, original voucher already reversed |

Source facts keep their own lifecycle. The accounting service may read and
snapshot them, but it must not mutate upstream business facts while preparing
or booking vouchers. If upstream facts change after a candidate is shown, the
backend must recompute the candidate and reject stale prepare requests with
`VOUCHER_SOURCE_CHANGED`.

Invoice facts used by `权责凭证` must be matched through business/accrual source
references, not through ordinary cash-flow transaction numbers. Receivable/
payable confirmation is the primary accrual fact. A fully matched normal blue
invoice can provide the preferred tax basis, but missing or partial invoicing
does not by itself block accrual recognition when the confirmed source fact
already carries a valid tax basis. Cash-flow transaction refs are valid for
`资金凭证`; they are not the primary link for accrual invoice-tax allocation. The
only current exception is later-invoice handling for previously declared
unbilled income, where the invoice can reference the historical unbilled-income
cash-flow fact as declaration evidence rather than as an ordinary cash matching
relation.

Tax-basis and accounting-subject derivation must move behind the backend
contract in `docs/data/finance-tax-accounting-backend-contract.md`.

Funds-voucher source facts must first follow
`docs/data/finance-funds-voucher-phase1-backend-contract.md`: backend persists
system cash-flow rows, evidence files, cash-flow review events, bank import
rows, and bank reconciliation relationship header/detail rows before the
accounting service reads `资金凭证 / 调整凭证` candidates. Phase 1 candidate reads
are not formal accounting-voucher booking.

The current frontend shared profile
`apps/web/src/features/finance/financeTaxPolicyModel.ts` defines the prototype
taxpayer type, VAT calculation method, default output/input tax rate,
input-tax treatment, VAT declaration threshold/surcharge, and
corporate-income-tax preparation parameters. It is a mock fallback only. Backend
voucher implementation must instead consume versioned `tax_policy_profiles`,
immutable `invoice_tax_facts`, confirmed `receivable_payable_tax_facts`,
effective `finance_category_accounting_mappings`, and active
`accounting_subjects`.

Accounting subjects are system-maintained and business-side read-only.
Finance-category to accounting-subject mappings are finance/system
configuration. Business documents and accounting voucher pages may display
resolved subject snapshots, but they must not expose direct subject selection or
mapping edits. Missing mapping blocks the source fact upstream instead of
falling back to a default subject.

Imported invoice rows remain external invoice facts and keep their own tax
amount. A tax-policy profile controls how those facts are consumed; it must not
overwrite the invoice fact itself. Confirmed receivable/payable tax facts remain
the accrual fallback when invoice evidence is partial or pending.

## 2.2 Accounting Recognition Boundary

The system uses one accounting-voucher ledger, not separate books:

```text
权责事实 -> 权责凭证 -> 已记账 -> 总账
资金事实 -> 资金凭证 -> 已记账 -> 总账
票税事实 -> 权责/税费/调整凭证 -> 已记账 -> 总账
```

`权责凭证` answers whether income, cost, expense, tax, or receivable/payable
should be recognized in a period. `资金凭证` answers whether cash or bank
deposit actually moved. Invoice and tax facts provide evidence and amount
splits; they are not cash facts by themselves.

Tax-matter accrual vouchers use the tax matter's statutory/business period
mapped to the closing accounting month, such as `2026-Q1 -> 2026-03`. The
voucher date may still be the declaration or confirmation date. Linked tax
payment cash-flow vouchers stay in the actual payment transaction's accounting
period, so a Q1 tax accrual and its April payment are separate accounting
period facts.

## 3. Status Model

### Candidate Status

Candidate rows can be:

```text
待生成
需处理
待记账
```

`待记账` means source facts are complete enough to create a formal accounting
voucher. Candidate rows are still derived query results and are not official
accounting vouchers.

### Persisted Voucher Status

Persisted vouchers use:

```text
已记账
已冲销
```

Rules:

- `已记账` means the voucher has a formal voucher number and its lines were
  written to the general ledger.
- `已冲销` means the original voucher has been reversed by a linked reversal
  voucher. Original voucher lines are not edited in place.
- A closed accounting period blocks candidate booking and reversal.
- Corrections for a booked voucher in a closed historical period must create a
  later-period adjustment source fact in an open later period. The original
  voucher remains historical evidence and is not marked `已冲销` by that flow.
- Later-period adjustment source-fact creation is not a booking action. It
  creates a target-period `调整凭证` candidate that is `待记账` when the generated
  entries are complete and balanced. The candidate must still be booked through
  the ordinary voucher lifecycle before it affects the target-period general
  ledger.
- If the target adjustment period is locked or closed, the later-period
  adjustment request must be rejected and must not create an adjustment source
  fact.
- The frontend prototype also applies the same session-local closed-period guard
  to major source mutation entry points, including receivable/payable settlement,
  invoice-ledger import, invoice matching, declaration-preparation decisions,
  cash-flow review, bank reconciliation confirmation, tax payment flow
  generation, reimbursement approval into payables, employee collection
  submission, and cash-flow correction creation. This is a user experience and
  model-consistency guard only; backend mutation APIs must still reject
  closed-period writes with a stable error code such as
  `CLOSED_ACCOUNTING_PERIOD`.
- For period-close phase 1-3 backend planning, `CLOSED_ACCOUNTING_PERIOD` is the
  canonical guard error code. Earlier draft wording such as
  `ACCOUNTING_PERIOD_CLOSED` is not a separate production contract.
- There is no persisted voucher approval/review status in the current contract.
  Review-style behavior must be modeled as source-fact readiness, issue reasons,
  permissions, or operation events, not as `待审核` / `已审核` voucher states.

### Operator And Time Authority

For persisted accounting vouchers, responsibility fields are server-owned:

- `booked_by` and `booked_at` are written by the backend when a `待记账`
  candidate is booked into a formal voucher and general-ledger entries are
  written.
- `reversed_by` and `reversed_at` are written by the backend when reversal
  succeeds.
- Clients must not provide or override these actor/time fields in mutating
  request bodies.

Actor fields must resolve from the authenticated account and store display
snapshots for audit readability, such as name, account, and employee number
when available. Time fields must use trusted server time. Frontend mock data may
display session-local examples, but backend integration must not trust client
clock or client-supplied operator names.

## 4. Minimal Data Model

### `accounting_periods`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `period` | text | yes | `YYYY-MM`, primary key |
| `status` | enum | yes | `开放`, `已结账`, `已反结账` |
| `closed_at` | timestamptz | no | required when closed |
| `closed_by` | uuid | no | operator account |
| `close_reason` | text | no | required for manual close |
| `reopened_at` | timestamptz | no | exceptional reopen only |
| `reopened_by` | uuid | no | exceptional reopen operator |
| `reopen_reason` | text | no | required for reopen |
| `version` | integer | yes | optimistic concurrency |

Phase 1-3 period-close persistence expands this minimal table with close-check
snapshot references, actor display snapshots, event links, and source-version
hashes in `docs/data/finance-period-close-data-contract.md`. The frontend
session `AccountingPeriodLockRecord` is not persistence evidence.

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
| `status` | enum | yes | `已记账`, `已冲销` |
| `accounting_period` | text | yes | references `accounting_periods.period`; source-fact recognition period, not automatically equal to voucher date or booking time |
| `voucher_date` | date | yes | must fall inside or be explicitly allowed for period |
| `amount` | numeric(18,2) | yes | absolute voucher amount |
| `summary` | text | yes | user-facing summary |
| `source_hash` | text | yes | deterministic hash of source facts used for idempotency |
| `reversal_of_voucher_id` | uuid | no | set on reversal voucher |
| `reversed_by_voucher_id` | uuid | no | set on original voucher after reversal |
| `booked_at` | timestamptz | yes | set when the candidate is booked into a formal voucher |
| `booked_by` | uuid | yes | booking operator |
| `booked_by_snapshot` | jsonb | yes | display snapshot at booking time |
| `reversed_at` | timestamptz | no | set on original after reversal |
| `reversed_by` | uuid | no | reversal operator |
| `reversed_by_snapshot` | jsonb | no | display snapshot at reversal time |
| `reversal_reason` | text | no | required for reversal |
| `version` | integer | yes | optimistic concurrency |

Required constraints:

- Unique `(accounting_period, voucher_no)`.
- Unique active `source_hash` for non-reversal vouchers to prevent duplicate
  booking from the same source fact.
- `debit_total = credit_total` must be verified before booking insert.
- `已记账` vouchers cannot update lines, source refs, amount, or period.

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
| `source_module` | text | yes | e.g. `应收应付`, `收支流水`, `发票台账`, `税务办理`, `银行对账` |
| `source_id` | text | yes | upstream record id |
| `source_no` | text | yes | upstream display no |
| `role` | enum | yes | `主来源`, `发票依据`, `申报依据`, `资金结算依据`, `银行依据`, `冲销依据`, `调整依据` |
| `source_version` | integer | no | source version at generation time |
| `source_hash` | text | yes | hash of source facts used when the voucher was prepared |
| `source_tax_fact_id` | uuid | no | receivable/payable tax fact used by accrual candidates |
| `tax_policy_profile_id` | uuid | no | tax policy profile snapshot reference |
| `category_accounting_mapping_id` | uuid | no | finance-category accounting mapping snapshot reference |
| `snapshot` | jsonb | yes | minimal immutable display/audit snapshot; no secret values |

Required constraints:

- Unique `(voucher_id, source_module, source_id, role)`.
- `snapshot` must include the user-facing source number/title, source amount,
  accounting period, and source status used for candidate generation.
- Accrual source snapshots should include the source tax fact id, tax-policy
  profile id, and category-accounting mapping id when those facts were used.

### `accounting_voucher_later_period_adjustments`

This table is the persisted source fact for correcting a booked voucher whose
original accounting period is already closed. It is not a reversal voucher, not
a mutation of the original voucher, and not a direct ledger entry.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `original_voucher_id` | uuid | yes | references original booked voucher |
| `original_voucher_no` | text | yes | display snapshot |
| `original_accounting_period` | text | yes | closed historical period |
| `original_voucher_snapshot` | jsonb | yes | immutable header/line summary used as adjustment basis |
| `adjustment_period` | text | yes | target period; must be later than original period and unlocked |
| `adjustment_date` | date | yes | must belong to or be explicitly allowed for target period |
| `reason` | text | yes | display-safe correction reason |
| `voucher_status` | enum | yes | `pending_booking` or `booked`; `pending_booking` maps to target candidate `待记账` when complete |
| `voucher_id` | uuid | no | populated after the target-period adjustment voucher is booked |
| `source_hash` | text | yes | deterministic hash for candidate generation and idempotency checks |
| `created_at` | timestamptz | yes | server time |
| `created_by` | uuid | yes | authenticated operator |
| `created_by_snapshot` | jsonb | yes | display snapshot |
| `version` | integer | yes | optimistic concurrency |

Required constraints:

- Original voucher must be `已记账`.
- Original voucher must not be a reversal voucher and must not already be
  reversed.
- Original accounting period must be `已结账`.
- Target adjustment period must be later than the original accounting period
  and unlocked. Current V1 contract treats `accounting_periods.status = 开放`
  as the accepted target state.
- Target period `已结账` returns `CLOSED_ACCOUNTING_PERIOD`. Missing or not-later
  target period returns `VOUCHER_ADJUSTMENT_PERIOD_INVALID`.
- Rejecting the request must not create an adjustment source fact and must not
  mutate the original voucher.
- Creating this source fact must not write `reversed_by_voucher_id`, must not
  change the original voucher status to `已冲销`, must not update original
  voucher lines, and must not rewrite historical `general_ledger_entries`.
- The candidate service must expose a target-period `调整凭证` row from this
  source fact. A complete and balanced row is `待记账` and blocks closing the
  target period until the voucher lifecycle resolves it.
- Preparing the target-period adjustment voucher must reference the original
  voucher through `accounting_voucher_source_refs.role = 调整依据`.

### `bank_reconciliation_links`

Bank reconciliation is an independent relationship table, not a text field on a
cash-flow row. A single imported bank statement row can confirm one system
cash-flow row, or a group of system rows when a reviewed adjustment offsets a
bank amount difference.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `bank_statement_id` | uuid | yes | imported bank statement row |
| `bank_serial_no` | text | yes | immutable bank serial/display no snapshot |
| `bank_statement_date` | date | yes | bank transaction date |
| `batch_no` | text | yes | bank import batch |
| `public_account_id` | uuid | yes | company public account |
| `public_account_snapshot` | jsonb | yes | account display snapshot used at confirmation time |
| `direction` | enum | yes | `入账` or `出账` |
| `amount` | numeric(18,2) | yes | bank statement amount |
| `relation_source` | enum | yes | `auto_match`, `manual_confirm`, `bank_generated_flow`, or `amount_adjustment` |
| `status` | enum | yes | `active` or `removed` |
| `confirmed_at` | timestamptz | yes | confirmation time |
| `confirmed_by` | uuid | yes | operator account |
| `removed_at` | timestamptz | no | set when a confirmed relationship is reversed/removed |
| `removed_by` | uuid | no | operator account for removal |
| `remove_reason` | text | no | required when status is `removed` |
| `version` | integer | yes | optimistic concurrency |

Required constraints:

- Unique active `(bank_statement_id)`: one bank statement row cannot be confirmed
  into multiple unrelated reconciliation groups.
- `public_account_id`, direction, and signed amount must reconcile with linked
  system rows before the link is confirmed.
- Confirmed links are append/audit friendly. If a relationship is wrong, revoke
  the link and create a new one; do not silently mutate the original link.

### `bank_reconciliation_link_transactions`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `bank_reconciliation_link_id` | uuid | yes | references `bank_reconciliation_links.id` |
| `finance_transaction_id` | uuid | yes | reviewed system cash-flow row |
| `finance_transaction_no` | text | yes | display no snapshot |
| `role` | enum | yes | `主流水`, `补差流水`, `冲正流水` |
| `amount` | numeric(18,2) | yes | linked system row amount snapshot |
| `direction` | enum | yes | system row direction snapshot: `收入` or `支出` |
| `source_type` | text | yes | system row source type snapshot |

Required constraints:

- Unique active `(finance_transaction_id)`: one system cash-flow row cannot be
  reconciled by multiple active bank links.
- The accounting-voucher candidate service must require both
  `finance_transactions.status = 已入账` and an active bank reconciliation link
  before returning a `待记账` funds voucher.

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
- Red invoices that affect a booked voucher must either link an original
  blue invoice or produce `reversal_required` before booking.

### `general_ledger_entries`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `voucher_id` | uuid | yes | references booked voucher |
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
| `booked_at` | timestamptz | yes | booking time |

Unique key: `(voucher_line_id)`.

The unique key makes booking idempotent and prevents duplicate ledger writes.

### `account_sets`

The active account set defines the accounting standard, taxpayer profile,
currency, and first enabled period used by accounting subjects, opening
balances, voucher booking, period close, and statutory reports.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `name` | text | yes | account-set name |
| `accounting_standard` | enum | yes | current frontend target: `small_business_accounting_standard` |
| `taxpayer_type` | enum | yes | current frontend target: `small_scale_taxpayer` |
| `base_currency` | text | yes | current frontend target: `CNY` |
| `first_enabled_period` | text | yes | `YYYY-MM` |
| `period_mode` | enum | yes | current frontend target: `monthly` |
| `status` | enum | yes | `not_started`, `basic_configured`, `subjects_confirmed`, `opening_recorded`, `trial_balanced`, `trial_unbalanced`, `enabled`, or `disabled` |
| `trial_balance_difference` | numeric(18,2) | yes | latest initialization trial-balance difference |
| `locked_at` | timestamptz | no | set when initialization is enabled and locked |
| `enabled_at` | timestamptz | no | set when account set is enabled |
| `enabled_by` | uuid | no | operator account |
| `created_at` | timestamptz | yes | creation time |
| `created_by` | uuid | yes | operator or system account |

Rules:

- Only one account set is active for the frontend company scope in the first
  backend version.
- Voucher preparation and booking must use the active account set's accounting
  subject catalog and enabled periods.
- Account-set enablement must be blocked while status is `trial_unbalanced` or
  while opening balances are missing required subject or auxiliary details.
- When status becomes `enabled`, account-set base settings and first-period
  opening balances are locked for normal business users. Corrections after
  enablement require a controlled opening-adjustment, reopen, or migration
  workflow rather than direct edits.
- Enablement withdrawal is only valid for a just-enabled account set that has no
  prepared/booked voucher, no general-ledger read dependency, and no locked
  accounting period. It returns the account set to `trial_balanced`; it must not
  delete the historical enablement event.
- Business pages may display the active account-set profile, but business users
  must not edit accounting standard, taxpayer type, or base currency.

### `account_set_initialization_events`

Initialization events provide the audit trail for how the first enabled account
set was configured and locked.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `account_set_id` | uuid | yes | account set |
| `event_type` | enum | yes | `save_basic_settings`, `confirm_subjects`, `record_opening_balances`, `run_trial_balance`, `enable_account_set`, `withdraw_enablement`, or `request_opening_adjustment` |
| `result_status` | enum | yes | resulting account-set initialization status |
| `summary` | text | yes | human-readable operation summary |
| `operated_at` | timestamptz | yes | server operation time |
| `operated_by` | uuid | yes | operator account |

Rules:

- The frontend `账套初始化` workbench may display these events as operation
  records, but clients must not submit operator/time snapshots directly.
- Trial-balance events must persist the debit total, credit total, and
  difference either in event detail or linked validation output.
- `withdraw_enablement` events must include a withdraw reason and impact summary.
  They are allowed only while no downstream voucher, ledger read, or period-lock
  dependency exists.
- `request_opening_adjustment` events must reference the generated opening
  adjustment record and do not mutate the original opening-balance rows.

### `account_set_opening_adjustments`

Opening adjustments are the post-enablement correction entry point. They are
not direct edits to `general_ledger_opening_balances`; they produce a voucher
candidate that will later be booked and read by the general ledger.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `account_set_id` | uuid | yes | account set |
| `accounting_period` | text | yes | opening period being corrected |
| `subject_code` | text | yes | accounting subject |
| `subject_name_snapshot` | text | yes | snapshot |
| `balance_side` | enum | yes | `debit` or `credit` |
| `amount` | numeric(18,2) | yes | positive adjustment amount |
| `reason` | text | yes | display-safe correction reason |
| `evidence_name` | text | yes | source evidence or document reference |
| `voucher_status` | enum | yes | `pending_booking` or `booked` |
| `voucher_id` | uuid | no | populated after accounting voucher booking |
| `created_at` | timestamptz | yes | server time |
| `created_by` | uuid | yes | operator account |

Rules:

- An opening adjustment can be created only after the account set is enabled and
  the target accounting period is not locked.
- Creating an opening adjustment must not rewrite the original enabled opening
  balance row.
- Accounting-voucher booking must turn the adjustment into a formal adjustment
  voucher before the general ledger can consume it.
- The frontend prototype currently creates the candidate as source module
  `账套初始化`, source type `期初调整`, business type `调整凭证`, with the adjusted
  subject on the selected debit/credit side and `3104 利润分配` on the opposite
  side. Backend implementation should either persist an explicit contra subject
  on `account_set_opening_adjustments` or centralize that mapping in accounting
  rules before production use.

### `general_ledger_opening_balances`

Opening balances are period facts. They can be imported during cutover or
derived from the previous closed period. The frontend must not treat static
opening numbers as accounting evidence.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `accounting_period` | text | yes | `YYYY-MM`; opening period |
| `subject_code` | text | yes | accounting subject |
| `subject_name_snapshot` | text | yes | snapshot |
| `opening_debit` | numeric(18,2) | yes | debit-side opening balance |
| `opening_credit` | numeric(18,2) | yes | credit-side opening balance |
| `source_type` | enum | yes | `account_set_initialization`, `initial_import`, or `prior_period_close` |
| `source_period` | text | no | previous period when source is prior close |
| `source_ref` | text | no | import batch or close event id |
| `created_at` | timestamptz | yes | creation time |
| `created_by` | uuid | yes | operator or system account |

Unique key: `(accounting_period, subject_code)`.

Rules:

- For a closed prior period, the next period opening balance must equal the
  prior period closing balance unless an audited adjustment/reopen workflow is
  used.
- For the first system period, opening balances must come from a controlled
  account-set initialization, import, or migration record.
- Opening-balance rows may originate from manual entry, import application, or
  system-carried source data. That entry source is display/audit context; the
  general ledger still reads the final enabled opening-balance fact.
- Import application must update or add matching imported rows into the current
  opening-balance draft and must not discard rows that were manually entered or
  carried from upstream system facts.
- Account-set enablement must be blocked until opening-balance validation has no
  blocking issues and the opening debit and credit totals are balanced.
- Opening balances are read-only from the general-ledger page.

### `account_set_opening_balance_import_batches`

Opening-balance import batches are staging records. They are not general-ledger
facts until applied into the account set's opening-balance draft and the account
set is enabled.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `account_set_id` | uuid | yes | account set |
| `accounting_period` | text | yes | opening period |
| `file_name` | text | yes | original uploaded file name |
| `status` | enum | yes | `previewed`, `validation_failed`, `applied`, `voided` |
| `preview_row_count` | integer | yes | parsed rows |
| `blocking_issue_count` | integer | yes | validation blockers at preview time |
| `imported_at` | timestamptz | yes | server time |
| `imported_by` | uuid | yes | operator account |
| `applied_at` | timestamptz | no | server time after application |
| `applied_by` | uuid | no | operator account |

Rules:

- The first backend version may reject unsupported file formats and mixed account
  sets before creating a preview batch.
- Applying a batch is a controlled mutation on the opening-balance draft. It must
  fail if the account set is already `enabled`.
- Applying a batch must be idempotent by batch id or idempotency key.

### `account_set_opening_balance_validation_items`

Validation output is persisted so the frontend can show why the account set can
or cannot move to trial balance or enablement.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `account_set_id` | uuid | yes | account set |
| `import_batch_id` | uuid | no | present for import preview validation |
| `accounting_period` | text | yes | opening period |
| `subject_code` | text | no | related subject if row-level |
| `status` | enum | yes | `passed` or `requires_handling` |
| `severity` | enum | yes | `info`, `warning`, or `error` |
| `blocking` | boolean | yes | true blocks enablement |
| `message` | text | yes | display-safe explanation |
| `validated_at` | timestamptz | yes | server time |

Blocking examples: missing or disabled subject, invalid amount, both debit and
credit on one row, duplicated subject/auxiliary opening row, and trial-balance
difference.

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
| `period_debit` | numeric(18,2) | yes | booked debit amount in period |
| `period_credit` | numeric(18,2) | yes | booked credit amount in period |
| `closing_debit` | numeric(18,2) | yes | computed closing debit balance |
| `closing_credit` | numeric(18,2) | yes | computed closing credit balance |
| `updated_at` | timestamptz | yes | last recalculation/booking time |

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
  "candidateStatus": "待记账",
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
  "bookedVoucherId": null
}
```

If a candidate source hash is already persisted as a non-reversal voucher,
`bookedVoucherId` must be populated and booking must be rejected as
`VOUCHER_ALREADY_BOOKED`.

### Read Candidate Detail

`GET /api/finance/accounting-voucher-candidates/{candidateId}`

Returns the server-recomputed candidate detail, including proposed entries,
source snapshots, invoice/tax/bank evidence, issue reasons, and period status.
This endpoint is the backend equivalent of the current frontend drawer detail
before a voucher is persisted.

### Book Candidate As Voucher

`POST /api/finance/accounting-voucher-candidates/{candidateId}/book`

Request:

```json
{
  "sourceHash": "sha256-of-source-facts",
  "idempotencyKey": "client-generated-uuid"
}
```

Backend behavior:

- Recompute the candidate server-side.
- Reject if candidate has blocking issues.
- Reject if period is closed.
- Verify debit/credit balance again.
- Allocate formal voucher number inside the same transaction.
- Persist voucher, lines, source refs, invoice refs when present, server-owned
  `booked_by` / `booked_by_snapshot` / `booked_at`, general-ledger entries, and
  event log.
- Return persisted voucher in `已记账` status.

### Batch Book Candidates

`POST /api/finance/accounting-voucher-candidates/batch-book`

Request:

```json
{
  "candidateIds": ["candidate-source-hash-1", "candidate-source-hash-2"],
  "idempotencyKey": "client-generated-uuid"
}
```

Backend behavior:

- Recompute every candidate server-side.
- Book only candidates that are complete and in open periods.
- Run every booked voucher in its own database transaction or return a
  per-row result list; do not partially hide failed rows.
- Return per-candidate status: `booked`, `skipped`, or `failed` with error
  code and source hash.

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
- Reject if original voucher is not `已记账`.
- Reject if original accounting period is closed.
- Create a new `冲销凭证` with opposite debit/credit lines.
- Allocate a new formal voucher number.
- Book the reversal voucher in the same transaction.
- Mark original voucher `已冲销`, write server-owned
  `reversed_by` / `reversed_by_snapshot` / `reversed_at`, and link both voucher ids.

### Create Later-Period Adjustment Source

`POST /api/finance/accounting-vouchers/{voucherId}/later-period-adjustments`

Request:

```json
{
  "adjustmentPeriod": "2026-07",
  "adjustmentDate": "2026-07-01",
  "reason": "历史期间收入确认口径需要在后续期间调整",
  "version": 4,
  "idempotencyKey": "client-generated-uuid"
}
```

Backend behavior:

- Lock the original voucher row.
- Reject if original voucher status is not `已记账`.
- Reject if original voucher is itself a reversal voucher or already reversed.
- Require the original voucher accounting period to be closed.
- Require `adjustmentPeriod` to be later than the original accounting period.
- Reject if the target adjustment period is closed.
- Create a later-period adjustment source fact that references the original
  voucher id, original voucher number, original accounting period, reason,
  server-owned actor snapshot, and server-owned timestamp.
- Return a recomputed `调整凭证` candidate in the target adjustment period.
- Do not mutate original voucher status, original voucher lines, or historical
  general-ledger entries.
- The returned adjustment candidate must still pass the ordinary prepare and
  book flow before it affects the target-period general ledger.
- Current local row-backed gateway evidence writes the adjustment source fact,
  idempotency record, event, and target-period `待记账` voucher row to
  candidate state, and the target period close-check/close routes consume that
  row as a `voucher_preparation` blocker. This is still local contract evidence,
  not SQL persistence or production voucher repository evidence.

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

Returns booked ledger entries only.

### Subject Ledger

`GET /api/finance/general-ledger/subjects/{subjectCode}`

Query:

| Field | Required | Notes |
| --- | --- | --- |
| `periodFrom` | no | inclusive `YYYY-MM` |
| `periodTo` | no | inclusive `YYYY-MM` |
| `auxiliaryType` | no | future auxiliary filter |
| `auxiliaryId` | no | future auxiliary filter |

Returns booked entries for one subject plus opening and closing balance
summaries for the requested range.

### Subject Balances / Trial Balance

`GET /api/finance/general-ledger/balances`

Query:

| Field | Required | Notes |
| --- | --- | --- |
| `period` | yes | `YYYY-MM`; one accounting period only |
| `subjectType` | no | asset/liability/equity/cost/profit/loss filter |

Returns one row per accounting subject with opening debit/credit, period
debit/credit, and closing debit/credit. The response must be balanced before
reports or period close can rely on it.
Frontend display may derive a compact `借方余额 / 贷方余额 / 平` label from those
debit/credit balances, but it must not turn opposite-side balances into raw
negative amounts.

Response boundary:

```json
{
  "period": "2026-06",
  "periodStatus": "开放",
  "trialBalanceStatus": "平衡",
  "trialBalanceDifference": "0.00",
  "openingBalanceSource": "period_opening_balance",
  "bookedVoucherCount": 12,
  "entryCount": 36,
  "debitTotal": "128000.00",
  "creditTotal": "128000.00",
  "rows": [
    {
      "subjectCode": "1002",
      "subjectName": "银行存款",
      "subjectType": "资产类",
      "balanceDirection": "借方",
      "statementTarget": "资产负债表",
      "reportItem": "货币资金",
      "openingDebit": "252669.48",
      "openingCredit": "0.00",
      "periodDebit": "9800.00",
      "periodCredit": "3280.52",
      "closingDebit": "259188.96",
      "closingCredit": "0.00",
      "entryCount": 2,
      "voucherCount": 2
    }
  ]
}
```

Rules:

- The subject-balance endpoint is period-first. It must not accept an unbounded
  `all periods` balance query.
- Period status comes from `accounting_periods`, not from frontend state.
- Opening balances are supplied by persisted period opening balances or by the
  previous closed period's closing balances. They must not be recalculated from
  arbitrary frontend snapshots.
- `trialBalanceStatus` must be calculated from all booked entries and opening
  balances in the requested period before UI-side subject/keyword filtering.
- The general-ledger UI may filter visible subject rows, but filtering must not
  change period-level debit, credit, or trial-balance totals.
- Closed periods are read-only. They remain queryable by general-ledger APIs,
  but prepare/book/reverse and source mutations must be blocked by the period
  close rules above.

### Financial Statement Readiness And Snapshot Contract

This is a backend-targeted contract boundary. It is currently represented by
`apps/api/src/finance/financialStatementContract.ts` and
`financialStatementContract.test.ts`, plus the framework-agnostic
`financialStatementRoutes.ts` route adapter and `financialStatementRoutes.test.ts`.
It is not yet a listening HTTP endpoint, database table, persisted report
repository, archive service, or production report evidence.

Future API shape:

```text
GET  /api/finance/financial-statements/{period}/readiness
POST /api/finance/financial-statements/{period}/snapshots
GET  /api/finance/financial-statements/{period}/snapshots/latest
```

Route-level behavior:

- `GET readiness` requires `finance.financialStatement.read` and returns the
  computed readiness, period status, existing snapshot hash when present, and
  `canGenerateFormalSnapshot`.
- `POST snapshots` requires `finance.financialStatement.generate`. If a
  snapshot already exists for the period, the route returns that snapshot instead
  of rewriting it.
- Snapshot generation may include displayed-readiness guards:
  `expectedSourceLedgerHash` and `expectedCashFlowMappingVersionHash`. If either
  value no longer matches the server recomputation, return
  `FINANCIAL_STATEMENT_READINESS_STALE` and do not create a snapshot.
- `GET snapshots/latest` requires `finance.financialStatement.read` and returns
  the persisted snapshot instead of recomputing historical rows.

Readiness must be derived from booked ledger entries and accounting-subject
report mappings. It must not derive final statement rows from receivable/payable,
cash-flow, invoice, tax, payroll, or social-insurance source rows directly.

Cash-flow statement readiness has an additional mapping boundary:

```text
booked cash/bank ledger entry
-> same-voucher non-cash counterpart subject
-> effective cash-flow statement mapping on that counterpart subject
-> cash-flow statement line
```

Required cash-flow mapping fields:

| Field | Required | Notes |
| --- | --- | --- |
| `subject_code` | yes | non-cash counterpart accounting subject |
| `activity` | yes | operating, investing, or financing activity |
| `item` | yes | cash-flow statement line item |
| `effective_period` | yes | first accounting period where the mapping is valid |
| `version` | yes | mapping version used for snapshot hash |
| `status` | yes | active/inactive |
| `created_by_snapshot` | yes | operator display snapshot |
| `created_at` | yes | server time |

Rules:

- Cash and bank subjects such as `1001`, `1002`, and `1012` carry the cash
  movement; their non-cash counterpart subjects carry the cash-flow statement
  item mapping.
- Mapping resolution is period-scoped. The latest active mapping with
  `effective_period <= requested period` wins for each subject.
- Missing counterpart mapping blocks formal statement snapshot generation and
  returns `CASH_FLOW_MAPPING_INCOMPLETE`.
- Formal statement snapshots can be generated only after the accounting period
  is `已结账`; otherwise the operation returns
  `FINANCIAL_STATEMENT_PERIOD_NOT_CLOSED`.
- A generated snapshot must persist the source ledger hash and the cash-flow
  mapping version hash. Later mapping changes must not mutate the historical
  snapshot.
- Trial or frontend-session report previews may be shown before close, but they
  must be labeled as trial/readback views and must not be represented as formal
  backend snapshots.

### List Accounting Periods

`GET /api/finance/accounting-periods`

Returns period status, close/reopen metadata, booked voucher count, unbooked
voucher-matter count, blocking candidate count, and trial
balance status.

`bookedVoucherCount` means persisted formal vouchers already written to the
general ledger. `unbookedVoucherCount` means `待记账` voucher matters that still
block period close.

### Read Period Close Checks

`GET /api/finance/accounting-periods/{period}/close-checks`

Detailed API fields are defined in
`docs/api/finance-period-close-api-contract.md`. Data persistence fields are
defined in `docs/data/finance-period-close-data-contract.md`.

The backend response must include:

- unbooked vouchers in the period;
- blocking candidate counts by issue reason;
- unresolved source-module readiness facts represented by owner modules or
  accounting-voucher candidates;
- unresolved bank reconciliation rows that would block funds vouchers;
- tax-handling and salary-social-insurance matters that would block tax or
  social-insurance vouchers;
- trial-balance status;
- financial-statement readiness summary derived from the same formal-statement
  readiness contract that validates booked ledger entries and cash-flow item
  mappings;
- stable source refs for each blocker, including source module and source
  number;
- backend-owned `canClose`.

Required check groups:

```text
voucher_preparation
voucher_booking
general_ledger_trial_balance
financial_statements
cash_review
cash_reconciliation
tax_handling
social_insurance_housing_fund
```

Rules:

- Any blocking check makes `canClose=false`.
- The frontend must not recompute final `canClose`.
- Repeated reads over the same persisted source versions must return the same
  check statuses, blocker source refs, `canClose`, and `checkSnapshotHash`.

Frontend prototype mapping:

- `/finance/period-close` is the restrained period-close workbench after
  `/finance/general-ledger`.
- `financePeriodCloseModel.ts` derives close checks from frontend-session
  accounting vouchers, booked ledger entries, reviewed cash-flow rows,
  pending-review cash-flow rows, tax-handling matter rows,
  salary-social-insurance matter rows, financial-statement readiness, and period
  locks.
- Quarterly or annual tax-handling periods are mapped into the accounting month
  that closes the statutory period, for example `2026-Q2 -> 2026-06`.
- The prototype checks user-facing control groups for voucher source and
  preparation, voucher booking, general-ledger trial balance, financial
  statements, cash-flow review, cash reconciliation, tax handling, and
  social-insurance/housing-fund handling.
- Confirming close opens a frontend confirmation drawer, requires a close
  reason, and writes a frontend-session `AccountingPeriodLockRecord`.
  This is not backend persistence, but the same lock array is consumed by
  voucher prepare/book/reversal guards and by the general-ledger period status.
- The page intentionally does not expose reopen/reverse-close. Backend reopen
  remains an exceptional audited operation.

### Close Accounting Period

`POST /api/finance/accounting-periods/{period}/close`

Request:

```json
{
  "reason": "月结",
  "version": 2,
  "idempotencyKey": "period-close-2026-06-operator-001",
  "expectedCheckSnapshotHash": "sha256:..."
}
```

Backend behavior:

- Lock the `accounting_periods` row before final validation.
- Validate optimistic `version` and idempotency replay semantics.
- Rerun backend close checks in the same close control flow; do not rely only
  on a previously displayed frontend result.
- Reject if any voucher matter in the period is still `待记账`.
- Reject if any required source workflow has unresolved blocking candidate rows
  that the product decides must be closed before month-end.
- Reject if reviewed cash-flow rows in the period still require bank
  reconciliation before they can support funds-voucher completeness.
- Reject if tax-handling matters and salary-social-insurance matters that are required for the accounting period are unfinished.
- Reject if trial balance is not balanced.
- Reject if financial-statement readiness finds booked cash/bank voucher
  counterpart subjects without effective cash-flow item mappings; this feeds the
  `financial_statements` close-check group and must not be recomputed from
  receivable/payable, cash-flow, invoice, or salary source rows.
- Persist the close-check snapshot used by the close.
- Set status to `已结账`.
- Save close actor/time/reason from server context.
- Append audit event.
- Return latest period status, version, close event id, and check snapshot id.

### Reopen Accounting Period

`POST /api/finance/accounting-periods/{period}/reopen`

This is an exceptional operation. It requires elevated permission, reason, and
audit evidence. It is not part of normal frontend flow.

## 6. Error Semantics

| Code | Meaning |
| --- | --- |
| `CLOSED_ACCOUNTING_PERIOD` | Period is closed and blocks source, voucher, or period-affecting mutation |
| `ACCOUNTING_PERIOD_ALREADY_CLOSED` | Close request targets an already closed period with a different idempotency context |
| `ACCOUNTING_PERIOD_HAS_UNBOOKED_VOUCHERS` | Period close found `待记账` voucher matters |
| `ACCOUNTING_PERIOD_HAS_BLOCKING_CANDIDATES` | Period close found source facts that still block candidate generation |
| `PERIOD_CLOSE_CHECKS_BLOCKED` | Backend close checks returned `canClose=false` |
| `PERIOD_CLOSE_SNAPSHOT_STALE` | Client-provided close-check hash no longer matches rerun checks |
| `PERIOD_CLOSE_IN_PROGRESS` | Concurrent close operation is already holding the period lock |
| `PERIOD_REOPEN_FORBIDDEN` | Reopen is not allowed by permission, sequence, or downstream-period rules |
| `ACCOUNTING_TRIAL_BALANCE_UNBALANCED` | Trial balance is not balanced and blocks period close/report readiness |
| `CASH_FLOW_MAPPING_INCOMPLETE` | Formal statement snapshot generation found booked cash/bank voucher counterpart subjects without effective cash-flow mappings |
| `FINANCIAL_STATEMENT_PERIOD_NOT_CLOSED` | Formal statement snapshot generation was requested before the accounting period was closed |
| `FINANCIAL_STATEMENT_READINESS_STALE` | Displayed statement-readiness source ledger or cash-flow mapping hash no longer matches server recomputation |
| `CANDIDATE_NOT_FOUND` | Candidate id cannot be recomputed from server facts |
| `CANDIDATE_NOT_BOOKABLE` | Candidate status is not complete enough to book as a formal voucher |
| `VOUCHER_SOURCE_CHANGED` | Candidate source hash no longer matches server facts |
| `VOUCHER_HAS_BLOCKING_ISSUES` | Candidate still has issue reasons |
| `VOUCHER_ALREADY_BOOKED` | Duplicate book attempt |
| `VOUCHER_ALREADY_REVERSED` | Duplicate reversal attempt |
| `VOUCHER_ADJUSTMENT_PERIOD_INVALID` | Later-period adjustment period is missing, closed, or not later than original period |
| `VOUCHER_UNBALANCED` | Debit and credit totals differ |
| `VOUCHER_SEQUENCE_CONFLICT` | Sequence allocation failed and must retry |
| `IDEMPOTENCY_KEY_REPLAY_MISMATCH` | Same idempotency key was reused with a different request body |
| `SOURCE_FACT_LOCKED` | Source fact is locked by upstream workflow or period close |
| `VERSION_CONFLICT` | Optimistic concurrency version mismatch |

## 7. Authorization And Audit Boundary

Required permission scopes:

- `finance.accountingVoucher.read`
- `finance.accountingVoucher.candidateRead`
- `finance.accountingVoucher.book`
- `finance.accountingVoucher.batchBook`
- `finance.accountingVoucher.reverse`
- `finance.accountingVoucher.laterPeriodAdjustment`
- `finance.accountingPeriod.read`
- `finance.accountingPeriod.close`
- `finance.accountingPeriod.reopen`
- `finance.generalLedger.read`
- `finance.generalLedger.balanceRead`
- `finance.financialStatement.read`
- `finance.financialStatement.generate`

Every mutating endpoint must write an operation event. Booking, reversal, period
close, period reopen, and formal statement snapshot generation are
financial-control operations and must be separately auditable.

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

- Book candidate, allocate voucher number, persist lines/source refs/invoice
  refs, write ledger entries, and append the event log in one database
  transaction.
- Reverse voucher, create reversal voucher, book reversal entries, update the
  original voucher status, and append both event logs in one database
  transaction.
- Close period must lock the `accounting_periods` row before final validation.
- Voucher sequence allocation must lock one `(period, voucher_kind)` row.
- Mutating endpoints require optimistic `version` when a persisted row is
  already visible to the user.
- Re-running the same idempotency key must return the original response.
- Source, voucher, tax, payroll/social-insurance, bank-reconciliation, and
  opening-adjustment mutations that affect an accounting period must run the
  backend closed-period guard before writing changes.
- Source facts are not edited during voucher operations. If source facts change,
  regenerate candidates and reject stale source hashes.

## 9. Contract Test Matrix

Backend implementation must add contract tests before API readiness is claimed.

| Scenario | Expected result |
| --- | --- |
| source period has no active tax-policy profile | source tax fact cannot be confirmed; no accrual voucher candidate is returned |
| finance category lacks effective accounting mapping | source tax fact stays in source readiness; no voucher candidate is returned |
| complete receivable plus matched output invoice | candidate `待记账`; booking creates a transfer voucher with receivable/revenue/tax lines and ledger entries |
| receivable missing both invoice tax fact and source tax basis | row stays in source readiness; no accounting-voucher candidate is returned |
| completed payable with input invoice under small-scale taxpayer baseline | booking creates cost/expense voucher without VAT input-deduction line |
| reviewed cash-flow not bank-reconciled | candidate `待生成`; booking returns `CANDIDATE_NOT_BOOKABLE` |
| reviewed and bank-reconciled cash-flow with bank relationship row | candidate `待记账`; booking creates receipt/payment voucher and ledger entries |
| reviewed cash-flow marked reconciled but missing bank relationship row | candidate `需处理`; no voucher booking until bank evidence is restored |
| bank amount mismatch | candidate `需处理`; no voucher booking until adjustment facts resolve difference |
| completed tax matter missing receipt | candidate `需处理`; booking blocked |
| tax matter statutory period differs from payment month | tax accrual candidate uses mapped statutory/business period; linked tax-payment funds candidate uses actual payment transaction period |
| booking candidate | voucher becomes `已记账`; exactly one ledger entry per line |
| duplicate booking request | idempotent replay or `VOUCHER_ALREADY_BOOKED`; no duplicate ledger rows |
| reverse open-period booked voucher | linked reversal voucher created; original becomes `已冲销` |
| reverse closed-period booked voucher | mutation returns `CLOSED_ACCOUNTING_PERIOD` and points to later-period adjustment |
| later-period adjustment for closed booked voucher | adjustment source fact and target-period `待记账` `调整凭证` candidate are created; original voucher remains `已记账`, with no `已冲销` status, no reversal link, and no historical ledger rewrite |
| later-period adjustment candidate before booking | candidate is visible for target-period booking checks but writes no general-ledger entries until booked |
| later-period adjustment after booking | general-ledger entries belong to the target adjustment period only; the original closed period stays historical readback |
| later-period adjustment target period closed or not later than original | mutation returns `VOUCHER_ADJUSTMENT_PERIOD_INVALID` or `CLOSED_ACCOUNTING_PERIOD`; no source fact is created and the original voucher remains unchanged |
| close period with unbooked `待记账` voucher matter | close returns `ACCOUNTING_PERIOD_HAS_UNBOOKED_VOUCHERS` |
| close period with unbalanced trial balance | close returns `ACCOUNTING_TRIAL_BALANCE_UNBALANCED` |
| close-checks with any blocked group | response `canClose=false` and includes source module/source number for blockers |
| close request after checks changed | backend reruns checks and returns `PERIOD_CLOSE_CHECKS_BLOCKED` or `PERIOD_CLOSE_SNAPSHOT_STALE`; period remains open |
| duplicate close request with same idempotency key | returns original close response; no duplicate effective period close |
| concurrent close request with stale version | loser receives version/conflict response; exactly one close event wins |
| closed period book/reverse | mutation returns `CLOSED_ACCOUNTING_PERIOD` |
| closed period source mutation direct API call | source row unchanged and response code is `CLOSED_ACCOUNTING_PERIOD` |
| changed source hash after candidate display | prepare returns `VOUCHER_SOURCE_CHANGED` |
| financial statement snapshot requested before period close | returns `FINANCIAL_STATEMENT_PERIOD_NOT_CLOSED`; no formal snapshot is created |
| cash-flow statement has booked cash/bank voucher with unmapped counterpart subject | returns `CASH_FLOW_MAPPING_INCOMPLETE`; no formal snapshot is created |
| close-checks financial-statement readiness has booked cash/bank voucher with unmapped counterpart subject | response `canClose=false`, `financial_statements` has `cash_flow_mapping_missing` source refs, and close returns `PERIOD_CLOSE_CHECKS_BLOCKED` without locking the period |
| financial statement snapshot request uses stale displayed source ledger or mapping hash | returns `FINANCIAL_STATEMENT_READINESS_STALE`; no formal snapshot is created |
| cash-flow mappings change after formal statement snapshot generation | existing snapshot keeps original source-ledger hash, mapping-version hash, lines, and snapshot hash |
| financial statement snapshot already exists for a closed period | snapshot creation route returns the existing snapshot without appending or rewriting |

## 10. Frontend API Adapter Boundary

When backend implementation starts, frontend should not call persistence APIs
directly from page components. Add an adapter boundary such as:

```text
financeAccountingVoucherRepository
  listCandidates
  readCandidate
  bookCandidate
  batchBookCandidates
  listVouchers
  readVoucher
  reverseVoucher
  listAccountingPeriods
  readPeriodCloseChecks
  closePeriod
  listGeneralLedgerEntries
  listSubjectBalances
  readSubjectLedger
  listGeneralLedgerOpeningBalances
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
- permission tests for read/prepare/book/reverse/later-period-adjustment/period-close scopes;
- idempotency and sequence-concurrency tests;
- backup/restore drill covering booked vouchers and ledger entries;
- report-readiness proof that trial balance reads only booked ledger entries.

Rollback policy:

- Before production booking is enabled, rollback can drop non-production tables.
- After production booking is enabled, destructive rollback is not allowed.
  Forward-fix with reversal/adjustment vouchers instead.
- Closed periods must not be reopened automatically during rollback.

## 12. Frontend Prototype Mapping

Current frontend mapping:

- Candidate rows are generated by `buildAccountingVouchers`.
- Frontend `待记账` rows are still recalculated candidates.
- Frontend `bookAccountingVoucher` simulates booking a session-local `待记账`
  candidate, assigns a mock voucher number, freezes the voucher snapshot, and
  writes session-local ledger entries.
- Frontend `reverseAccountingVoucher` simulates industrial reversal only after
  the user confirms a reversal date and reason. The action marks the original
  booked voucher `已冲销` and creates a linked booked `冲销凭证` snapshot with
  opposite entries.
- Frontend later-period adjustment creates a session-local target-period
  `调整凭证` candidate from a booked voucher in a closed historical period. It
  does not mark the original voucher `已冲销`; the candidate still requires
  ordinary frontend `记账` before it affects ledger rows.
- Frontend `buildAccountingLedgerEntries` derives ledger rows from session-local
  booked voucher facts: ordinary `已记账` vouchers, `已冲销` original vouchers
  whose historical entries remain, linked `冲销凭证` entries that offset the
  original, and booked later-period adjustment vouchers in their target period.

This mapping is prototype evidence only. Backend implementation must follow the
same simplified candidate -> booked voucher plus ledger workflow above.

## 13. Local Backend-Target Contract Mapping

Current local API contract skeleton:

- `apps/api/src/finance/accountingVoucherLifecycleContract.ts` defines the
  framework-agnostic target behavior for ordinary voucher booking and
  open-period reversal.
- Booking verifies the displayed source hash, rejects unbalanced entries,
  assigns a formal voucher number, freezes source and line snapshots,
  stores server-owned bookkeeper/time
  snapshots, writes exactly one general-ledger row per voucher line, and treats
  repeat booking of an already booked voucher as replay instead of duplicate
  ledger writing.
- Open-period reversal creates a linked `冲销凭证` with opposite entries, books
  it into the same open period, keeps original ledger rows as historical
  evidence, and marks the original voucher `已冲销` with a reversal link.
- Closed-period booking and direct same-period reversal both reject
  with canonical `CLOSED_ACCOUNTING_PERIOD`; closed historical corrections must
  use the later-period adjustment flow.

This is still not production backend evidence. It has no listening HTTP route,
real voucher repository, real ledger repository, database migration,
transaction manager, permission middleware, or deployment evidence.

# Finance Period Close Data Contract

Status: `contract_draft_only`

Date: `2026-07-04`

Owner: `财务管理 / 期间结账`

Related documents:

- `docs/api/finance-period-close-api-contract.md`
- `docs/governance/finance-period-close-industrial-execution-acceptance-plan-v1.md`
- `docs/data/finance-accounting-voucher-ledger-contract.md`
- `docs/data/finance-period-close-source-mutation-matrix.md`

## 1. Scope

This document defines the data contract for period-close phases 1-3:

1. Backend `close-checks` snapshot data.
2. Persistent accounting-period close lock.
3. Source mutation guard data requirements.

This is not a database migration, not a production schema record, and not proof
that backend period close has been implemented.

`apps/api/src/finance/periodCloseContract.ts` and
`apps/api/src/finance/periodClosePersistenceContract.ts`,
`apps/api/src/finance/periodCloseRepositoryContract.ts`,
`apps/api/src/finance/periodCloseDatabaseContract.ts`,
`apps/api/src/finance/periodCloseDatabaseRepositoryContract.ts`,
`apps/api/src/finance/periodCloseSourceMutationGuard.ts` plus
`apps/api/src/finance/periodCloseSourceMutationRoutes.ts` currently model these
data semantics in a local executable contract skeleton. The persistence contract
models transaction-boundary expectations with in-memory state: close success
commits the close snapshot, period lock, event, and idempotency record together;
blocked close does not persist a close snapshot or lock; guarded source
mutation rejection leaves the source row unchanged. The repository harness adds
repository-style transaction semantics over the same in-memory state: committed
close state is visible to subsequent source mutation guards, thrown handlers do
not commit, and reads return defensive copies. It does not create database
tables, migrations, real repository transactions, real source API integration,
or persisted locks. The database-row mapper contract declares candidate row
sets and validates row-level invariants over the same in-memory state; it is a
schema/mapper contract only, not a migration or production database proof.
The row-backed repository contract stores period-close controlled records as
candidate database rows, hydrates transaction state from rows, and writes
transaction results back to rows. It is still local and framework-agnostic; it
does not prove a real database driver, SQL transaction, lock mode, isolation
level, migration, or production repository implementation.
The row-backed HTTP gateway repository contract connects the request-shaped API
boundary to the same candidate rows: a close request writes period lock,
snapshot, event, and idempotency rows, while later existing-source and
create-source mutations read the committed row-backed lock before writing. Open
period creates can write candidate source rows; closed-period creates reject
before inserting the source row; unresolved-period creates reject without
writing an incomplete guard audit row. The same local row-backed gateway now
also accepts the dedicated later-period adjustment route, stores local
adjustment facts/idempotency/events, creates a target-period `待制单` voucher
row, and makes both close-check reads and close submission derive
`voucher_preparation` blockers from that row. It is still local evidence only;
source facts and close-check inputs remain fixtures, and no SQL driver,
migration, row lock, isolation level, auth middleware, listener, or production
data evidence exists.

## 2. Data Ownership

| Data object | Owner | Purpose | Implementation status |
| --- | --- | --- | --- |
| `accounting_periods` | Period service | Period state and persistent lock metadata | contract only |
| `accounting_period_close_checks` | Period service | Check-run and close snapshot header | contract only |
| `accounting_period_close_check_items` | Period service | Normalized check blockers and source refs | contract only |
| `accounting_period_events` | Period service | Append-only close/reopen/check governance events | contract only |
| `accounting_period_idempotency_records` | Period service | Close/reopen idempotency replay records | contract only |
| `accounting_period_source_mutation_events` | Period service | Period-lock guard audit rows for source mutation attempts | contract only |
| Source fact period fields | Source modules | Period guard input for mutations | contract only |

The effective close lock is the persisted `accounting_periods.status` plus its
close metadata. A frontend session `AccountingPeriodLockRecord` is not
persistent evidence.

## 2.1 Executable Row/Schema Mapper Contract

`periodCloseDatabaseContract.ts` exposes:

- `periodCloseDatabaseTables`: six local row-set declarations for
  `accounting_periods`, `accounting_period_close_checks`,
  `accounting_period_close_check_items`, `accounting_period_events`,
  `accounting_period_idempotency_records`, and
  `accounting_period_source_mutation_events`.
- `mapPeriodCloseStateToDatabaseRows`: maps the current local in-memory
  period-close persistent state into candidate database rows.
- `validatePeriodCloseDatabaseRows`: validates row-level invariants, including
  close snapshot references, close metadata, reopen metadata, idempotency
  uniqueness, known close-check groups, event references, and source-mutation
  guard audit rows.

The executable contract currently uses stable text identifiers generated by
the local mapper. A future production migration may choose UUID primary keys,
but that would require changing the mapper and tests together. Updating only
the documentation or table metadata would be false evidence.

## 2.2 Row-Backed Repository Harness

`periodCloseDatabaseRepositoryContract.ts` exposes:

- `PeriodCloseDatabaseRepositorySnapshot`: a local snapshot made of
  period-close controlled rows plus external check-input and source-record
  fixtures.
- `hydratePeriodCloseStateFromDatabaseSnapshot`: restores the executable
  persistence state from the row snapshot.
- `createRowBackedPeriodCloseRepository`: runs the existing close/source
  mutation transactions after hydrating from rows, validates mapped rows, and
  commits the transaction result back to row sets.
- `handleFinanceHttpApiRepositoryGateway`: maps HTTP-shaped close and
  existing-source/create-source mutation requests into the row-backed
  repository so request boundaries, idempotency rows, period-lock rows, source
  rows, and source-mutation guard audit rows are exercised together.
- The same gateway maps
  `POST /api/finance/accounting-vouchers/{id}/later-period-adjustments` into
  the row-backed repository so adjustment facts, idempotency records, events,
  target-period voucher rows, and close-check blockers are exercised together.

This is the next local cut toward a real repository because the period lock,
close snapshots, events, idempotency records, and source-mutation guard audit
rows are no longer stored only as direct in-memory domain arrays. It is not a
complete database implementation because source facts and check inputs are
still local fixtures, and there is no SQL driver, migration, row lock, isolation
level, real server request boundary, or production data evidence.

## 2.3 Source Mutation Operation Registry Contract

`periodCloseSourceMutationOperationMetadata.ts` and
`periodCloseSourceMutationRegistry.ts` expose:

- shared source-write operation metadata used by the local route adapter to
  resolve whether to guard the source period, target period, or both;
- `financeSourceMutationOperationRegistry`: one local metadata row for each
  ordinary source write route in `periodCloseSourceMutationRoutes.ts`;
- `financeDedicatedClosedPeriodCorrectionRegistry`: the dedicated correction
  path for `POST /api/finance/accounting-vouchers/{id}/later-period-adjustments`,
  which is intentionally not an ordinary direct source mutation;
- period-source, period-check mode, closed-period behavior, and correction-path
  metadata for every guarded operation.

`periodCloseSourceMutationRegistry.test.ts` verifies that the operation
registry stays one-to-one with the local route adapter definitions, that every
guarded source area has executable metadata, and that later-period adjustment
requires a closed original period plus an open target period.
`periodCloseSourceMutationRoutes.test.ts` also verifies that the route adapter
uses the shared period-check mode: source-period-only operations do not get
blocked by unrelated target-period fields, target-period-required create routes
reject missing target periods before insertion, and source-and-target operations
still reject a closed target period. This is still a local contract artifact:
it does not prove real source tables, HTTP handlers, database transactions,
auth middleware, or production period-lock reads.

## 3. `accounting_periods`

Purpose: one row per accounting period and the authoritative period state.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `period` | text | yes | `YYYY-MM`, primary key |
| `status` | enum | yes | `开放`, `已结账`, `已反结账` |
| `opened_at` | timestamptz | no | Server time when created/opened |
| `closed_at` | timestamptz | no | Required when status is `已结账` |
| `closed_by` | text | no | Authenticated operator id |
| `closed_by_snapshot` | jsonb | no | Display snapshot, no secrets |
| `close_reason` | text | no | Required for close |
| `close_check_snapshot_id` | text | no | Snapshot used by latest close |
| `close_check_snapshot_hash` | text | no | Stable hash of close-check result |
| `reopened_at` | timestamptz | no | Exceptional reopen only |
| `reopened_by` | text | no | Authenticated operator id |
| `reopened_by_snapshot` | jsonb | no | Display snapshot, no secrets |
| `reopen_reason` | text | no | Required for reopen |
| `reopen_impact_snapshot` | jsonb | no | Later closed periods and irreversible external submissions considered by exceptional reopen |
| `reopen_risk_confirmation_snapshot` | jsonb | no | Decision number and operator-facing note for accepted high-risk reopen |
| `version` | integer | yes | Optimistic concurrency |
| `created_at` | timestamptz | yes | Server time |
| `updated_at` | timestamptz | yes | Server time |

Required constraints:

- Primary key: `period`.
- `closed_at`, `closed_by`, `closed_by_snapshot`, `close_reason`, and
  `close_check_snapshot_id` are required when `status=已结账`.
- `reopened_at`, `reopened_by`, `reopened_by_snapshot`, and `reopen_reason`
  are required when a reopen event transitions the period to `已反结账`.
- If `reopen_impact_snapshot` contains later closed periods or irreversible
  external submissions, `reopen_risk_confirmation_snapshot` must include a
  non-empty decision number and confirmation note.
- Mutating close/reopen operations must increment `version`.

State rules:

| From | To | Allowed by | Notes |
| --- | --- | --- | --- |
| `开放` | `已结账` | `finance.accountingPeriod.close` | Requires passing close checks |
| `已结账` | `已反结账` | `finance.accountingPeriod.reopen` | Exceptional high-permission flow |
| `已反结账` | `已结账` | `finance.accountingPeriod.close` | Requires rerun close checks |

## 4. `accounting_period_close_checks`

Purpose: store close-check run headers and close snapshots.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | text | yes | Primary key; local mapper currently emits stable text ids |
| `period` | text | yes | References `accounting_periods.period` |
| `run_type` | enum | yes | `close_attempt`, `close_snapshot` |
| `can_close` | boolean | yes | Final backend result |
| `status` | enum | yes | `通过`, `阻断`, `未运行` |
| `computed_at` | timestamptz | yes | Server time |
| `computed_by` | text | no | Actor for close attempt; nullable for system-owned contract runs |
| `source_version_set_hash` | text | yes | Hash of source ids and versions used |
| `check_snapshot_hash` | text | yes | Stable hash of normalized check result |
| `trial_debit_total` | numeric(18,2) | yes | Period total |
| `trial_credit_total` | numeric(18,2) | yes | Period total |
| `trial_balance_difference` | numeric(18,2) | yes | Debit minus credit |
| `trial_balance_status` | enum | yes | `平衡`, `不平`, `未生成` |
| `persisted_for_close` | boolean | yes | True only for snapshot used by close |
| `request_id` | text | no | Correlation id |

Required indexes:

- `(period, computed_at desc)`.
- `(period, persisted_for_close)` for latest close snapshot lookup.
- Unique `(period, check_snapshot_hash, run_type, persisted_for_close)` may be
  used to deduplicate equivalent stored snapshots.

Rules:

- The current executable contract stores close attempts and successful close
  snapshots only; read-only check results are returned by API contract and are
  not persisted as rows in this local mapper.
- Only a successful close transaction can set `persisted_for_close=true`.
- `check_snapshot_hash` excludes volatile fields such as `computed_at` and
  `request_id`.
- Close must not reuse a stale snapshot without rerunning the checks.

## 5. `accounting_period_close_check_items`

Purpose: store normalized check groups, blockers, and source references.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | text | yes | Primary key; local mapper currently emits stable text ids |
| `close_check_id` | text | yes | References `accounting_period_close_checks.id` |
| `period` | text | yes | Copied for filtering |
| `group_code` | enum | yes | One of the phase 1 check groups |
| `group_label` | text | yes | User-facing label |
| `status` | enum | yes | `通过`, `阻断`, `提示`, `不适用` |
| `can_pass` | boolean | yes | Whether this item allows close |
| `blocker_count` | integer | yes | Count represented by this row |
| `source_module` | text | no | Required for source-specific blocker rows |
| `source_id` | text | no | Required for source-specific blocker rows |
| `source_no` | text | no | Required for source-specific blocker rows |
| `source_status` | text | no | Source status snapshot |
| `source_version` | integer | no | Source version used by check; nullable until source modules expose this value in check refs |
| `reason_code` | text | no | Stable blocker reason |
| `reason` | text | yes | User-facing explanation |
| `next_action` | text | no | Source module or correction path |
| `snapshot` | jsonb | no | Minimal display/audit payload; no secrets |

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

- Blocking rows must include `source_module`, `source_id`, and `source_no`
  unless the blocker is genuinely aggregate-only, such as trial balance.
- Source-module readiness must be represented through real owner modules or
  accounting-voucher candidates. Period close does not keep a standalone
  adjustment checklist group.
- `cash_review` blocks close when the period still has cash-flow rows in
  `待复核`. These rows belong to `流水复核`; they are not bank reconciliation
  problems yet.
- `cash_reconciliation` starts after cash-flow review. It blocks close for
  reviewed cash-flow rows that are still not bank-reconciled or have
  reconciliation exceptions.
- Aggregate-only blockers must still include a `reason_code` and a human
  readable `reason`.
- Items are immutable once linked to a `close_snapshot`.

## 6. `accounting_period_events`

Purpose: append-only event trail for period close governance.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | text | yes | Primary key; local mapper currently emits stable text ids |
| `period` | text | yes | References `accounting_periods.period` |
| `event_type` | enum | yes | `close_attempt_failed`, `closed`, `reopen_attempt_failed`, `reopened` |
| `before_status` | enum | no | Period status before mutation |
| `after_status` | enum | no | Period status after mutation |
| `actor_id` | text | no | Authenticated operator; nullable for system events |
| `actor_snapshot` | jsonb | no | Display snapshot |
| `reason` | text | no | Required for close/reopen |
| `reopen_impact_snapshot` | jsonb | no | Present on failed or successful high-risk reopen attempts |
| `reopen_risk_confirmation_snapshot` | jsonb | no | Present on accepted high-risk reopen events |
| `close_check_id` | text | no | Related check/snapshot |
| `idempotency_key` | text | no | Required for close/reopen mutation events |
| `request_id` | text | yes | Correlation id |
| `created_at` | timestamptz | yes | Server time |

Rules:

- Events are append-only.
- Reopen must not delete previous close events or snapshots.
- Reopen events may carry immutable impact and risk-confirmation snapshots so
  later review can explain why an exceptional reopen was accepted or rejected.
- Failed close attempts may be recorded, but they must not mutate
  `accounting_periods.status`.

## 6.1 `accounting_period_idempotency_records`

Purpose: store close/reopen idempotency keys and replay snapshots.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | text | yes | Primary key; local mapper currently emits stable text ids |
| `period` | text | yes | References `accounting_periods.period` |
| `operation` | text | yes | `close` or `reopen` |
| `idempotency_key` | text | yes | Client retry key scoped by operation and period |
| `request_signature` | text | yes | Stable signature of replay-sensitive request fields |
| `response_snapshot` | jsonb | yes | Response to replay when the same request is retried |
| `created_at` | timestamptz | yes | Server time |

Required constraints:

- Unique `(period, operation, idempotency_key)`.
- Reusing the same key with a different request signature rejects with
  `IDEMPOTENCY_KEY_REUSED`.

## 6.2 `accounting_period_source_mutation_events`

Purpose: append source-mutation guard audit rows whenever a protected source
mutation is applied or rejected through the period-lock guard contract.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | text | yes | Primary key; local mapper currently emits stable text ids |
| `source_area` | text | yes | Registered source mutation area |
| `source_id` | text | yes | Source row id |
| `event_type` | text | yes | `source_mutation_applied` or `source_mutation_rejected` |
| `operation` | text | yes | User-facing operation summary |
| `affected_accounting_periods` | jsonb | yes | Periods checked by the guard |
| `actor_id` | text | yes | Operator id from authenticated context |
| `actor_snapshot` | jsonb | yes | Display snapshot, no secrets |
| `request_id` | text | yes | Correlation id |
| `created_at` | timestamptz | yes | Server time |

Rules:

- Closed-period and unresolved-period rejections must append an audit event
  without changing the protected source row.
- These rows do not replace source-module domain events; they are the
  period-close guard audit contract.

## 7. Source Mutation Guard Data Requirements

Every source module that can affect accounting results must expose or resolve
an accounting period before mutation.

| Source area | Required guard period source |
| --- | --- |
| `应收应付` | Source `accounting_period` / `accrual_period` |
| `发票台账` | Imported invoice accounting period / ledger import period |
| `发票匹配` | Invoice accounting period, linked business/accrual period, and original blue-invoice period for red-invoice association changes |
| `收支流水` | Cash-flow accounting period derived from transaction date and accounting policy |
| `银行对账` | Bank row period plus linked system cash-flow periods |
| `会计凭证` | Voucher `accounting_period` |
| `申报准备 / 税务办理` | Declaration-preparation mapped accounting close month and tax matter mapped accounting close month |
| `社保公积金` | Salary/social-insurance accounting month |
| `薪酬社保` | Payroll result accounting month |
| `账套初始化` | First enabled period or opening-adjustment period |

Guard rules:

- Mutation APIs must read `accounting_periods.status` inside the same
  transaction or consistency boundary as the mutation.
- A formatted period absent from `accounting_periods` is unresolved, not open;
  mutation APIs must reject it with `SOURCE_ACCOUNTING_PERIOD_UNRESOLVED`.
- If a mutation changes a row's period, both the old and new period must pass
  the guard when both affect accounting results.
- Invoice association writes must guard every accounting-impacting target, not
  only the visible invoice row. Removing or changing a blue-invoice business
  match guards the matched receivable/payable period; adding, changing, or
  removing a red-invoice original relation guards both the red invoice period
  and the original blue invoice period.
- Payroll result writes use the payroll result month as the guard period. This
  includes salary-detail confirmation, salary settlement, and salary-adjustment
  creation because all three can change the salary accrual/payment source facts
  for that accounting month.
- Employee-facing drafts that do not create receivable/payable rows,
  cash-flow rows, invoice facts, vouchers, or other accounting-impacting source
  rows are not period mutations. Final submission or resubmission is the
  guarded mutation boundary.
- Backdated rows into a closed period are rejected with
  `CLOSED_ACCOUNTING_PERIOD`.
- If the same source write is stale and touches a closed period, closed-period
  rejection takes precedence over source-version conflict.
- Correction after close should create a later-period adjustment fact by a
  separate audited process, not mutate the historical source row.
- A frontend disabled state is not data-layer evidence.

## 8. Acceptance Matrix

| Scenario | Required data result |
| --- | --- |
| Close checks fail | No `accounting_periods.status=已结账`; optional failed event only |
| Close succeeds | Period row locked as `已结账`, check snapshot persisted, close event appended |
| Duplicate close retry with same idempotency key | No duplicate effective close; original response replayed |
| Concurrent close attempts | One transaction wins; others receive version/conflict response |
| Refresh after close | Period status reads from `accounting_periods`, not session state |
| Source mutation in closed period | Mutation rejected; source row unchanged |
| Direct API call bypassing frontend | Same `CLOSED_ACCOUNTING_PERIOD` rejection |
| Source mutation without resolvable period | Mutation rejected with `SOURCE_ACCOUNTING_PERIOD_UNRESOLVED` |
| Source mutation referencing period absent from `accounting_periods` | Mutation rejected with `SOURCE_ACCOUNTING_PERIOD_UNRESOLVED`; source row unchanged |
| Source mutation is stale and touches closed period | Mutation rejected with `CLOSED_ACCOUNTING_PERIOD`; source row unchanged |
| Mutation changes accounting period | Both original and target periods must pass the guard |
| Route-level closed-period source mutation | Rejected before source row version/status/period changes |
| Reopen | New event appended; old close event and snapshot retained |
| Reopen while later period is already closed | Rejected by default; no period status change; optional failed event retained |

## 9. Migration And Evidence Status

| Evidence item | Current status |
| --- | --- |
| Database migration | missing |
| Migration rollback/forward-fix plan | missing |
| Seed/test data replay | missing |
| Contract tests | partial local skeleton |
| Permission tests | partial local skeleton |
| Concurrency/idempotency tests | partial local skeleton |
| Backup/restore drill | missing |
| Production release evidence | missing |

Until these evidence items exist, the project must not claim production backend
period close, real persistent period lock, or real source mutation guard
implementation. Local in-memory transaction-boundary tests are evidence for the
contract shape only.

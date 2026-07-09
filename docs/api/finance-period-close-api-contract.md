# Finance Period Close API Contract

Status: `contract_draft_only`

Date: `2026-07-04`

Owner: `财务管理 / 期间结账`

Related plan:

- `docs/governance/finance-period-close-industrial-execution-acceptance-plan-v1.md`
- `docs/data/finance-period-close-data-contract.md`
- `docs/data/finance-accounting-voucher-ledger-contract.md`

## 1. Scope

This document defines the backend API contract for period-close phases 1-3:

1. Unified backend `close-checks`.
2. Persistent accounting-period close lock.
3. Closed-period guard for source mutation APIs.

This is a contract draft only. It is not an implementation record, not a
production API proof, not a migration record, and not evidence that backend
period close is ready.

Current local executable skeleton:

- `apps/api/src/finance/periodCloseContract.ts`
- `apps/api/src/finance/periodCloseContract.test.ts`
- `apps/api/src/finance/periodClosePersistenceContract.ts`
- `apps/api/src/finance/periodClosePersistenceContract.test.ts`
- `apps/api/src/finance/periodCloseRepositoryContract.ts`
- `apps/api/src/finance/periodCloseRepositoryContract.test.ts`
- `apps/api/src/finance/periodCloseDatabaseContract.ts`
- `apps/api/src/finance/periodCloseDatabaseContract.test.ts`
- `apps/api/src/finance/periodCloseDatabaseRepositoryContract.ts`
- `apps/api/src/finance/periodCloseDatabaseRepositoryContract.test.ts`
- `apps/api/src/finance/periodCloseRoutes.ts`
- `apps/api/src/finance/periodCloseRoutes.test.ts`
- `apps/api/src/finance/periodCloseSourceMutationGuard.ts`
- `apps/api/src/finance/periodCloseSourceMutationGuard.test.ts`
- `apps/api/src/finance/periodCloseSourceMutationOperationMetadata.ts`
- `apps/api/src/finance/periodCloseSourceMutationRegistry.ts`
- `apps/api/src/finance/periodCloseSourceMutationRegistry.test.ts`
- `apps/api/src/finance/periodCloseSourceMutationRoutes.ts`
- `apps/api/src/finance/periodCloseSourceMutationRoutes.test.ts`
- `apps/api/src/finance/periodCloseVoucherSummaryContract.ts`
- `apps/api/src/finance/periodCloseVoucherSummaryContract.test.ts`
- `apps/api/src/finance/accountingVoucherLaterPeriodAdjustmentContract.ts`
- `apps/api/src/finance/accountingVoucherLaterPeriodAdjustmentContract.test.ts`

This skeleton validates core domain semantics for close checks, close/reopen
idempotency/concurrency, closed-period guard behavior, and a framework-agnostic
route adapter for the documented accounting-period paths. It also validates a
framework-agnostic source-mutation guard adapter that future source write APIs
must call before mutating accounting-impacting facts. It also includes a local
source-mutation operation metadata and registry that give every ordinary guarded
write operation an explicit accounting-period source, period-check mode,
closed-period behavior, and correction path. The local route adapter now uses
the shared period-check mode when resolving affected periods, and the registry
is tested one-to-one against the local route adapter so new write routes cannot
be added without period-lock metadata. It also includes a local source-mutation
route adapter catalog that proves direct API-style mutation requests are
rejected before source rows change when a period is closed. It also
includes a local accounting-voucher later-period adjustment route skeleton that
creates a target-period `待记账` adjustment fact/candidate while leaving the
closed historical voucher unchanged. It is not a listening HTTP server, not
database persistence, and not a production API. `periodClosePersistenceContract`
adds a local persistence-boundary contract: close transactions rerun checks,
persist a close snapshot, update the period lock, append events, preserve
idempotent replay, and reject guarded source mutations before changing source
rows. That contract still uses in-memory state and does not prove real database
transactions or repositories. `periodCloseRepositoryContract` adds the next
local transaction harness: a repository-style unit of work commits returned
transaction state, rolls back thrown handlers, returns defensive state copies,
and proves that a committed period close lock is read by a later source mutation
in the same repository. It is still an in-memory harness, not a database
repository implementation. `periodCloseDatabaseContract` adds a local
database-row/schema mapper contract over that in-memory state: it declares the
six controlled period-close row sets, maps committed close state into candidate
database rows, and validates row-level invariants such as closed-period snapshot
references, reopen metadata, idempotency uniqueness, and source-mutation guard
audit rows. It is not a migration, not a real database table, and not a
database-backed repository. `periodCloseDatabaseRepositoryContract` adds a
row-backed local repository harness: the repository snapshot stores
period-close controlled records as candidate database rows, hydrates
transaction state from those rows, and writes transaction results back to rows.
It proves row-backed persistence boundaries for the local contract, while
still depending on local source/check-input fixtures and not proving a real DB
driver, migration, SQL transaction, lock mode, isolation level, or production
repository. `periodCloseVoucherSummaryContract` defines the local count
aggregation rule used by accounting-period list rows and the local
`voucher_booking` close-check overlay: voucher matters are grouped by
source-fact accounting period, `待记账` rows count as unbooked blockers, and
`已记账 / 已冲销` rows count as booked. The route adapter now uses the same
in-memory voucher rows for `GET /accounting-periods`,
`GET /accounting-periods/{period}/close-checks`, and `POST
/accounting-periods/{period}/close`, so display counts and close blockers do
not drift inside the local contract. This still does not prove a real
voucher-ledger table or repository query.
The row-backed HTTP gateway repository contract now also exercises the
dedicated later-period adjustment endpoint: a successful request stores the
local adjustment fact, idempotency record, event, and a target-period `待记账`
voucher row. The same voucher row is then used by both `GET
/accounting-periods/{period}/close-checks` and `POST
/accounting-periods/{period}/close` to block the target period through
`voucher_booking` until the adjustment candidate is booked. This remains
local candidate-row evidence only; it is not a listening server, SQL
repository, migration, or production transaction.

The frontend session lock and frontend disabled buttons are user-experience
guards only. The effective control must be backend rejection from this API
contract after implementation.

## 2. Shared API Rules

### 2.1 Period Format

`period` uses `YYYY-MM`, for example `2026-06`.

Quarterly or yearly external matters must map into the closing accounting
month before they enter period close checks. Example: `2026-Q2` contributes to
`2026-06`.

Accounting voucher candidates and period summaries must use the source-fact
accounting period, not operation time. Tax accrual matters use the statutory or
business period mapped to an accounting month; tax-payment or other cash-flow
funds vouchers use the actual transaction month.

### 2.2 Decimal And Time Fields

- Money fields are string decimals with two fraction digits.
- Dates use ISO `YYYY-MM-DD`.
- Operation timestamps use server-owned `timestamptz`.
- Clients must not submit close/reopen actor or timestamp fields.

### 2.3 Error Response Shape

Until the project chooses a global error envelope, period-close APIs must at
least return:

| Field | Required | Notes |
| --- | --- | --- |
| `code` | yes | Stable machine code |
| `message` | yes | User-facing summary |
| `requestId` | yes | Correlation id |
| `period` | no | Present for period-scoped errors |
| `sourceModule` | no | Present for source mutation guard errors |
| `sourceId` | no | Present when a source row is known |
| `nextAction` | no | `后续期间调整` or `反结账` guidance when applicable |
| `details` | no | Structured blockers; no secrets or raw stack traces |

Canonical closed-period error code:

```text
CLOSED_ACCOUNTING_PERIOD
```

Canonical unresolved source-period error code:

```text
SOURCE_ACCOUNTING_PERIOD_UNRESOLVED
```

Other stable period-close lifecycle errors currently covered by the local
contract skeleton:

```text
PERIOD_CLOSE_BLOCKED
PERIOD_REOPEN_BLOCKED
PERIOD_VERSION_CONFLICT
CHECK_SNAPSHOT_MISMATCH
IDEMPOTENCY_KEY_REUSED
INVALID_CLOSE_REASON
INVALID_REOPEN_REASON
INVALID_REOPEN_RISK_CONFIRMATION
PERIOD_ALREADY_CLOSED
PERIOD_NOT_CLOSED
```

Any older draft wording such as `ACCOUNTING_PERIOD_CLOSED` must be treated as a
non-canonical alias during implementation planning, not as a second production
error contract.

## 3. Phase 1: Accounting Period List

### `GET /api/finance/accounting-periods`

Purpose: list persisted accounting periods and period-close summary metadata.

Query parameters:

| Name | Required | Notes |
| --- | --- | --- |
| `fromPeriod` | no | Inclusive `YYYY-MM` |
| `toPeriod` | no | Inclusive `YYYY-MM` |
| `status` | no | `开放`, `已结账`, `已反结账` |
| `limit` | no | Pagination size; default pending global API decision |
| `cursor` | no | Pagination cursor; format pending global API decision |

Response fields:

| Field | Required | Notes |
| --- | --- | --- |
| `items` | yes | Period rows |
| `pagination` | no | Required if pagination is enabled |
| `serverTime` | yes | Server timestamp |

Period row fields:

| Field | Required | Notes |
| --- | --- | --- |
| `period` | yes | `YYYY-MM` |
| `status` | yes | `开放`, `已结账`, `已反结账` |
| `version` | yes | Optimistic concurrency version |
| `canClose` | yes | Server-derived summary from latest checks |
| `closeCheckStatus` | yes | `通过`, `阻断`, `未运行` |
| `voucherMatterCount` | yes | Voucher matters and persisted vouchers grouped into this period |
| `bookedVoucherCount` | yes | Persisted vouchers written to the general ledger |
| `unbookedVoucherCount` | yes | `待记账` voucher matters not yet booked |
| `blockingCandidateCount` | yes | Blocking candidate/source count |
| `trialBalanceStatus` | yes | `平衡`, `不平`, `未生成` |
| `trialBalanceDifference` | yes | String decimal |
| `closedAt` | no | Server timestamp when closed |
| `closedBySnapshot` | no | Display snapshot, no secrets |
| `closeReason` | no | Close reason when closed |
| `latestCloseEventId` | no | Latest close event id |
| `latestCheckSnapshotHash` | no | Latest stable check hash |

Rules:

- `canClose` is backend-owned. The frontend must not recompute final close
  eligibility.
- Voucher count fields are backend-owned summary fields derived from persisted
  voucher state or the same close-check source set. They must not be hardcoded
  by route adapters or recomputed by the frontend.
- When formal voucher rows are available to the backend, `unbookedVoucherCount`
  and the `voucher_booking` close-check blocker count must come from the same
  source set.
- Local contract tests currently prove the aggregation rule with in-memory
  voucher rows. Backend readiness still requires a real repository query over
  persisted voucher rows.
- The list summary may be stale for display, but `POST /close` must rerun
  checks before changing period state.

## 4. Phase 1: Close Checks

### `GET /api/finance/accounting-periods/{period}/close-checks`

Purpose: return the single backend source of truth for period-close checks.

Response fields:

| Field | Required | Notes |
| --- | --- | --- |
| `period` | yes | `YYYY-MM` |
| `periodStatus` | yes | Current persisted period status |
| `version` | yes | Period version at check time |
| `canClose` | yes | `true` only when every blocking check passes |
| `computedAt` | yes | Server timestamp |
| `checkSnapshotHash` | yes | Stable hash excluding volatile request metadata |
| `checks` | yes | One row per check group |
| `trialBalance` | yes | Period debit/credit totals |
| `sourceVersionSetHash` | yes | Hash of source versions used by the check |

Check group codes:

| Code | Label | Minimum source details |
| --- | --- | --- |
| `voucher_preparation` | `凭证来源` | 待生成、需处理数量和来源 |
| `voucher_booking` | `凭证记账` | 待记账数量和凭证列表 |
| `general_ledger_trial_balance` | `总账试算` | 借方、贷方、差额、试算状态 |
| `financial_statements` | `财务报表` | 报表可生成状态和阻断原因 |
| `cash_review` | `流水复核` | 本期待复核现金流水、缺凭证现金流水 |
| `cash_reconciliation` | `银行对账` | 已复核未对账流水、对账异常流水 |
| `tax_handling` | `税务办理` | 未申报、未缴款、缺回执事项 |
| `social_insurance_housing_fund` | `社保公积金` | 未确认、未缴费、缺回单事项 |

Check row fields:

| Field | Required | Notes |
| --- | --- | --- |
| `code` | yes | One of the group codes above |
| `label` | yes | User-facing label |
| `status` | yes | `通过`, `阻断`, `提示`, `不适用` |
| `canPass` | yes | Whether this group allows closing |
| `blockerCount` | yes | Blocking item count |
| `summary` | yes | User-facing summary |
| `nextModule` | no | Source module to resolve blockers |
| `sources` | yes | Source refs; empty only when no source detail exists |

Source ref fields:

| Field | Required | Notes |
| --- | --- | --- |
| `sourceModule` | yes | Example: `应收应付`, `会计凭证`, `银行对账` |
| `sourceId` | yes | Stable source id |
| `sourceNo` | yes | User-facing source number |
| `sourceStatus` | yes | Source status snapshot used by check |
| `accountingPeriod` | yes | Period contributing to this blocker |
| `reasonCode` | yes | Stable reason code |
| `reason` | yes | User-facing reason |
| `nextAction` | yes | Where the user should resolve it |

Rules:

- Any check with `status=阻断` makes top-level `canClose=false`.
- The response must include source module and source number for blockers.
- Repeated reads over the same persisted source versions must produce the same
  `canClose`, check statuses, blocker lists, and `checkSnapshotHash`.
- Volatile values such as `computedAt` and `requestId` are excluded from
  stability comparisons.
- The frontend may sort, filter, or render checks, but it must not override
  backend check status or final `canClose`.
- The `voucher_booking` check must be derived from voucher matter rows when
  they are available: `待记账` matters block close and are returned as source
  refs; `已记账` and `已冲销` vouchers do not block close.

## 5. Phase 2: Close Accounting Period

### `POST /api/finance/accounting-periods/{period}/close`

Purpose: persist a period close lock after backend checks pass.

Request body:

| Field | Required | Notes |
| --- | --- | --- |
| `reason` | yes | Close reason; non-empty |
| `version` | yes | Period optimistic concurrency version |
| `idempotencyKey` | yes | Unique key for safe retries |
| `expectedCheckSnapshotHash` | no | Client-observed hash; backend still reruns checks |

Backend behavior:

1. Authenticate and authorize `finance.accountingPeriod.close`.
2. Lock the `accounting_periods` row for the target period.
3. Validate `version`.
4. Rerun `close-checks` in the same control flow, including the same
   voucher-row-derived `voucher_booking` check used by the read endpoint.
5. If `expectedCheckSnapshotHash` is provided and does not match the rerun
   backend `checkSnapshotHash`, reject with `CHECK_SNAPSHOT_MISMATCH` and
   return both `expectedCheckSnapshotHash` and `currentCheckSnapshotHash`.
6. Reject if any blocking check remains.
7. Write the close-check snapshot.
8. Set period status to `已结账`.
9. Write close actor/time/reason from server context.
10. Append an `accounting_period_events` close event.
11. Persist the idempotency key and return the resulting period state.

Response fields:

| Field | Required | Notes |
| --- | --- | --- |
| `period` | yes | `YYYY-MM` |
| `status` | yes | `已结账` when successful |
| `version` | yes | Incremented period version |
| `closedAt` | yes | Server timestamp |
| `closedBySnapshot` | yes | Display snapshot |
| `closeReason` | yes | Saved close reason |
| `closeCheckSnapshotId` | yes | Persisted snapshot id |
| `checkSnapshotHash` | yes | Snapshot hash used for the close |
| `eventId` | yes | Close event id |

Acceptance requirements:

- Refreshing the page must not lose closed status.
- Concurrent duplicate close attempts must not create two effective closes.
- A retry with the same `idempotencyKey` returns the first successful response
  or rejects mismatched replay with `IDEMPOTENCY_KEY_REUSED`.
- A close request with a stale `expectedCheckSnapshotHash` must not write the
  period lock, close-check snapshot, event, or idempotency record; the client
  must rerun `GET /close-checks` using the returned `currentCheckSnapshotHash`.
- If checks fail during close, no period lock, snapshot-as-close, or close event
  may be committed.

## 6. Exceptional Flow: Reopen Accounting Period

### `POST /api/finance/accounting-periods/{period}/reopen`

Purpose: exceptionally reopen a closed accounting period. This is not the
normal correction path for source mutations. Normal historical corrections
should create later-period adjustment facts.

Request body:

| Field | Required | Notes |
| --- | --- | --- |
| `reason` | yes | Reopen reason; non-empty |
| `version` | yes | Period optimistic concurrency version |
| `idempotencyKey` | yes | Unique key for safe retries |
| `riskConfirmation` | no | Required only for exceptional reopen when later periods are closed or irreversible external submissions exist. Must include `decisionNo` and `note`; boolean flags declare which risk type was explicitly accepted |

Backend behavior:

1. Authenticate and authorize `finance.accountingPeriod.reopen`.
2. Lock the `accounting_periods` row for the target period.
3. Validate `version`.
4. Reject if the target period is not `已结账`.
5. Build a reopen impact snapshot from later closed accounting periods and irreversible external submissions such as submitted tax declarations.
6. Reject by default when any later accounting period is already `已结账`.
7. Reject by default when the target period has irreversible external submissions.
8. If either risk exists, require a complete `riskConfirmation` with decision number and confirmation note. Incomplete risk confirmation rejects with `INVALID_REOPEN_RISK_CONFIRMATION`.
9. Set period status to `已反结账`.
10. Write reopen actor/time/reason from server context.
11. Persist reopen impact and risk confirmation snapshots when high-risk exception is accepted.
12. Append an `accounting_period_events` reopen event.
13. Persist the idempotency key and return the resulting period state.

Response fields:

| Field | Required | Notes |
| --- | --- | --- |
| `period` | yes | `YYYY-MM` |
| `status` | yes | `已反结账` when successful |
| `version` | yes | Incremented period version |
| `reopenedAt` | yes | Server timestamp |
| `reopenedBySnapshot` | yes | Display snapshot |
| `reopenReason` | yes | Saved reopen reason |
| `reopenImpactSnapshot` | no | Present when reopen had later-closed-period or irreversible-external-submission risk |
| `reopenRiskConfirmationSnapshot` | no | Present when a high-risk reopen exception was accepted |
| `eventId` | yes | Reopen event id |

Acceptance requirements:

- Reopen writes an event and does not delete old close events or close
  snapshots.
- Reopen cannot be used to bypass direct source mutation guards.
- Reopen is rejected when a later period is already closed unless an explicit
  risk decision is supplied and persisted.
- Reopen is rejected when irreversible external submissions exist unless an
  explicit risk decision is supplied and persisted.
- Duplicate retry with the same `idempotencyKey` returns the first successful
  response or rejects mismatched replay with `IDEMPOTENCY_KEY_REUSED`.

Current local skeleton status:

- `apps/api/src/finance/periodCloseContract.ts` models successful reopen,
  blank-reason rejection, not-closed rejection, version conflict,
  later-closed-period blocking, irreversible-external-submission blocking,
  incomplete risk-confirmation rejection, accepted high-risk reopen snapshots,
  event creation, and idempotent replay.
- `apps/api/src/finance/periodCloseRoutes.ts` exposes a framework-agnostic
  `POST /api/finance/accounting-periods/{period}/reopen` route adapter using
  server-owned actor/time context and returns persisted high-risk snapshots
  when an exceptional reopen is accepted.
- `apps/api/src/finance/financeHttpApiRepositoryGatewayContract.ts` connects
  the HTTP-shaped close request boundary to the row-backed repository harness
  for close, existing-source mutation writes, and create-source mutation writes.
  It proves close rows, idempotency rows, event rows, source rows, and
  source-mutation guard audit rows can be committed through the same
  request-shaped entry point when the affected accounting period is resolved.
  Create requests without an accounting period reject before writing an
  incomplete guard audit row.
- This is still not a listening HTTP endpoint, real auth middleware, SQL
  repository, migration, or production database persistence.

## 7. Phase 3: Source Mutation Guard

Every mutation API that can affect accounting results for a period must call a
shared backend guard:

```text
assertAccountingPeriodOpen(accountingPeriod, sourceModule, sourceId, operation)
```

The current local skeleton exposes this as
`guardFinanceSourceMutation(...)` in
`apps/api/src/finance/periodCloseSourceMutationGuard.ts`. Source APIs should
pass every period affected by the mutation, including both the original period
and target period when a mutation changes `accountingPeriod`.

The local route-level skeleton exposes direct API-style guarded mutations in
`apps/api/src/finance/periodCloseSourceMutationRoutes.ts`. These route adapters
are not the final source API implementation, but they define the required
integration shape: resolve source row, resolve affected accounting periods, run
the guard, reject closed/unresolved periods before mutation, and only then write
the source-row change plus an operation event.

A formatted period that is absent from `accounting_periods` is treated as
unresolved, not as open. Source mutation APIs must reject it with
`SOURCE_ACCOUNTING_PERIOD_UNRESOLVED`. When a source row is both stale and in a
closed period, the closed-period guard has priority and the API returns
canonical `CLOSED_ACCOUNTING_PERIOD`.

The guard must run before mutating the source row, voucher row, reconciliation
relationship, tax matter, salary/social-insurance result, or opening-adjustment
fact.

Required covered source areas:

| Source area | Mutations that require guard |
| --- | --- |
| `应收应付` | 新增、调整、作废、收付款登记、税额事实确认或重建 |
| `发票台账` | 发票导入、重导入、作废、红票原票关系影响发票事实的写入 |
| `发票匹配` | 匹配、取消匹配、红票处理、后续开票确认 |
| `收支流水` | 复核、退回、作废、补充凭证、冲正、补差 |
| `银行对账` | 确认、撤销、补登记系统流水、金额调整、异常处理 |
| `会计凭证` | 记账、批量记账、冲销 |
| `申报准备 / 税务办理` | 申报准备项确认、未开票收入申报口径、前期未开票后续开票确认、申报准备结果确认、税务申报、缴款、回执变更、税费缴款流水生成 |
| `社保公积金` | 确认、缴费、回单变更 |
| `薪酬社保` | 工资、绩效、社保、公积金、个税结果确认 |
| `账套初始化` | 启用后期初调整记账、撤回启用影响检查 |

Local route adapter coverage:

| Source area | Route shape in local skeleton |
| --- | --- |
| `应收应付` | `POST /api/finance/receivables-payables`, `PATCH /api/finance/receivables-payables/{id}/adjust`, `POST /api/finance/receivables-payables/{id}/settlements`, `POST /api/finance/receivables-payables/{id}/void`, `POST /api/finance/receivables-payables/{id}/tax-basis` |
| `发票台账` | `POST /api/finance/invoices/import` |
| `发票匹配` | `POST /api/finance/invoice-matching/{id}/match`, `POST /api/finance/invoice-matching/{id}/unmatch`, `PATCH /api/finance/invoice-matching/{id}/reassign-period`, `POST /api/finance/invoice-matching/{id}/red-original`, `POST /api/finance/invoice-matching/{id}/subsequent-invoice` |
| `收支流水` | `POST /api/finance/cash-flows/{id}/review`, `POST /api/finance/cash-flows/{id}/return`, `POST /api/finance/cash-flows/{id}/void`, `POST /api/finance/cash-flows/{id}/voucher-files`, `POST /api/finance/cash-flows/{id}/adjustments` |
| `银行对账` | `POST /api/finance/bank-reconciliation/{id}/confirm`, `POST /api/finance/bank-reconciliation/{id}/revoke`, `POST /api/finance/bank-reconciliation/{id}/system-flow`, `POST /api/finance/bank-reconciliation/{id}/adjustments`, `POST /api/finance/bank-reconciliation/{id}/resolve-exception` |
| `会计凭证` | `POST /api/finance/accounting-vouchers/prepare`, `POST /api/finance/accounting-vouchers/batch-prepare`, `POST /api/finance/accounting-vouchers/{id}/book`, `POST /api/finance/accounting-vouchers/batch-book`, `POST /api/finance/accounting-vouchers/{id}/reverse` |
| `申报准备 / 税务办理` | `POST /api/finance/declaration-preparation/{id}/confirm-item`, `POST /api/finance/declaration-preparation/{id}/unbilled-income`, `POST /api/finance/declaration-preparation/{id}/defer-unbilled-income`, `POST /api/finance/declaration-preparation/{id}/subsequent-invoice`, `POST /api/finance/declaration-preparation/{id}/confirm`, `POST /api/finance/tax-handling/{id}/declaration`, `POST /api/finance/tax-handling/{id}/payment`, `POST /api/finance/tax-handling/{id}/receipts` |
| `社保公积金` | `POST /api/finance/social-insurance/{id}/confirm-detail`, `POST /api/finance/social-insurance/{id}/confirm-payment`, `POST /api/finance/social-insurance/{id}/receipts` |
| `薪酬社保` | `POST /api/finance/payroll-results/{id}/confirm`, `POST /api/finance/payroll-results/{id}/settle`, `POST /api/finance/payroll-results/{id}/adjustments` |
| `账套初始化` | `POST /api/finance/ledger-initialization/{id}/opening-adjustment`, `POST /api/finance/ledger-initialization/{id}/withdraw-enable` |

Guard response when period is closed:

```json
{
  "code": "CLOSED_ACCOUNTING_PERIOD",
  "message": "该会计期间已结账，不能修改影响本期账务结果的单据。",
  "requestId": "req_xxx",
  "period": "2026-06",
  "sourceModule": "应收应付",
  "sourceId": "rp_123",
  "nextAction": "后续期间调整"
}
```

Rules:

- Hiding or disabling frontend buttons is not sufficient.
- Direct API calls must be rejected with the same error semantics.
- If a mutation changes `accountingPeriod`, the backend must validate both the
  original period and the target period when both affect accounting results.
- Backdated source facts into a closed period must be rejected unless a separate
  audited adjustment flow explicitly creates a later-period adjustment fact.
- `POST /api/finance/accounting-vouchers/{id}/later-period-adjustments` is not a
  normal closed-period source mutation. It must require the original voucher
  period to be closed and the target adjustment period to be open and later than
  the original period.
- Reopen is not a normal workaround for source mutations; it remains a separate
  high-permission exceptional flow.

## 8. Accounting Voucher Later-Period Adjustment Contract State

Later-period adjustment is the controlled correction path for booked vouchers
whose original accounting period is already closed. It is intentionally
different from reversal:

| Contract point | Required state |
| --- | --- |
| Original voucher | Must be persisted and `已记账` |
| Original period | Must be `已结账` |
| Target adjustment period | Must be later than the original period and unlocked; current V1 contract accepts `开放` |
| Created fact | A later-period adjustment source fact that can produce a target-period `调整凭证` candidate in `待记账` state |
| Original voucher mutation | Forbidden: do not mark the original voucher `已冲销`, do not write `reversed_by_voucher_id`, do not edit original lines, and do not rewrite historical general-ledger rows |
| General-ledger impact | None at source-fact creation time; only the later prepared and booked target-period adjustment voucher affects the target-period ledger |

Backend endpoint boundary:

```text
POST /api/finance/accounting-vouchers/{id}/later-period-adjustments
```

This endpoint is a dedicated audited correction endpoint, not a bypass of
`CLOSED_ACCOUNTING_PERIOD`. It must lock the original voucher, validate the
original voucher version, validate the original and target period states, create
the adjustment source fact idempotently, and return a recomputed target-period
`调整凭证` candidate.

Validation rules:

- Reject if the original voucher is not `已记账`.
- Reject if the original voucher is already reversed or is itself a reversal
  voucher.
- Reject if the original accounting period is not closed.
- Reject if `adjustmentPeriod` is not later than the original voucher period.
- Reject if the target adjustment period is locked or closed.
- Reject if the reason is empty.
- On every rejection, do not create the later-period adjustment source fact and
  do not mutate the original voucher.

Close-check integration:

- The created adjustment source fact appears in the target period as a
  `voucher_preparation` source.
- If the resulting candidate is complete and balanced, its candidate status is
  `待记账`; the target period cannot close while that adjustment matter remains
  unbooked.
- The original closed period remains queryable historical evidence and does not
  regain mutability.

Current evidence boundary:

- Frontend state is prototype evidence only: `/finance/accounting-vouchers`
  creates a session-local later-period `调整凭证` candidate, keeps the original
  voucher unchanged, and lets `/finance/general-ledger` consume it only after
  the ordinary frontend `记账` lifecycle.
- Backend local contract evidence now exists in
  `apps/api/src/finance/accountingVoucherLaterPeriodAdjustmentContract.ts` and
  `.test.ts`: the route skeleton uses server-owned actor/time context, guards
  idempotency and optimistic version, rejects closed or invalid target periods,
  and does not mutate the original voucher on success or failure.
- Backend local row-backed gateway evidence now exists in
  `apps/api/src/finance/financeHttpApiRepositoryGatewayContract.ts` and
  `.test.ts`: the request-shaped endpoint commits the later-period adjustment
  fact/idempotency/event to local candidate state, creates the target-period
  `待记账` voucher row, replays the same idempotency key without duplicate rows,
  and makes both target-period close-check reads and close submission reject
  while the candidate is pending.
- Backend local authorization contract evidence now exists in
  `apps/api/src/finance/periodCloseAuthorizationContract.ts` and related route
  tests: the framework-agnostic adapters reject missing period-close and
  source-mutation permission scopes before business state changes.
- Database migration, listening HTTP route integration, authorization
  middleware, SQL-backed idempotency, real voucher repository integration, and
  production transaction evidence are still missing.

## 9. Current Implementation Status

| Area | Status | Evidence |
| --- | --- | --- |
| Backend `close-checks` API | not implemented | Contract only in this document |
| Persistent period lock | partial skeleton | Data contract plus local persistence-boundary, repository-transaction harnesses, row-backed repository rows, and HTTP-shaped row-backed gateway contract in `apps/api/src/finance/periodClosePersistenceContract.ts`, `periodCloseRepositoryContract.ts`, `periodCloseDatabaseRepositoryContract.ts`, and `financeHttpApiRepositoryGatewayContract.ts`; no real database table, migration, SQL repository implementation, or transaction manager evidence |
| Authorization and permission gates | partial skeleton | `apps/api/src/finance/periodCloseAuthorizationContract.ts` plus local route tests enforce permission scopes for period read, close, reopen, and guarded source mutations before state changes. This is not real auth middleware, user-role mapping, or resource-scope enforcement |
| Database row/schema mapper contract | partial skeleton | `apps/api/src/finance/periodCloseDatabaseContract.ts` and `.test.ts` define six local row sets and map committed in-memory close state into candidate DB rows; this proves row-shape/invariant expectations only, not a migration or DB repository |
| Row-backed repository contract | partial skeleton | `apps/api/src/finance/periodCloseDatabaseRepositoryContract.ts` and `.test.ts` hydrate transaction state from candidate DB rows and commit results back to rows; `financeHttpApiRepositoryGatewayContract.ts` and `.test.ts` prove the HTTP-shaped close/source-write entry can commit and reread those rows. No real SQL driver, migration, DB transaction manager, lock mode, isolation level, or server integration |
| Reopen / reverse-close API | partial skeleton | Local domain, authorization contract, and framework-agnostic route adapter cover required `finance.accountingPeriod.reopen`, reason/version/idempotency/later-closed-period blocking; no real auth middleware, HTTP, database, or audit persistence |
| Source mutation backend guard | partial skeleton | `apps/api/src/finance/periodCloseSourceMutationGuard.ts` validates source-area registration, period resolution, old/new period checks, and canonical closed-period rejection; `apps/api/src/finance/periodCloseSourceMutationRoutes.ts` validates route-level direct API rejection before source mutation; `apps/api/src/finance/periodClosePersistenceContract.ts` proves the local transaction boundary keeps source rows unchanged on rejection; `periodCloseRepositoryContract.ts` and `financeHttpApiRepositoryGatewayContract.ts` prove a committed local row-backed period lock blocks later existing-source and create-source writes through the same request-shaped gateway; no real source API service integration |
| Accounting-voucher later-period adjustment | partial skeleton | Dedicated contract rules are documented here and in `docs/data/finance-accounting-voucher-ledger-contract.md`; local framework-agnostic implementation/tests exist in `apps/api/src/finance/accountingVoucherLaterPeriodAdjustmentContract.ts` and `.test.ts`; the row-backed HTTP gateway repository contract now commits local adjustment facts/idempotency/events and target-period `待记账` voucher rows, and uses those rows to block target-period close-check reads and close submission. No listening HTTP server, real auth middleware, SQL repository, database migration, production transaction, or formal voucher/ledger integration evidence exists |
| Frontend session guard | prototype only | Existing frontend evidence; not backend proof |
| Contract tests | partial skeleton | `corepack pnpm --filter @startupmanage/api test` covers local authorization, domain, persistence-boundary, repository transaction harness, database row/schema mapper, row-backed repository harness, HTTP-shaped gateway, row-backed HTTP gateway repository contract including create-source and existing-source guard paths, later-period adjustment candidate writeback and target close blocking, close/reopen route-adapter, source-guard adapter, source-mutation route-adapter, accounting-voucher reversal guard, and later-period adjustment semantics; no framework/server integration tests |
| Production readiness | not ready | No release, recovery, migration, or audit evidence |

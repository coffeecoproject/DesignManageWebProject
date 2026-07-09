# Finance Period Close Source Mutation Matrix

Status: `frontend_contract_matrix`

Date: `2026-07-04`

Owner: `财务管理 / 期间结账`

Canonical local matrix:

- `apps/web/src/features/finance/financePeriodCloseSourceMutationMatrix.ts`
- `apps/web/src/features/finance/financePeriodCloseSourceMutationMatrix.test.ts`

Related local API skeleton:

- `apps/api/src/finance/periodCloseSourceMutationGuard.ts`
- `apps/api/src/finance/periodCloseSourceMutationOperationMetadata.ts`
- `apps/api/src/finance/periodCloseSourceMutationRegistry.ts`
- `apps/api/src/finance/periodCloseSourceMutationRoutes.ts`

## 1. Purpose

This matrix records the current frontend source-write entry points that can
affect accounting-period results. It links each entry point to:

- owner page and module;
- frontend state-write boundary;
- accounting-period source;
- local backend-route skeleton shape;
- closed-period behavior;
- current local evidence.

It is a governance and drift-prevention artifact. It is not a backend
implementation, not database persistence, not real auth middleware, and not
production period-lock evidence.

## 2. Source Areas

| Source area | Owner pages | Accounting-period source | Local route skeleton coverage |
| --- | --- | --- | --- |
| `应收应付` | `/my-work/expense-review`, `/finance/receivables-payables` | source-generated receivable/payable accounting period; settlement occurrence month | create, adjust, settlement, void, tax-basis |
| `发票台账` | `/tax/invoices` | imported invoice ledger period | invoice import |
| `发票匹配` | `/tax/invoice-matching`, `/tax/invoices`, `/tax/declaration-preparation` | invoice period plus linked business/accrual period and red-original blue invoice period | match, unmatch, period reassignment, red-original, subsequent invoice |
| `收支流水` | `/finance/review`, `/finance/transactions` | transaction occurrence month and adjustment target month | review, return, void, voucher files, correction/difference |
| `银行对账` | `/finance/bank-reconciliation` | bank transaction period plus linked system cash-flow periods | confirm, revoke, system-flow creation, adjustment, exception resolution |
| `会计凭证` | `/finance/accounting-vouchers` | voucher source-fact accounting period and target later-adjustment period | prepare, batch prepare, book, batch book, reverse, later-period adjustment |
| `申报准备 / 税务办理` | `/tax/declaration-preparation`, `/tax/handling` | mapped tax/declaration accounting month and tax payment occurrence month | declaration-preparation decisions, declaration, payment, receipts |
| `社保公积金` | `/salary/social-insurance`, `/tax/handling` | salary/social-insurance payment month and payment occurrence month | detail confirmation, payment confirmation, receipts |
| `薪酬社保` | `/salary/monthly` | payroll result month | confirm, settle, adjustment |
| `账套初始化` | `/system/ledger-initialization` | first enabled period or opening-adjustment target period | opening adjustment, withdraw enablement |

## 3. Drift Prevention Rules

- New accounting-impacting source writes must be added to
  `financePeriodCloseSourceMutationMatrix.ts` before the related page or model
  is considered complete.
- Each matrix entry must declare an accounting-period source and closed-period
  behavior. A disabled button is not sufficient evidence.
- Direct route-style backend contract skeletons must reject closed periods
  before source row status, amount, period, version, or linkage changes.
- `发票台账` and `发票匹配` are separate domains: importing invoice facts writes
  invoice-ledger source rows, while matching writes invoice-business
  associations.
- Employee-facing drafts are not source mutations until they create or change
  receivable/payable, cash-flow, invoice, voucher, tax, payroll, social-
  insurance, or opening-balance facts.

## 4. Current Automated Evidence

| Evidence | Current status | Notes |
| --- | --- | --- |
| Frontend source matrix test | local automated | `financePeriodCloseSourceMutationMatrix.test.ts` checks source-area coverage, local route coverage, state-write coverage, invoice-ledger separation, required period-source copy, and closed-period behavior copy. |
| Local API source route test | local automated | `periodCloseSourceMutationRoutes.test.ts` checks route-level permission, open-period success, closed-period rejection, create-type source insertion, invoice import insertion, no cross-area writeback, and route consumption of shared period-check mode. |
| Local API guard test | local automated | `periodCloseSourceMutationGuard.test.ts` checks registered areas, labels, closed-period error, old/new period checks, unresolved period rejection, and accounting-voucher/ledger-initialization guard behavior. |
| Local API operation registry test | local automated | `periodCloseSourceMutationRegistry.test.ts` checks one-to-one alignment with ordinary route adapters, source-area coverage, period-source metadata, closed-period behavior metadata, create-type target-period checks, and keeps later-period adjustment outside ordinary direct mutation guards. |

## 5. Remaining Backend Evidence

This matrix does not close the backend gap. Future backend work still needs:

- real HTTP handlers or route registration;
- persisted `accounting_periods` lock reads inside source mutation
  transactions;
- source-table repositories and row-level unchanged-on-rejection evidence;
- real auth middleware and resource-scope permission checks;
- database migrations for source mutation guard events;
- integration tests for representative source APIs across each source area;
- release, rollback, and recovery evidence before production use.

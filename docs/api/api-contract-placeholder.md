# API Contract Placeholder

## 1. Status

Status: `partial_contract_draft`.

Most backend/API contracts remain undefined. Finance bank reconciliation has a
backend-facing contract draft, tax-basis/accounting-mapping now has a
backend-facing contract draft, and accounting-voucher/general-ledger now has an
expanded backend-facing contract before implementation.

## 2. API Inventory

| Endpoint | Method | Purpose | Auth | Request schema | Response schema | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/finance/bank-statement-imports/preview` | POST | Preview bank statement file, validate fields, detect duplicates, and propose matching rows | required; concrete scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-bank-reconciliation-contract.md` |
| `/api/finance/bank-statement-imports` | POST | Commit importable bank statement rows into the reconciliation pool | required; concrete scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-bank-reconciliation-contract.md` |
| `/api/finance/bank-reconciliation/items` | GET | List bank reconciliation work items | required; concrete scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-bank-reconciliation-contract.md` |
| `/api/finance/bank-reconciliation/items/{bankStatementId}` | GET | Read bank statement, linked system rows, and operation records | required; concrete scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-bank-reconciliation-contract.md` |
| `/api/finance/bank-reconciliation/items/{bankStatementId}/system-flows` | POST | Create a system cash-flow row from an unmatched bank row; row still enters cash-flow review | required; concrete scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-bank-reconciliation-contract.md` |
| `/api/finance/bank-reconciliation/items/{bankStatementId}/amount-adjustments` | POST | Create a bank-reconciliation amount-adjustment cash-flow row; row still enters cash-flow review | required; concrete scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-bank-reconciliation-contract.md` |
| `/api/finance/bank-reconciliation/items/{bankStatementId}/confirm` | POST | Confirm reconciliation after linked reviewed system rows offset the bank amount | required; concrete scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-bank-reconciliation-contract.md` |
| `/api/finance/bank-reconciliation/items/{bankStatementId}/reverse` | POST | Reverse a confirmed reconciliation with reason and audit event | required; concrete scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-bank-reconciliation-contract.md` |
| `/api/finance/tax-policy-profiles` | GET | List versioned tax-policy profiles by period/status | required; finance tax policy read scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/tax-policy-profiles` | POST | Create a draft tax-policy profile | required; finance tax policy write scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/tax-policy-profiles/{profileId}` | GET | Read tax-policy profile detail and events | required; finance tax policy read scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/tax-policy-profiles/{profileId}/activate` | POST | Activate tax-policy profile for its effective period | elevated permission required; no dual-approval flow | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/tax-policy-profiles/{profileId}/deactivate` | POST | Deactivate tax-policy profile for future use | elevated permission required | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/invoice-tax-facts` | GET | List immutable invoice tax facts by period, direction, and match status | required; finance invoice read scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/invoice-tax-facts/{invoiceId}` | GET | Read invoice tax fact detail | required; finance invoice read scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/invoice-imports/{importBatchId}/tax-facts/rebuild` | POST | Non-production/admin rebuild for invoice tax facts after parser changes | elevated permission required | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/receivable-payable-tax-facts` | GET | List receivable/payable tax readiness rows by accrual period/status | required; finance receivable/payable read scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/receivable-payables/{receivablePayableId}/tax-fact` | GET | Read source tax/accounting snapshot for one receivable/payable row | required; finance receivable/payable read scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/receivable-payables/{receivablePayableId}/tax-fact/rebuild` | POST | Rebuild source tax/accounting readiness from upstream facts | required; finance receivable/payable write scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/receivable-payables/{receivablePayableId}/tax-fact/confirm` | POST | Confirm source tax basis and accounting mapping snapshot for accrual use | required; finance receivable/payable confirm scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/accounting-subjects` | GET | List read-only accounting subject master data for display and mapping validation | required; accounting subject read scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/admin/finance/accounting-subjects` | POST | Optional system-admin accounting subject seed/maintenance endpoint; not exposed to business UI | system/admin only | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/admin/finance/accounting-subjects/{subjectCode}/deactivate` | POST | Optional system-admin accounting subject deactivation endpoint; not exposed to business UI | system/admin only | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/category-accounting-mappings` | GET | List finance-category to accounting-subject mappings for read-only business display and finance config | required; finance category read scope pending | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/category-accounting-mappings/{mappingId}` | PUT | Update effective finance-category accounting mapping from finance/system config only | elevated permission required; no dual-approval flow | documented draft | documented draft | backend_contract_draft | `docs/data/finance-tax-accounting-backend-contract.md` |
| `/api/finance/accounting-voucher-candidates` | GET | List server-derived voucher candidates from source facts | required; accounting voucher candidate-read scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/accounting-voucher-candidates/{candidateId}` | GET | Read server-recomputed candidate detail, proposed lines, source evidence, and issue reasons | required; accounting voucher candidate-read scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/accounting-vouchers/prepare` | POST | Prepare a complete candidate as a formal accounting voucher and allocate formal voucher number | required; accounting voucher prepare scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/accounting-vouchers/batch-prepare` | POST | Prepare multiple complete candidates with per-row results | required; accounting voucher batch-prepare scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/accounting-vouchers` | GET | List persisted accounting vouchers only | required; accounting voucher read scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/accounting-vouchers/{voucherId}` | GET | Read persisted voucher detail, lines, sources, and lifecycle events | required; accounting voucher read scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/accounting-vouchers/{voucherId}/post` | POST | Post a prepared voucher and write general-ledger entries atomically | required; accounting voucher post scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/accounting-vouchers/batch-post` | POST | Post multiple prepared vouchers with per-row results | required; accounting voucher batch-post scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/accounting-vouchers/{voucherId}/reverse` | POST | Reverse a posted voucher through a linked reversal voucher | required; accounting voucher reverse scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/general-ledger` | GET | List posted general-ledger entries | required; general ledger read scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/general-ledger/subjects/{subjectCode}` | GET | Read subject ledger entries and opening/closing summaries for a subject | required; general ledger read scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/general-ledger/balances` | GET | Read subject balances / trial balance for one period | required; general ledger balance-read scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/accounting-periods` | GET | List accounting periods, close metadata, voucher counts, and blocking candidate counts | required; accounting period read scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/accounting-periods/{period}/close-checks` | GET | Read period close blocking checks before month-end close | required; accounting period read scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/accounting-periods/{period}/close` | POST | Close an accounting period after voucher posting checks | required; accounting period close scope pending | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| `/api/finance/accounting-periods/{period}/reopen` | POST | Exceptional audited reopen of a closed accounting period | elevated permission required | documented draft | documented draft | backend_contract_expanded | `docs/data/finance-accounting-voucher-ledger-contract.md` |
| Other project APIs | TBD | Customer, task, people, performance, salary, tax, auth, storage, and operations APIs | TBD | TBD | TBD | planned_gap | Business and backend scope pending |

## 3. Contract Rules

- API fields must be documented before implementation.
- Validation and error semantics must be specified.
- Web consumers must be checked when contracts change.
- Contract tests are required before API readiness can be claimed.

## 4. Open Questions

- Is backend/API in first prototype scope?
- Which runtime and framework will own API behavior?
- What auth/resource scope applies to admin APIs?
- Will bank-statement import start with file parser only, or reserve an adapter
  for future bank API pull?

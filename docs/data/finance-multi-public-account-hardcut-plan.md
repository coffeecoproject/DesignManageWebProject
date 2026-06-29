# Finance Multi Public Account Hardcut Plan

Status: `hardcut_plan`.

Date: `2026-06-27`.

This plan is based on the current frontend code. It prepares a hard cut from a
single-name public-account model to a multi-public-account model. It is not a
database migration, backend API implementation, production release plan, or
authorization design.

## Confirmed Decisions

Confirmed on `2026-06-27`:

1. `/finance/public-account` is not kept as the current flat account-flow page.
   It is hard-cut in the same implementation into `账户台账`.
2. The active route should be renamed to `/finance/account-ledger`; the old
   `/finance/public-account` route and sidebar entry should be removed without a
   legacy redirect.
3. Public-account usage is kept coarse: `收款`, `付款`, and `银行对账`.
   Salary, social-insurance, tax, and internal-transfer source types do not
   become account-usage dimensions in the current frontend.
4. The first bank-import hardcut rejects multi-account bank files. Operators
   import one company public account at a time; automatic file splitting is
   deferred.

## 1. Goal

Move the finance flow from account-name strings to account identity snapshots.
Every cash-flow row, bank statement row, settlement registration, tax/social
payment, employee collection transfer, adjustment row, and bank reconciliation
relationship must carry:

```ts
type PublicAccountSnapshot = {
  accountHolder: string;
  accountTailNumber: string;
  bankName: string;
  displayName: string;
};

type PublicAccountRef = {
  publicAccountId: string;
  publicAccountSnapshot: PublicAccountSnapshot;
};
```

Final implementation should not keep the old finance-flow account fields as an
active compatibility layer:

- `settlementAccount: string`
- `settlementAccountType: '对公账户'`
- bank statement `accountName` as the matching key

Historical display must use the saved snapshot. Current configuration changes
must not rewrite historical finance rows.

## 2. Current Code Findings

### 2.1 Public Account Configuration

Current source:

- `apps/web/src/features/system/PublicAccountConfigState.tsx`
- `apps/web/src/features/system/SystemPublicAccountConfigPage.tsx`

Current shape:

```ts
type PublicAccountRecord = {
  id: string;
  displayName: string;
  bankName: string;
  accountHolder: string;
  accountTailNumber: string;
  openingBalance: number;
  status: '启用' | '停用';
  usage: Array<'收款' | '付款' | '银行对账'>;
};
```

Current limitations:

- `getDefaultPublicAccount` returns the first active account for a usage.
- `buildPublicAccountOptions` returns `{ label: displayName, value: id }`, but
  many consumers immediately convert `value` back to `label` and store only the
  display name.
- There is no explicit default-by-usage field.
- There is no opening-balance date.
- `usage` does not distinguish salary, social-insurance, tax, reimbursement, or
  internal transfer needs.

### 2.2 Finance Transaction

Current source:

- `apps/web/src/features/finance/financeData.ts`

Current shape:

```ts
type FinanceTransactionRecord = {
  paymentMethod: FinancePaymentMethod;
  settlementAccount: string;
  settlementAccountType: '对公账户';
};
```

Current limitations:

- All seed rows use `招商银行基本户`.
- There is no stable account id on the transaction.
- There is no account snapshot object.
- Any account rename in configuration cannot be distinguished from historical
  transaction display.
- `settlementAccountType` is always `对公账户`, so it no longer carries useful
  business information.

### 2.3 Settlement And Cash-Flow Creation Entrypoints

Current sources:

- `FinanceReceivablesPayablesPage.tsx`
- `FinanceReceivablesPayablesSettlementPanel.tsx`
- `financeReceivablesPayablesModel.ts`
- `MyExpenseCollectionPage.tsx`
- `myWorkExpenseCollectionModel.ts`
- `FinanceTaxFilingsPage.tsx`
- `financeTaxMatterModel.ts`
- `FinanceBankReconciliationPage.tsx`
- `financeBankReconciliationModel.ts`
- `financeTransactionAdjustmentModel.ts`

Current behavior:

- Receivable/payable settlement registration builds account options from
  public-account config, but stores the option label as `form.settlementAccount`.
- Employee collection stores a company account label on the employee-side record
  and copies that label into the generated finance row.
- Tax/social payment uses the first payment account label as default.
- Bank-side supplement creates a finance row with `settlementAccount:
  record.accountName`.
- Adjustment rows copy `originRecord.settlementAccount`.

Hardcut implication:

- All these forms and builders must pass `publicAccountId`, resolve a snapshot
  at creation time, and store that snapshot on the generated finance row.

### 2.4 Bank Reconciliation

Current sources:

- `financeBankImportContract.ts`
- `FinanceBankReconciliationPage.tsx`
- `financeBankReconciliationModel.ts`

Current bank statement shape:

```ts
type BankStatementRecord = {
  accountName: string;
  bankSerialNo: string;
  matchedTransactionIds: string[];
};
```

Current limitations:

- Bank import unique key is `accountName + bankSerialNo`.
- The page reads `publicAccountSeeds` directly instead of
  `usePublicAccountConfigState`, so runtime account configuration edits do not
  affect bank reconciliation.
- Candidate system rows are not account-id scoped.
- Cross-account matching is not structurally blocked.
- Imported bank statement rows do not carry the configured account id or account
  snapshot.

### 2.5 Business Overview And Public Account Page

Current sources:

- `financeBusinessOverviewModel.ts`
- `FinanceBusinessOverviewPage.tsx`
- `FinancePublicAccountPage.tsx`

Current behavior:

- Business overview cash balance uses the default account opening balance.
- Finance public-account page calculates one account balance using default
  configured account plus all reviewed public-account rows.
- The page is currently a filtered cash-flow query and overlaps with
  `收支流水`, `经营总览`, and `银行对账`.

Hardcut implication:

- `财务管理 / 对公账户` will be re-positioned in the same hardcut as `账户台账`.
  It must aggregate by account id, not by one default account.
- The active route becomes `/finance/account-ledger`; `/finance/public-account`
  is removed without redirect.

## 3. Target Data Model

### 3.1 `PublicAccountRecord`

Target frontend/backend-aligned shape:

```ts
type PublicAccountUsage =
  | '收款'
  | '付款'
  | '银行对账';

type PublicAccountRecord = {
  id: string;
  displayName: string;
  bankName: string;
  accountHolder: string;
  accountTailNumber: string;
  openingBalance: number;
  openingBalanceDate: string;
  status: '启用' | '停用';
  usage: PublicAccountUsage[];
  defaultFor: PublicAccountUsage[];
  note: string;
  updatedAt: string;
  operationRecords: OperationRecord[];
};
```

Rules:

- `id` is the only value stored by business forms.
- `displayName` is display-only.
- At most one active account can be default for one usage.
- A disabled account cannot be selected for new settlement/payment/import work.
- A disabled account remains visible for historical transaction and bank
  reconciliation records through snapshots.

### 3.2 `FinanceTransactionRecord`

Target shape:

```ts
type FinanceTransactionRecord = {
  publicAccountId: string;
  publicAccountSnapshot: PublicAccountSnapshot;
  paymentMethod: FinancePaymentMethod;
};
```

Rules:

- Remove active usage of `settlementAccount` and `settlementAccountType`.
- Payment method describes the business collection/payment channel, not account
  identity.
- Reviewed rows cannot change account id directly. If account is wrong, before
  review it must be returned for correction; after review it must go through
  reversal/correction flow.
- Adjustment rows inherit the original row account unless the explicit business
  operation is an internal transfer or account correction.

### 3.3 `BankStatementRecord`

Target shape:

```ts
type BankStatementRecord = {
  publicAccountId: string;
  publicAccountSnapshot: PublicAccountSnapshot;
  importedAccountName: string;
  bankSerialNo: string;
  matchedTransactionIds: string[];
};
```

Rules:

- Import unique key becomes `publicAccountId + bankSerialNo`.
- `importedAccountName` is raw bank-file evidence only.
- Candidate matching must filter system rows by `publicAccountId`.
- Bank statement and system transaction can only reconcile when account ids
  match.

### 3.4 Reconciliation Relationship

The existing bank reconciliation contract should continue to use the
relationship model:

- one bank statement row
- one primary reviewed finance transaction
- optional adjustment finance transactions

The account boundary is added to that relationship:

- all linked finance transactions must have the same `publicAccountId` as the
  bank statement.
- no cross-account amount offset is allowed.

## 4. Module Hardcut Plan

### 4.1 System / Public Account Configuration

Files:

- `PublicAccountConfigState.tsx`
- `SystemPublicAccountConfigPage.tsx`

Changes:

- Add `openingBalanceDate`.
- Add `defaultFor`.
- Keep `PublicAccountUsage` limited to coarse account capabilities:
  `收款`, `付款`, and `银行对账`.
- Add helpers:
  - `buildPublicAccountSnapshot(record)`
  - `resolvePublicAccountRef(rows, id)`
  - `resolveActivePublicAccountRef(rows, id, usage)`
  - `getDefaultPublicAccount(rows, usage)`
  - `buildPublicAccountOptions(rows, usage)` returning id values.
- Add at least two mock accounts to expose multi-account behavior in UI.
- Keep create/edit under `系统管理 / 对公账户配置`.

Validation:

- account display name unique among active and disabled rows.
- one usage can have only one default active account.
- disabled accounts cannot be returned by selectable option helpers.
- creation flows must resolve selected accounts through active account + usage
  checks; disabled or capability-mismatched accounts fail closed.

### 4.2 Receivables And Payables

Files:

- `FinanceReceivablesPayablesPage.tsx`
- `FinanceReceivablesPayablesSettlementPanel.tsx`
- `financeReceivablesPayablesModel.ts`

Changes:

- Settlement form stores `publicAccountId`, not account label.
- Settlement panel shows account option label, but submits account id.
- `buildFinanceReceivablePayableSettlementTransaction` receives a resolved
  `PublicAccountRef`.
- Generated finance transaction stores `publicAccountId` and
  `publicAccountSnapshot`.
- Existing linked settlement progress continues to be driven by finance
  transaction review status.

Business rule:

- Receivable/payable confirmation rows do not need account binding at source
  generation time. Account binding happens when finance registers actual
  receipt/payment.

### 4.3 Employee Expense And Collection

Files:

- `MyExpenseCollectionPage.tsx`
- `myWorkExpenseCollectionModel.ts`

Changes:

- Reimbursement records do not select a company public account at submission.
- Employee collection records store `publicAccountId` only when the employee has
  already transferred money into a company account.
- The employee-facing form must present account display labels but save account
  id.
- `buildFinanceTransactionFromMyWorkCollection` resolves the snapshot and writes
  it to the generated pending-review finance row.

Business rule:

- Employee personal cards, personal WeChat/Alipay, and temporary cash are not
  company public accounts.
- If employee collection has not entered a company account, it must not create a
  company public-account cash-flow row.

### 4.4 Tax, Social Insurance, And Salary Payments

Files:

- `FinanceTaxFilingsPage.tsx`
- `financeTaxMatterModel.ts`
- salary/social-insurance payment generation code that creates finance rows

Changes:

- Default payment account resolves by coarse `付款` usage.
- Salary, tax, and social-insurance source rows may carry their business
  source type, but account selection does not branch by those source types.
- Generated finance rows store `publicAccountId` and snapshot.
- Once a payment row enters review, account changes require return/correction.

### 4.5 Finance Transactions

Files:

- `FinanceTransactionsPage.tsx`
- `financeData.ts`
- `financeUtils.ts`
- `FinanceTransactionAdjustmentDrawer.tsx`
- `financeTransactionAdjustmentModel.ts`

Changes:

- Replace account display helper with snapshot display helper.
- Add account filter.
- Continue income/expense tabs; do not add direction column back.
- Adjustment rows inherit `publicAccountId` and snapshot from original row.
- Internal transfer must become a paired operation:
  - source account outflow row
  - target account inflow row
  - shared transfer group id

Business rule:

- Internal transfer changes account balances but net company cash is zero.
- Internal transfer should be excluded from operating income/cost reporting.

### 4.6 Cash-Flow Review

Files:

- `FinanceReviewPage.tsx`
- `financeReviewModel.ts`
- `FinanceManagementState.tsx`

Changes:

- Review drawer displays target public-account snapshot.
- Review action does not edit account id.
- Wrong account before review is handled by `退回修改`.
- Reviewed row account snapshot is locked for account ledger and bank
  reconciliation.

### 4.7 Bank Reconciliation

Files:

- `FinanceBankReconciliationPage.tsx`
- `financeBankImportContract.ts`
- `financeBankReconciliationModel.ts`
- `financeBankReconciliationModel.test.ts`

Changes:

- Use `usePublicAccountConfigState`, not static `publicAccountSeeds`, for the
  active account option list.
- Import drawer requires selected public account for the first hardcut version.
- Import precheck validates file account name against selected account snapshot.
- Import precheck blocks the whole file when rows map to multiple configured
  public accounts or include rows that cannot match the selected account.
- Unique key becomes `publicAccountId + bankSerialNo`.
- Candidate system rows filter by:
  - same public account id
  - compatible direction
  - reviewed or relevant pending status depending on queue state
- Amount adjustments inherit the bank statement `publicAccountId` and snapshot.
- Confirming reconciliation validates every linked finance row is same account.

Business rule:

- A bank file containing multiple accounts is rejected in the first
  implementation. Automatic multi-account detection and splitting is deferred.
- The operator must choose the target public account before import preview.

### 4.8 Business Overview

Files:

- `FinanceBusinessOverviewPage.tsx`
- `financeBusinessOverviewModel.ts`

Changes:

- Cash view adds account scope:
  - `全部账户`
  - one selected account
- Confirmed cash balance is calculated from:
  - selected account opening balance
  - reviewed finance rows for selected account
- Pending review and unreconciled amounts are shown separately.
- Accrual view remains account-independent.

Business rule:

- System book balance is not the same as bank real balance.
- Bank real balance can only be claimed after bank statement import/reconciliation
  supports it.

### 4.9 Account Ledger Page

Current route to remove:

- `/finance/public-account`

Target route:

- `/finance/account-ledger`

Hardcut:

- Rename navigation label from `对公账户` to `账户台账`.
- Remove `/finance/public-account` as an active route with no legacy redirect.
- Rebuild the page as an account-first ledger, not as a duplicated flat
  transaction list.
- Table one row per public account.
- metrics per account:
  - opening balance
  - reviewed balance
  - current-period inflow
  - current-period outflow
  - pending-review net amount
  - unreconciled amount
- drawer shows account-ledger transactions filtered by account id.
- no create/edit actions; account maintenance remains in
  `系统管理 / 对公账户配置`.
- Account detail can include tabs:
  - `账户概览`
  - `账户流水`
  - `未复核`
  - `未对账`
- Account ledger must not expose payment/receipt registration, cash-flow review,
  bank reconciliation confirmation, or account configuration actions.

## 5. Hardcut Order

### Step 1: Types And Seeds

- Add `PublicAccountSnapshot` and `PublicAccountRef`.
- Add account snapshot helper functions.
- Add active account resolution for selected-account flows.
- Expand public-account seed data to at least two enabled accounts.
- Replace finance transaction seed rows with account ids and snapshots.
- Replace bank statement seed rows with account ids and snapshots.

Exit criteria:

- `rg` finds no active finance source reliance on `settlementAccount` or
  `settlementAccountType`.
- Typecheck passes.

### Step 2: Creation Flows

- Update receivable/payable settlement registration.
- Update employee collection transfer submission.
- Update tax/social payment generation.
- Update bank-side supplement generation.
- Update correction/adjustment generation.

Exit criteria:

- Every generated `FinanceTransactionRecord` has `publicAccountId` and
  `publicAccountSnapshot`.
- Unit tests cover each creation source.

### Step 3: Finance List And Review Pages

- Update `收支流水` account display/filter.
- Update `流水复核` account display and wrong-account return boundary.
- Update voucher and detail tables to use snapshot account facts.

Exit criteria:

- No page renders a current account config name for a historical finance row
  unless that name is from the row snapshot.

### Step 4: Bank Reconciliation

- Update bank import unique key.
- Add selected account requirement in import.
- Block import when no enabled account supports `银行对账`.
- Scope candidate system rows by account id.
- Scope amount adjustment and confirmation by account id.

Exit criteria:

- Unit tests prove same serial number can exist under different accounts.
- Unit tests prove cross-account candidate matching is blocked.
- Unit tests prove adjustment row inherits bank statement account.

### Step 5: Overview And Account Ledger

- Add cash-view account scope to `经营总览`.
- Rename `/finance/public-account` to `/finance/account-ledger` and rebuild it
  as account-first `账户台账`.
- Remove old `/finance/public-account` route/sidebar entry without redirect.

Exit criteria:

- `经营总览` all-account and single-account cash numbers differ when seed data
  uses multiple accounts.
- account ledger does not duplicate `收支流水` as a simple flat list.
- `/finance/public-account` renders not found after hardcut.
- `/finance/account-ledger` renders account-first rows and drawer facts.

### Step 6: Documentation And Gates

- Update data/API contracts.
- Update route inventory.
- Update frontend evidence and test plan.
- Run full frontend gates.

## 6. Verification Plan

Required commands after implementation:

```text
corepack pnpm typecheck
corepack pnpm test:web
corepack pnpm lint
corepack pnpm build:web
git diff --check
```

Required residual scans:

```text
rg -n "settlementAccount|settlementAccountType" apps/web/src/features/finance apps/web/src/features/my-work
rg -n "accountName: publicAccountName|buildBankStatementUniqueKey\\(record: Pick<BankStatementRecord, 'accountName'" apps/web/src
rg -n "buildPublicAccountOptions\\([^\\n]+\\)\\.map\\(\\(option\\).*option\\.label" apps/web/src
```

Expected residuals after hardcut:

- employee personal `accountName` fields are allowed in personnel payment
  profiles.
- raw bank-file `importedAccountName` is allowed as evidence.
- `settlementAccount` should not remain in finance transaction or settlement
  form models.

## 7. Open Decisions

Resolved decisions:

1. `/finance/public-account` becomes `/finance/account-ledger` and page label
   `账户台账` in the same hardcut.
2. Public-account usage expands now to salary/social/tax/internal-transfer
   usage.
3. Bank import first version rejects multi-account files.

Remaining decisions:

1. Should internal transfer be fully built in this hardcut or only reserve the
   account usage and data model?
2. Should opening balance require an opening-balance date before any balance
   metric is shown?

## 8. Non-Goals

- No production database migration in this plan.
- No bank API integration in this plan.
- No accounting voucher posting in this plan.
- No online payment execution in this plan.
- No change to system role/authorization visibility in this plan.

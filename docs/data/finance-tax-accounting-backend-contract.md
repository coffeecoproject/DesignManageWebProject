# Finance Tax Basis And Accounting Mapping Backend Contract

Status: `backend_contract_draft`

Last updated: `2026-07-10`

Owner: `财务管理 / 税务管理 / 系统管理`

Related contracts:

- `docs/data/finance-accounting-voucher-ledger-contract.md`
- `docs/data/frontend-cross-module-contracts.md`
- `docs/api/api-contract-placeholder.md`
- `docs/governance/finance-accounting-backend-implementation-preplan-v1.md`

## 1. Purpose

This contract defines the backend boundary for tax-basis facts and accounting
subject mapping before accounting voucher generation.

The goal is to avoid treating frontend mock calculation as the official tax or
accounting engine. Frontend pages may continue to show prototype results, but
backend implementation must own the durable facts that accounting vouchers,
declaration preparation, and later ledger/reporting APIs consume.

## 2. Core Boundary

| Area | Backend owner | Frontend boundary |
| --- | --- | --- |
| Tax policy profile | versioned backend tax policy profile | `financeTaxPolicyModel.ts` is mock fallback only |
| Imported invoice tax facts | invoice import and invoice ledger services | frontend displays invoice tax amount and match status |
| Receivable/payable source tax facts | receivable/payable confirmation service | frontend displays readiness and source snapshot |
| Accounting subjects | system-maintained accounting subject master-data service | business-side frontend displays active subject names/codes only |
| Finance-category accounting mapping | finance-owned finance category config service | business-side frontend displays mapping readiness only |
| Voucher tax/accounting basis | accounting candidate service | frontend consumes candidate response, not page-local rules |

Rules:

- Backend is the source of truth for active tax-policy profile versions.
- No dual-approval workflow is required in this project baseline. Controlled
  finance/system configuration still requires operator identity, effective
  period, and audit events.
- Imported invoice rows keep their own tax rate, tax amount, taxable
  classification, VAT treatment, invoice kind, and red/blue relationship. A
  later policy change must not rewrite imported invoice tax facts.
- Receivable/payable confirmation snapshots the tax basis and accounting
  mapping used for accrual recognition.
- Accounting voucher candidates consume backend source facts, tax facts, invoice
  facts, and accounting mappings. They must reject stale source hashes instead
  of trusting previously rendered frontend rows.
- Accounting subjects are system-maintained and business-side read-only. Normal
  business users must not create, edit, deactivate, or pick accounting subjects
  on business documents.
- Finance-category to accounting-subject mappings are finance configuration,
  not business document fields. Business documents choose business/finance
  categories; they may display the resolved accounting subject but cannot edit
  the mapping.
- Frontend tax and accounting models remain acceptable only as local prototype
  fallback until backend repository adapters are introduced.

## 3. Minimal Data Model

### `tax_policy_profiles`

Versioned tax policy profile for the current company/legal entity.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `profile_code` | text | yes | stable profile code, for example `default-small-scale-v1` |
| `taxpayer_type` | enum | yes | `小规模纳税人` or `一般纳税人` |
| `region_code` | text | no | reserved for regional policy differences |
| `region_name` | text | no | display snapshot |
| `effective_from` | date | yes | inclusive |
| `effective_to` | date | no | null means current until replaced |
| `status` | enum | yes | `草稿`, `生效中`, `已停用` |
| `vat_calculation_method` | enum | yes | `价税分离`, `简易计税`, or later extension |
| `output_default_tax_rate` | numeric(9,6) | yes | stored as decimal, not float |
| `input_default_tax_rate` | numeric(9,6) | yes | stored as decimal |
| `input_tax_treatment` | enum | yes | `计入成本费用`, `可抵扣`, `不可抵扣` |
| `input_deductible` | boolean | yes | first version is false for small-scale profile |
| `vat_declaration_cycle` | enum | yes | `月度`, `季度` |
| `vat_quarterly_exemption_threshold` | numeric(18,2) | no | snapshot of configured threshold |
| `vat_legal_levy_rate` | numeric(9,6) | yes | legal levy rate snapshot, for example `0.030000` |
| `vat_reduced_levy_rate` | numeric(9,6) | no | temporary reduced levy rate, for example `0.010000` |
| `vat_taxable_classification_rules` | jsonb | yes | ordinary taxable, exempt, real-estate/land, and non-taxable rule set |
| `vat_special_invoice_waiver_rule` | jsonb | yes | whether partial exemption/reduction waiver is allowed and special-invoice treatment |
| `urban_maintenance_tax_rate` | numeric(9,6) | no | local urban maintenance construction tax rate |
| `education_surcharge_rate` | numeric(9,6) | no | education surcharge rate |
| `local_education_surcharge_rate` | numeric(9,6) | no | local education surcharge rate |
| `tax_fee_reduction_rate` | numeric(9,6) | no | qualified six-tax-and-two-fee reduction rate |
| `tax_fee_reduction_eligibility` | enum | yes | `符合`, `不符合`, or `待确认`; no automatic reduction when unresolved |
| `cit_prepayment_cycle` | enum | no | currently `季度` in frontend prototype |
| `rule_packages` | jsonb | no | period-effective individual-income-tax, stamp-duty, and other tax rule package references |
| `official_source_refs` | jsonb | no | policy source references, document ids, remarks |
| `activated_by` | uuid | no | required when status becomes `生效中` |
| `activated_at` | timestamptz | no | activation timestamp |
| `version` | integer | yes | optimistic version |

Constraints:

- Only one `生效中` profile can cover the same legal entity and accounting
  period.
- A profile already referenced by confirmed source facts cannot be edited in
  place. Create a new version instead.
- A source period with no covering `生效中` profile must be rejected; it must not
  fall back to the newest profile.

### `tax_policy_profile_events`

Append-only event log for profile lifecycle.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `profile_id` | uuid | yes | references `tax_policy_profiles` |
| `event_type` | enum | yes | `创建`, `启用`, `停用`, `新版本` |
| `actor_id` | uuid | yes | operator |
| `occurred_at` | timestamptz | yes | event time |
| `summary` | text | yes | concise audit summary |

### `invoice_tax_facts`

Immutable tax facts derived from invoice import or invoice ledger confirmation.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `invoice_id` | uuid | yes | invoice ledger row |
| `invoice_no` | text | yes | invoice number snapshot |
| `invoice_date` | date | yes | invoice date |
| `accounting_period` | char(7) | yes | `YYYY-MM` period for accounting use |
| `direction` | enum | yes | `销项`, `进项` |
| `invoice_kind` | text | yes | special/normal/electronic etc. |
| `invoice_color` | enum | yes | `蓝票`, `红票` |
| `invoice_status` | enum | yes | `正常`, `作废`, `红冲` |
| `counterparty_name` | text | yes | snapshot |
| `taxable_classification` | enum | yes | `普通应税交易`, `免税交易`, `不动产或土地交易`, `不征税` |
| `vat_treatment` | enum | yes | `免税`, `减按1%`, `按法定征收率`, `不涉及` snapshot |
| `policy_profile_id` | uuid | yes | profile resolved by invoice accounting period |
| `tax_rate` | numeric(9,6) | yes | invoice tax rate |
| `tax_excluded_amount` | numeric(18,2) | yes | amount before tax |
| `tax_amount` | numeric(18,2) | yes | tax amount |
| `tax_included_amount` | numeric(18,2) | yes | total amount |
| `source_file_id` | uuid | no | original file or OCR source |
| `import_batch_id` | uuid | no | import batch |
| `original_invoice_id` | uuid | no | required for red invoice when available |
| `declaration_treatment` | text | yes | declaration treatment snapshot |
| `match_status` | enum | yes | `待匹配`, `已匹配`, `部分匹配`, `异常` |
| `source_hash` | text | yes | hash of invoice tax fields |
| `version` | integer | yes | optimistic version |

Rules:

- Imported invoice facts are not recalculated from the active tax policy.
- Red invoices must keep the original blue-invoice relationship when known.
- A special invoice that waives exemption or reduction retains its own VAT
  treatment even when the declaration-period sales stay below the threshold.
- Accounting voucher candidates can reference invoice facts as evidence and tax
  basis, but ordinary cash-flow numbers are not the accrual invoice matching key.

### `unbilled_income_tax_facts`

Tax facts confirmed for revenue that has incurred VAT liability before an
invoice is issued.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `transaction_id` | uuid | yes | reviewed income source row |
| `accounting_period` | char(7) | yes | declaration accounting period |
| `policy_profile_id` | uuid | yes | profile resolved for the declaration period |
| `taxable_classification` | enum | yes | same taxonomy as invoice tax facts |
| `tax_rate` | numeric(9,6) | yes | confirmed or rule-derived rate |
| `vat_treatment` | enum | yes | declaration treatment snapshot |
| `net_amount` | numeric(18,2) | yes | tax-exclusive income amount |
| `source_hash` | text | yes | reviewed source and tax-fact snapshot |
| `confirmed_by` | uuid | yes | confirmation operator |
| `confirmed_at` | timestamptz | yes | confirmation time |

Rules:

- The declaration preparation must not assume every unbilled income row is an
  ordinary taxable transaction.
- A missing unbilled-income tax fact blocks tax-basis confirmation instead of
  silently applying a default rate.

### `receivable_payable_tax_facts`

Tax and accounting snapshots attached to confirmed receivable/payable items.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `receivable_payable_id` | uuid | yes | source id |
| `source_no` | text | yes | source display number |
| `direction` | enum | yes | `应收`, `应付` |
| `source_type` | text | yes | contract, salary, social insurance, expense reimbursement, tax matter, etc. |
| `accounting_period` | char(7) | yes | accrual period, not settlement month |
| `policy_profile_id` | uuid | yes | referenced active policy profile |
| `basis_source` | enum | yes | `来源单据`, `发票`, `人工确认`, `系统规则` |
| `finance_category_id` | uuid | yes | source finance category |
| `accounting_subject_code` | text | yes | mapped subject code snapshot |
| `accounting_subject_name` | text | yes | mapped subject name snapshot |
| `tax_rate` | numeric(9,6) | yes | resolved tax rate |
| `taxable_classification` | enum | yes | resolved VAT transaction classification |
| `vat_treatment` | enum | yes | resolved VAT treatment snapshot |
| `tax_excluded_amount` | numeric(18,2) | yes | amount before tax |
| `tax_amount` | numeric(18,2) | yes | tax amount |
| `tax_included_amount` | numeric(18,2) | yes | total confirmation amount |
| `input_tax_treatment` | enum | no | required for input-side facts |
| `invoice_evidence_status` | enum | yes | `发票已匹配`, `发票部分匹配`, `发票待补`, `不需要发票` |
| `matched_invoice_amount` | numeric(18,2) | yes | matched invoice total amount |
| `readiness_status` | enum | yes | `待补资料`, `待补票税`, `待配置`, `可确认`, `已确认`, `已作废` |
| `source_hash` | text | yes | hash of upstream source fields and tax/accounting snapshot |
| `confirmed_by` | uuid | no | required when confirmed |
| `confirmed_at` | timestamptz | no | confirmation timestamp |
| `version` | integer | yes | optimistic version |

Rules:

- Confirmed source tax facts become the accrual fallback when invoices are
  missing or partial.
- A source fact with missing accounting-subject mapping must stay `待配置`.
- A source fact with no usable tax basis must stay `待补票税` or `待补资料`.
- Once the accounting period is closed, source tax fact rebuild/confirm is
  rejected.

### `tax_filing_matters`

Durable tax-handling aggregate created from a confirmed declaration-preparation
snapshot. It records external filing and payment facts; it does not recalculate
the preparation result.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `matter_no` | text | yes | stable business number |
| `preparation_id` | uuid | yes | confirmed declaration-preparation snapshot |
| `tax_type` | enum | yes | VAT/surcharge, IIT, CIT, stamp duty, etc. |
| `period` | text | yes | month, quarter, year, or occurrence period |
| `prepared_payable_amount` | numeric(18,2) | yes | immutable system-prepared amount |
| `official_payable_amount` | numeric(18,2) | no | actual result returned by the official system |
| `official_refundable_amount` | numeric(18,2) | no | actual refundable amount returned by the official system |
| `declaration_status` | enum | yes | `待申报`, `已申报`, `已核定`, `零申报`, `无需申报`, `已作废` |
| `process_status` | enum | yes | `待申报`, `待缴款`, `部分缴纳`, `待补回执`, `已完成` |
| `declaration_version` | integer | yes | starts at 1 and increases after correction/void |
| `declaration_date` | date | no | actual filing date, never inferred from upload time |
| `declaration_receipt_no` | text | no | official filing/acceptance number |
| `declaration_receipt_file_id` | uuid | no | archived declaration receipt |
| `difference_reason` | text | no | required when prepared and official amounts differ |
| `paid_amount` | numeric(18,2) | yes | derived sum of effective payment results |
| `refunded_amount` | numeric(18,2) | yes | derived sum of effective refund results |
| `payment_status` | enum | yes | `未开始`, `无需缴纳`, `待缴纳`, `部分缴纳`, `已缴纳` |
| `version` | integer | yes | optimistic concurrency version |

Rules:

- Only confirmed declaration preparation can create or refresh a matter before
  the first official filing result is recorded.
- The prepared amount remains immutable evidence. An official amount difference
  is stored explicitly with a reason instead of overwriting the prepared value.
- A filing result and a payment result are separate commands. Opening an
  external tax platform does not advance either status.
- `process_status` is only the next operator action. Accounting readiness,
  evidence completeness, and cash settlement are separately derived views and
  must never be inferred from `process_status = 已完成`.
- Accounting readiness is reached after the official filing result and filing
  receipt are recorded. A later payment or refund is not an accrual-voucher
  prerequisite. Social insurance and housing-fund accrual readiness instead
  comes from their confirmed contribution schedules.
- A payable declaration can be paid in multiple effective payment records. The
  matter is complete only after the official result, required receipts, and full
  payment are all present.
- Correction/void appends the current filing version to history, then opens a
  new declaration version. It never rewrites the historical filing result.
- Correction after an effective payment requires a separate refund/credit or
  additional-payment workflow; the first backend version must reject silent
  replacement of paid results.

### `tax_filing_declaration_history`

Append-only declaration-version history.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `matter_id` | uuid | yes | filing matter |
| `declaration_version` | integer | yes | archived version |
| `action` | enum | yes | `更正` or `作废` |
| `declaration_status` | text | yes | prior official result |
| `official_payable_amount` | numeric(18,2) | yes | prior official amount |
| `declaration_date` | date | no | prior filing date |
| `declaration_receipt_no` | text | no | prior official number |
| `declaration_receipt_file_id` | uuid | no | prior receipt evidence |
| `reason` | text | yes | operator-entered reason |
| `operated_by` | uuid | yes | operator identity |
| `operated_at` | timestamptz | yes | operation time |

### `tax_filing_payments`

One row per actual payment result. Partial payment therefore creates multiple
rows and multiple pending-review finance transactions rather than mutating a
single payment field.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `matter_id` | uuid | yes | filing matter |
| `amount` | numeric(18,2) | yes | positive amount, not above outstanding amount |
| `payment_date` | date | yes | actual payment date |
| `public_account_id` | uuid | yes | company payment account |
| `payment_receipt_file_id` | uuid | yes | payment evidence |
| `finance_transaction_id` | uuid | yes | generated pending-review transaction |
| `status` | enum | yes | `有效` or `已冲正` |
| `created_by` | uuid | yes | operator identity |
| `created_at` | timestamptz | yes | operation time |

The payment row, generated finance transaction, matter paid amount, and matter
status must be committed in one database transaction. An idempotency key is
required so retries cannot create duplicate payment transactions.

### `accounting_subjects`

Accounting subject master data.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `code` | text | yes | accounting subject code |
| `name` | text | yes | display name |
| `subject_type` | enum | yes | asset, liability, equity, income, cost, expense |
| `balance_direction` | enum | yes | debit or credit |
| `parent_code` | text | no | hierarchy |
| `statement_target` | text | no | later reporting target |
| `status` | enum | yes | `启用`, `停用` |
| `effective_from` | date | yes | inclusive |
| `effective_to` | date | no | exclusive when stopped |
| `version` | integer | yes | optimistic version |

Rules:

- Accounting subjects are seeded or maintained by system/finance
  administration outside normal business document flows.
- Business modules and ordinary finance operation pages may read subject
  snapshots, but they must not expose accounting-subject create/edit/deactivate
  controls.
- Subject changes must not rewrite confirmed source facts or prepared/posted
  vouchers.

### `finance_category_accounting_mappings`

Mapping from finance category to accounting subject.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | uuid | yes | primary key |
| `first_category_id` | uuid | yes | first-level finance category |
| `second_category_id` | uuid | yes | second-level finance category |
| `direction` | enum | yes | income/payment/accrual direction |
| `accounting_subject_code` | text | yes | active subject code |
| `effective_from` | date | yes | inclusive |
| `effective_to` | date | no | null for current |
| `status` | enum | yes | `启用`, `停用` |
| `changed_by` | uuid | yes | finance/system operator |
| `changed_at` | timestamptz | yes | change timestamp |
| `change_reason` | text | no | required by policy when changing an existing mapping |
| `version` | integer | yes | optimistic version |

Rules:

- Voucher candidates cannot silently fall back to a default administrative
  expense subject or any other default subject when mapping is missing.
- Mapping changes are effective by date. Existing confirmed source facts keep
  their old subject snapshot.
- Mapping is finance configuration. Business documents, employee self-service
  pages, and ordinary business modules can only read the resolved mapping; they
  cannot edit mapping rows or choose accounting subjects directly.
- No approval workflow is required for mapping changes in the current baseline.
  Effective period, operator, timestamp, and event log are the required
  controls.

## 4. State Models

### Tax Policy Profile

```text
草稿 -> 生效中 -> 已停用
```

No in-place edits are allowed after a profile has been referenced by confirmed
source facts. Create a new version for future periods. There is no dual-approval
workflow in the current baseline; activation is a controlled system/finance
configuration action with audit events.

### Source Tax Fact Readiness

```text
待补资料
待补票税
待配置
可确认
已确认
已作废
```

Meaning:

- `待补资料`: source document or original evidence is incomplete.
- `待补票税`: tax basis is missing or invoice/source tax fact is not usable.
- `待配置`: finance category or accounting subject mapping is missing.
- `可确认`: source is complete and can be confirmed for accrual recognition.
- `已确认`: source tax and accounting snapshot is locked for voucher candidate
  consumption.
- `已作废`: source was voided and must not create candidates.

### Invoice Tax Fact Matching

```text
待匹配
已匹配
部分匹配
异常
```

Invoice matching affects evidence and tax-basis preference. It does not directly
create cash facts.

### VAT Declaration Calculation Snapshot

The declaration-preparation service resolves one active policy profile from the
declaration accounting period, then stores an immutable calculation snapshot.

1. Bucket output invoices and confirmed unbilled-income facts by taxable
   classification and VAT treatment.
2. Determine the threshold sales base from applicable taxable transactions for
   the same declaration period. A special invoice remains in that sales base,
   while its own invoice VAT treatment remains authoritative.
3. Calculate VAT from invoice facts and confirmed unbilled-income facts; do not
   overwrite special-invoice VAT with a zero amount merely because the period is
   below the threshold.
4. Calculate urban maintenance construction tax, education surcharge, and
   local education surcharge separately; apply the qualified reduction only
   when the policy profile and taxpayer-eligibility snapshot are both `符合`.
5. Keep the electronic-tax-bureau filing result and receipt as the final
   external result; they do not mutate the source invoice facts.

### Tax Filing Matter

```text
confirmed preparation -> 待申报
待申报 -> 待缴款 | 待退税 | 待补回执 | 已完成
待缴款 -> 部分缴纳 -> 已完成
待退税 -> 部分退税 -> 已完成
待缴款 -> 已完成
已完成 | 待缴款 -> 更正/作废 -> 待申报 (new declaration version)
```

- `待补回执` means an official result exists but its required declaration
  receipt is missing. It is not an approval status.
- Declaration evidence is an independent dimension from the next settlement
  action. An officially filed payable item may be both `待缴款` and
  `待补回执`; clients must not hide the missing evidence merely because cash
  settlement is still pending.
- The `补充申报回执` command may only add the declaration receipt file or
  receipt number. It must not rewrite the declaration result, settlement
  direction, official payable/refundable amount, or declaration version.
- `部分缴纳` is derived from effective payment rows and the official payable
  amount. It is never set directly by the client.
- A zero/no-payment declaration becomes complete after the filing result and
  declaration receipt are recorded.
- A payable declaration becomes complete only when the effective payment sum
  equals the official payable amount and both filing and payment evidence are
  complete.
- A correction compares the new official net settlement with all effective
  historical payments and refunds. The difference may reopen either a payment
  or a refund action. Accounting creates a versioned difference voucher rather
  than replacing a booked prior version.
- Period close checks accounting readiness and booked tax vouchers. It does not
  wait for a payment or refund whose cash date belongs to a later period.

## 5. API Draft

All mutating endpoints require authorization, optimistic `version`, and
`idempotencyKey` where applicable. Amounts are decimal strings in JSON
responses and requests.

### Tax Policy Profiles

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/finance/tax-policy-profiles` | GET | list policy profiles by period/status |
| `/api/finance/tax-policy-profiles` | POST | create draft profile |
| `/api/finance/tax-policy-profiles/{profileId}` | GET | read profile detail and events |
| `/api/finance/tax-policy-profiles/{profileId}/activate` | POST | activate profile for its effective period |
| `/api/finance/tax-policy-profiles/{profileId}/deactivate` | POST | deactivate profile for future use |

Example response:

```json
{
  "id": "tax-profile-2026-small-scale",
  "profileCode": "default-small-scale-v1",
  "taxpayerType": "小规模纳税人",
  "effectiveFrom": "2026-01-01",
  "effectiveTo": null,
  "status": "生效中",
  "vatCalculationMethod": "价税分离",
  "outputDefaultTaxRate": "0.010000",
  "inputTaxTreatment": "计入成本费用",
  "inputDeductible": false,
  "vatDeclarationCycle": "季度",
  "vatQuarterlyExemptionThreshold": "300000.00",
  "vatLegalLevyRate": "0.030000",
  "vatReducedLevyRate": "0.010000",
  "vatSpecialInvoiceWaiverRule": {
    "supportsPartialExemptionWaiver": true,
    "supportsPartialReductionWaiver": true
  },
  "surchargePolicy": {
    "urbanMaintenanceTaxRate": "0.070000",
    "educationSurchargeRate": "0.030000",
    "localEducationSurchargeRate": "0.020000",
    "taxFeeReductionRate": "0.500000"
  },
  "version": 3
}
```

### Invoice Tax Facts

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/finance/invoice-tax-facts` | GET | list invoice tax facts by period, direction, match status |
| `/api/finance/invoice-tax-facts/{invoiceId}` | GET | read invoice tax fact detail |
| `/api/finance/invoice-imports/{importBatchId}/tax-facts/rebuild` | POST | non-production/admin rebuild after import parser changes |

### Receivable/Payable Tax Facts

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/finance/receivable-payable-tax-facts` | GET | list readiness rows by accrual period/status |
| `/api/finance/receivable-payables/{receivablePayableId}/tax-fact` | GET | read source tax fact detail |
| `/api/finance/receivable-payables/{receivablePayableId}/tax-fact/rebuild` | POST | rebuild candidate tax/accounting snapshot from source facts |
| `/api/finance/receivable-payables/{receivablePayableId}/tax-fact/confirm` | POST | confirm source tax and accounting snapshot |

Example confirm request:

```json
{
  "version": 4,
  "idempotencyKey": "rp-tax-confirm-AR-202606-001-v4",
  "confirmedTaxIncludedAmount": "68000.00",
  "confirmedTaxAmount": "673.27",
  "accountingSubjectCode": "1122",
  "sourceHash": "sha256:..."
}
```

### Tax Filing Matters

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/finance/tax-filing-matters` | GET | list matters by filing period, tax type, and derived process scope |
| `/api/finance/tax-filing-matters/{matterId}` | GET | read matter, preparation snapshot, declaration history, payments, files, and audit events |
| `/api/finance/tax-filing-matters/{matterId}/declaration-results` | POST | record one official filing result and archive its receipt |
| `/api/finance/tax-filing-matters/{matterId}/payments` | POST | record one actual payment and atomically create a pending-review finance transaction |
| `/api/finance/tax-filing-matters/{matterId}/revisions` | POST | start correction/void and append the prior declaration version to history |

Commands reject stale `version` values. The declaration-result command requires
an official result status, actual filing date, official payable amount, and
declaration receipt. A difference reason is required when the official and
prepared amounts differ. The payment command requires a positive amount not
above the current outstanding amount, actual payment date, company account,
and payment receipt.

### Accounting Subjects And Category Mappings

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/finance/accounting-subjects` | GET | list read-only accounting subjects for display and mapping validation |
| `/api/admin/finance/accounting-subjects` | POST | optional system-admin seed/maintenance endpoint; not exposed to business UI |
| `/api/admin/finance/accounting-subjects/{subjectCode}/deactivate` | POST | optional system-admin deactivation endpoint; not exposed to business UI |
| `/api/finance/category-accounting-mappings` | GET | list finance-category accounting mappings for read-only business display and finance config |
| `/api/finance/category-accounting-mappings/{mappingId}` | PUT | update effective mapping from finance/system config only |

## 6. Error Codes

| Code | Meaning |
| --- | --- |
| `TAX_POLICY_PROFILE_MISSING` | no active tax policy profile covers the accounting period |
| `TAX_POLICY_VERSION_INACTIVE` | requested profile is not active for the source period |
| `TAX_FACT_SOURCE_CHANGED` | upstream source hash changed after the client rendered it |
| `INVOICE_TAX_FACT_MISSING` | invoice exists but tax fact is incomplete or unavailable |
| `ACCOUNTING_SUBJECT_MISSING` | mapped subject code does not exist |
| `ACCOUNTING_SUBJECT_INACTIVE` | subject is inactive for the source period |
| `CATEGORY_ACCOUNTING_MAPPING_MISSING` | finance category has no effective accounting mapping |
| `SOURCE_ORIGINAL_EVIDENCE_MISSING` | source lacks required original document/evidence |
| `TAX_FILING_PREPARATION_NOT_CONFIRMED` | filing matter has no confirmed declaration-preparation snapshot |
| `TAX_FILING_RESULT_ALREADY_RECORDED` | current declaration version already has an official result |
| `TAX_FILING_AMOUNT_DIFFERENCE_REASON_REQUIRED` | official and prepared amounts differ without an explanation |
| `TAX_FILING_PAYMENT_EXCEEDS_OUTSTANDING` | payment amount is above the current outstanding amount |
| `TAX_FILING_PAID_REVISION_REQUIRES_SETTLEMENT` | paid filing cannot be silently replaced by correction/void |
| `CLOSED_ACCOUNTING_PERIOD` | period is closed and cannot accept mutation |
| `IDEMPOTENCY_MISMATCH` | same idempotency key was reused with different payload |

## 7. Voucher Candidate Consumption

The accounting candidate service must consume:

- confirmed receivable/payable tax facts;
- matched invoice tax facts;
- active accounting subject snapshots;
- category accounting mappings effective on the source period;
- bank-reviewed and bank-reconciled cash facts for cash vouchers;
- tax matter completion facts for tax vouchers.

Candidate responses should include:

- `sourceTaxFactId` when accrual tax basis comes from source fact;
- `invoiceTaxFactIds` when invoice facts are used as evidence or preferred tax
  basis;
- `taxPolicyProfileId`;
- `categoryAccountingMappingId`;
- `sourceHash`;
- subject code/name snapshots for each proposed line.

## 8. Frontend Cutover Plan

### Stage 1: Contract-Shaped Mock

- Keep `financeTaxPolicyModel.ts`, `financeTaxBasisModel.ts`,
  `financeInvoiceAssociationModel.ts`, and `financeAccountingVoucherModel.ts` as
  local mock implementations.
- Shape their repository adapters around this contract so later API cutover does
  not change page components.
- Keep explicit frontend labels that these values are prototype facts.

### Stage 2: Backend Read Mode

- `/system/tax-policy` reads tax policy profiles from backend.
- `/tax/invoices` reads invoice tax facts from backend/import pipeline.
- `/finance/receivables-payables` reads tax readiness from backend.
- `/finance/accounting-vouchers` reads backend voucher candidates.

### Stage 3: Backend Mutation Mode

- tax policy activation, source tax fact confirmation, finance-owned category
  mapping changes, and voucher prepare/book/reverse all go through backend APIs.
- Accounting-subject mutation remains system/admin maintenance only and is not a
  business-side API surface.
- Frontend removes session-only lifecycle overlays.

## 9. Contract Test Matrix

| Scenario | Expected result |
| --- | --- |
| active tax profile missing for source period | source tax fact cannot be confirmed |
| invoice import creates tax facts | imported tax amount remains unchanged after policy profile changes |
| special invoice below the threshold | special-invoice VAT treatment remains taxable; it is not rewritten as exemption |
| unbilled income has no confirmed tax fact | declaration preparation stays blocked for tax-basis confirmation |
| tax policy profile does not cover declaration period | declaration calculation is rejected with `TAX_POLICY_PROFILE_MISSING` |
| qualified six-tax-and-two-fee subject | surcharge response contains each surcharge amount, reduction amount, and net payable amount |
| receivable source has complete tax basis and subject mapping | source tax fact can be confirmed and consumed by accrual candidate |
| receivable source lacks invoice but has confirmed source tax basis | accrual candidate can be `待制单` and invoice evidence remains `发票待补` |
| finance category lacks accounting mapping | source tax fact stays `待配置`; no voucher candidate is returned |
| subject mapping points to inactive subject | confirmation returns `ACCOUNTING_SUBJECT_INACTIVE` |
| source hash changes after client renders row | confirm/prepare returns source-changed error |
| closed accounting period | rebuild/confirm and voucher prepare are rejected |
| small-scale payable input invoice | input tax remains cost/expense, no VAT input-deduction line |
| future general-taxpayer profile with deductible input | input VAT subject line is generated only when profile and invoice allow deduction |

## 10. Release Boundary

This contract is not production evidence by itself.

Before production use, the project still needs:

- real migrations and rollback/forward-fix evidence;
- seed data for tax profiles, accounting subjects, and category mappings;
- parser evidence for invoice imports;
- authorization scopes and permission tests;
- contract tests for all mutating endpoints;
- period close and reopen tests;
- backup/restore evidence;
- legal/accounting review of configured tax policy profiles.

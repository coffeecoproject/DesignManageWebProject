# Privacy Data Inventory

## 1. Status

Status: `draft_scope_identified`.

Initial personal and sensitive business data categories have been identified from the business module draft. Storage, retention, deletion, processor, analytics, tracking, cookie, and compliance details remain pending.

## 2. Data Inventory

| Data category | Example | Purpose | Sensitivity | Storage | Retention | Deletion | Processor | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Personnel identity | name, ID number, birth date, personnel code, position, employment/cooperation status | personnel management, payment profile, task eligibility | high | TBD | TBD | TBD | TBD | draft_identified |
| Personnel education | graduation school, education level, education major, graduation date | personnel archive maintenance and qualification review | medium/high | TBD | TBD | TBD | TBD | draft_identified |
| Personnel contact | phone, email, address, emergency contact | personnel operations and emergency contact | high | TBD | TBD | TBD | TBD | draft_identified |
| Personnel contract | contract/agreement number, type, effective dates, participation status | personnel relationship and task eligibility management | high | TBD | TBD | TBD | TBD | draft_identified |
| Payment profile | bank card number, branch, payment account, account name | personnel payment identity | high | TBD | TBD | TBD | TBD | draft_identified |
| Task and delivery data | store/task records, submissions, review feedback, acceptance, rework | task delivery and revenue recognition | medium/high | TBD | TBD | TBD | TBD | draft_identified |
| Customer/contract data | customer, brand, contract, pricing, SLA, penalty rules | contract execution and operating management | high | TBD | TBD | TBD | TBD | draft_identified |
| Finance data | receivables, invoices, collections, payables, reimbursements, costs, penalties | operating finance and reporting | high | TBD | TBD | TBD | TBD | draft_identified |
| Audit data | rule changes, settlement changes, sensitive-data access | governance, security, dispute review | high | TBD | TBD | TBD | TBD | draft_identified |

## 2.1 Current Frontend Mock Boundary

- The current personnel detail prototype uses plaintext static mock identity/contact examples for product review only.
- List view displays mock phone numbers for quick internal lookup.
- Identity number, birth date, education metadata, address, emergency contact, contract number, account name, and bank account are displayed as plaintext static mock values inside the detail drawer.
- Full sensitive-value viewing, export, copy, and print are not implemented.
- Before real personnel data is connected, the project must define account-role authorization, resource-scope authorization, sensitive-access audit logging, retention/deletion, and export controls.

## 3. Cookie / Analytics / Tracking

- Cookie use: TBD.
- Analytics/tracking: TBD.
- Consent requirement: TBD.
- Disclosure requirement: TBD.

## 4. Required Future Evidence

- Data inventory updated with real entities and fields.
- Retention/deletion policy.
- Processor/subprocessor list if third-party services exist.
- Consent/cookie evidence if tracking exists.
- Privacy exception approvals if any.

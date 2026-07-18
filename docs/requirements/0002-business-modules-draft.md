# Business Modules Draft

## 1. Metadata

- Requirement ID: 0002
- Title: Full-scope admin console business module draft
- Status: draft
- Owner: TBD
- Date: 2026-06-09
- Source basis: user discussion plus `/Users/liushan/Docs/李总公司` business documents as reference material only

## 2. Positioning

StartupManageSystem is planned as a multi-role Web admin console for design-service operations and经营管理.

The files under `/Users/liushan/Docs/李总公司` are reference material for understanding current business context. They are not treated as a one-to-one system specification, data model, or UI contract.

The target product is not limited to one customer or one brand. It must support multiple customers and multiple brands/projects.

## 3. Confirmed Business Principles

| Topic | Confirmed direction | Notes |
| --- | --- | --- |
| Customer and brand relationship | One customer can have many brands/projects | Customer -> brand/project is one-to-many. |
| Task granularity | The execution and customer-settlement unit is the store task | The existing store and task records provide the business container and execution unit; no separate store-order module is required in the current frontend. |
| Brand dependency | Available task types and customer prices depend on the brand | Do not hard-code one task set or one customer price globally. |
| Pricing contract binding | Each billable brand-task price must reference an effective contract for the same customer | Task creation resolves the current brand price and freezes its price/contract version automatically; task users do not select or view the contract. |
| Store/service package types | No separate standard-store/light-renovation/special-store package layer for now | Pricing is by task, not by service package. |
| Task staffing | A task usually has one direct owner; complex collaboration is handled by splitting tasks | Support main owner, collaborators, and reviewer roles where needed. |
| Reviewer work | Reviewer workload/performance exists | Reviewer statistics and settlement rules must be modeled. |
| Internal settlement rules | Rules can differ by customer, brand, task type, and personnel type | Full-time and part-time settlement cannot be assumed globally uniform. |
| Customer pricing | Pricing is by task | Store-level totals are derived from task pricing and accepted tasks. |
| Revenue recognition | Recognize operating revenue at task acceptance | Cross-month task acceptance must be supported. |
| Penalties | Customer penalties are company operating losses only | Penalties can link to tasks/people for review, but do not directly deduct personal settlement by default. |
| Employee access | Designers can log in to view their own tasks and performance/settlement | Requires role and resource-scope permissions. |
| Trial period reference | Three months | Employment/legal text is out of product scope until confirmed. |
| Excess performance reference | 150+ excess performance multiplier is 1.5x where the referenced rule applies | The system must version rules instead of relying on one hard-coded number. |

## 4. Business Flow

```text
Customer
  -> Contract
  -> Brand task configuration and price version
  -> Store tasks with frozen customer-billing snapshots
  -> Assignment / submission / review / rework / acceptance
  -> Accepted task customer-settlement fact
  -> Receivable / invoice association / collection / accounting
  -> Personnel performance or service-fee settlement
  -> Operating finance
  -> Management reporting
```

## 5. Main Modules And Submodules

### 5.1 Customer Contract Center

Purpose: define customer-side commercial and execution rules.

Submodules:

- Customer profiles
- Brand/project profiles
- Contract management
- Brand task pricing versions
- Customer task rules
- SLA rules
- Acceptance rules
- Customer penalty rules

Key requirements:

- A customer can own multiple brands/projects.
- Brand task prices must reference an effective signed contract for the same customer.
- Task creation automatically freezes the current brand task price and contract snapshot; no task-side price or contract selector is exposed.
- Rule changes must be versioned and effective-date controlled.

### 5.2 Store And Task Revenue Traceability

Purpose: use the existing store and task records for customer-revenue traceability without adding a separate store-order frontend module.

Submodules:

- Store profile and site information
- Customer system ID mapping
- Task customer-billing snapshot
- Accepted-task settlement facts
- Brand/contract/task source trace
- Store revenue summary
- Cross-month acceptance tracking

Key requirements:

- Task is the customer-settlement fact unit; a store can aggregate multiple task facts.
- Billable tasks require an effective brand price and same-customer contract before creation.
- Internal acceptance creates the customer-settlement fact without adding customer confirmation or a manual settlement workbench.
- Store-level revenue is derived from accepted task facts, either per task or by frozen monthly settlement batch.

### 5.3 Task Delivery Center

Purpose: manage task execution as the operational unit.

Submodules:

- Task list
- Task creation and splitting
- Task assignment
- Main owner / collaborator / reviewer
- Planned deadline and actual submission
- Submission records
- Review records
- Rework records
- Acceptance records
- Delivery file archive

Key requirements:

- Task types depend on the brand task configuration.
- A task is normally owned by one executor; if multiple people participate, split the work into separate tasks where possible.
- Reviewers must be tracked because reviewer workload and settlement can exist.
- Task acceptance is the operating revenue recognition trigger.
- Customer prices, pricing contracts, and receivable identifiers remain hidden from task execution and employee views.

### 5.4 Rule Engine Center

Purpose: keep business rules configurable and auditable instead of hard-coded.

Submodules:

- Task type library
- Customer task templates
- Task pricing rules
- Full-time performance rules
- Part-time service-fee rules
- Reviewer workload/settlement rules
- Rule effective periods
- Rule version history

Key requirements:

- Customer-side pricing and internal personnel settlement are separate rule families.
- Internal settlement can vary by customer, brand, task type, personnel type, and effective period.
- Rule versions must be immutable after settlement close unless an explicit adjustment workflow is used.

### 5.5 Personnel And Organization Center

Purpose: manage people, roles, resource scopes, and settlement identity.

Submodules:

- Full-time personnel
- Part-time personnel
- Roles and positions
- Organization/team structure
- Employment/cooperation status
- Onboarding/offboarding
- Settlement information
- Personnel capacity
- Sensitive information permission scope

Key requirements:

- Full-time and part-time personnel are separate personnel types with shared identity patterns where useful.
- Designers can view their own tasks and settlement information.
- Sensitive fields such as ID number, bank card, phone, address, and emergency contact require restricted access and audit logs.

### 5.6 Quality And Exception Center

Purpose: record quality events, rework, overdue work, penalties, and company losses.

Submodules:

- Quality scoring
- Overdue records
- Rework records
- Customer rejection records
- Customer penalty records
- Exception events
- Loss aggregation
- Review and postmortem notes

Key requirements:

- Customer penalties are operating losses of the company.
- Penalties may link to customer, brand, store, task, owner, and reviewer for analysis.
- Penalties do not directly deduct personal settlement unless a future approved rule explicitly changes this behavior.

### 5.7 Performance And Settlement Center

Purpose: calculate and close personnel performance/service-fee settlement.

Submodules:

- Full-time monthly performance
- Part-time service-fee settlement
- Reviewer workload settlement
- Rule-based calculation
- Manual adjustment
- Monthly settlement sheet
- Settlement confirmation
- Objection/recheck workflow
- Settlement close and reopen governance

Key requirements:

- Settlement must reference rule version, task acceptance state, quality state, personnel type, and effective period.
- Cross-month task acceptance must be attributed to the acceptance month unless a future rule says otherwise.
- Manual adjustments require reason, operator, timestamp, and evidence.

### 5.8 Finance And Accounting Center

Purpose: connect operating finance to a frontend accounting workflow covering source confirmations, cash settlement, accounting vouchers, general ledger, period close, financial statements, and tax preparation. This frontend workflow is not itself a statutory ledger or audit archive until authoritative backend persistence, authorization, period locks, and evidence storage exist.

Submodules:

- Accepted task revenue
- Customer receivables
- Invoicing records
- Collection records
- Personnel payables
- Reimbursement/cost flows
- Cash receipts and payments
- Operating cost allocation
- Store/task profit view
- Receivable/payable reminders
- Accounting-subject master data
- Accounting vouchers and corrections
- General ledger and subject balances
- Period close and later-period adjustments
- Financial statements and report notes

Key requirements:

- Operating facts and accounting facts remain linked through immutable source references rather than page-local copied amounts.
- Revenue is recognized by accepted task.
- Cash collection and revenue recognition can occur in different months.
- Finance must connect accepted task revenue, personnel settlement, customer penalties, and operating costs.
- Posted vouchers feed the general ledger; period close reads summarized blockers and freezes a frontend-session close snapshot.
- Financial statements read booked general-ledger balances. They remain frontend evidence until backend accounting and archive controls are implemented.

### 5.9 Reporting And Governance Center

Purpose: provide role-based management visibility and system governance.

Submodules:

- Executive operating dashboard
- Customer/brand dashboard
- Store delivery dashboard
- Task throughput dashboard
- Personnel efficiency dashboard
- Performance/settlement dashboard
- Finance dashboard
- Data import/export
- Operation logs
- Rule change logs
- Sensitive-data access logs

Key requirements:

- Dashboards must support drill-down to customer, brand, store, task, and person where permissions allow.
- Data import/export must not bypass validation, permission, or audit rules.
- Operation logs are required for rule changes, settlement changes, and sensitive-data access.

## 6. Role Model Draft

| Role | Primary needs |
| --- | --- |
| Owner / executive | See operating status, revenue, cost, profit, cash, penalties, customer/brand performance, and personnel efficiency. |
| Project manager / delivery manager | Manage stores, task assignment, progress, deadlines, review, rework, and acceptance. |
| Reviewer / design lead | Review submissions, score quality, record rework, and track reviewer workload. |
| Finance / settlement operator | Manage receivables, invoices, collections, costs, personnel payables, and settlement close. |
| HR / admin | Manage personnel profile, status, role, and settlement identity. |
| Designer / executor | View assigned tasks, submission status, review feedback, accepted work, and own performance/settlement summary. |
| System admin | Manage roles, permissions, imports, logs, and rule governance. |

## 7. Initial Route Group Draft

This is not a final route contract. It is a business grouping draft for later route inventory updates.

| Route group | Main module |
| --- | --- |
| `/customers/*` | Customer Contract Center |
| `/tasks/*` | Task Delivery Center |
| `/rules/*` | Rule Engine Center |
| `/people/*` | Personnel And Organization Center |
| `/quality/*` | Quality And Exception Center |
| `/settlements/*` | Performance And Settlement Center |
| `/finance/*` | Finance And Accounting Center |
| `/reports/*` | Reporting And Governance Center |
| `/settings/*` | Cross-module system settings and permissions |

## 8. Open Decisions

| Decision | Impact |
| --- | --- |
| UI baseline style | Determines layout shell, density, component behavior, and prototype direction. |
| Frontend framework and component library | Determines implementation architecture and available table/form/chart components. |
| Backend runtime shape | Determines API, auth, database, and worker scope. |
| Import source strategy | Determines whether Excel import is transitional, permanent, or replaced by direct operational entry. |
| Rule complexity threshold | Determines whether a simple versioned rule table is enough or whether a dedicated rules engine is needed. |
| Settlement close/reopen governance | Determines adjustment, audit, and finance-control workflows. |
| File storage strategy | Determines how submitted drawings/source files/evidence are stored and permissioned. |

## 9. Not Yet Claimed

This draft does not claim:

- final PRD completeness
- final data model
- final API contract
- final route inventory
- legal or labor-compliance correctness
- finance/accounting compliance correctness
- production readiness

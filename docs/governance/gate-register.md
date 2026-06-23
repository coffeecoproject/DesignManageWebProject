# Gate Register

## 1. Gate Inventory

| Baseline | Gate name | Gate class | Enforcement mechanism | Command / CI job | Manual approval | Required evidence | Current status | Blocking effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Project governance/workflow | Baseline preflight | document_gate | `AGENTS.md` and workflow docs | N/A | no | Preflight text in task close-out | bootstrap_asset_only | Blocks non-trivial undocumented changes |
| 2 Requirements/change | Requirement intake | document_gate | Requirement record | N/A | depends on scope | `docs/requirements/0001-intake.md`, `docs/requirements/0002-business-modules-draft.md` updates | draft_scope_identified | Blocks unclear business implementation |
| 3 Architecture/ADR | ADR for material decisions | manual_approval_gate | ADR record | N/A | yes for irreversible decisions | `docs/adr/*.md` | bootstrap_asset_only | Blocks architecture commitment |
| 4 Engineering | Local DB dependency commands | evidence_gate | Real scripts and command outputs | `scripts/local/db-config.sh`, `scripts/local/db-up.sh`, `scripts/local/db-status.sh`, `scripts/local/db-psql.sh`, `scripts/local/db-logs.sh`, `scripts/local/db-down.sh` | no | `docs/evidence/local-environment-evidence.md` | ready_with_evidence | Does not imply app/tooling readiness |
| 4 Engineering | App/tooling command inventory | evidence_gate | Real package scripts and command outputs | `corepack pnpm install`, `corepack pnpm dev:web`, `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm build:web` | no | `docs/project/engineering-bootstrap.md`, `docs/testing/test-plan.md`, `docs/evidence/frontend-baseline-evidence.md` | ready_with_evidence | Frontend baseline ready locally; does not imply backend/release readiness |
| 5 Environment | Environment separation | evidence_gate | Environment matrix and real config | TBD | yes for production | Config evidence | planned_gap | Blocks release readiness |
| 6 Infrastructure/platform | Production platform changes | manual_approval_gate | User approval and platform evidence | TBD | yes | ADR/config/deploy evidence | planned_gap | Blocks production changes |
| 7 Code structure | Structure drift control | document_gate | Code structure document | N/A | no | Updated structure doc | implemented_with_evidence | Blocks unmanaged structure changes |
| 8 UI/design-system | Route/page inventory | document_gate | Route/page inventory | `apps/web/src/app/router.tsx` | no | `docs/web/route-page-inventory.md` | frontend_route_baseline_implemented | Blocks adding unconfirmed modules to navigation |
| 8 UI/design-system | UI baseline selection | manual_approval_gate | User selection and design-system scope update | N/A | yes | `docs/adr/0002-ui-baseline-ant-design-pro.md`, `docs/web/design-system-scope.md` | accepted_with_evidence | Blocks prototype visual baseline |
| 9 API/data-contract | Contract compatibility | evidence_gate | API/data contract docs and tests | TBD | depends on data impact | Contract/test evidence | planned_gap | Blocks backend/data readiness claim |
| 10 Dependency/supply-chain | Dependency admission | document_gate | Dependency admission record and peer check | `corepack pnpm peers check` | no | `docs/governance/dependency-admission.md`, `pnpm-lock.yaml` | frontend_baseline_admitted | Blocks unmanaged dependency intake |
| 11 Testing | Test evidence gate | evidence_gate | Local frontend checks | `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm build:web` | no | `docs/testing/test-plan.md` | frontend_baseline_passed | Blocks broader feature/release readiness claim until unit/E2E/visual/a11y exist |
| 12 Security/permission | Auth and permission model | manual_approval_gate | Security model doc and tests | TBD | yes for material auth decisions | Model/test evidence | planned_gap | Blocks security readiness claim |
| 13 Privacy/compliance | Data inventory | evidence_gate | Data inventory and lifecycle evidence | TBD | yes for sensitive data decisions | Privacy evidence | planned_gap | Blocks privacy readiness claim |
| 14 Observability/logging | Runtime signal evidence | evidence_gate | Logs/metrics/traces/alerts | TBD | no | Dashboard/alert/log evidence | planned_gap | Blocks operational readiness claim |
| 15 Incident/SRE | Incident process | document_gate | Incident record/runbook | N/A | no | Incident/runbook records | bootstrap_asset_only | Blocks ops readiness claim |
| 16 Performance/capacity | Performance budget | evidence_gate | Performance test once implemented | TBD | no | Performance evidence | planned_gap | Blocks release readiness claim |
| 17 Backup/recovery/DR | Restore evidence | evidence_gate | Backup/restore drill | TBD | yes for DR action | Recovery drill evidence | planned_gap | Blocks recovery readiness claim |
| 18 CI/CD | Pipeline evidence gate | evidence_gate | Planned CI automation after workflow exists | TBD | no | CI run evidence | planned_gap | Blocks CI/CD readiness claim |
| 19 Release/rollback | Release and rollback evidence | manual_approval_gate | Release record and rollback path | TBD | yes for production | Release/rollback evidence | planned_gap | Blocks release claim |

## 2. Status Values

- `ready_with_evidence`
- `accepted_with_evidence`
- `ui_baseline_selected`
- `frontend_ui_baseline_implemented`
- `frontend_route_baseline_implemented`
- `frontend_baseline_admitted`
- `frontend_baseline_passed`
- `implemented_with_evidence`
- `draft_scope_identified`
- `bootstrap_asset_only`
- `planned_gap`
- `blocking_gap`
- `N/A`
- `accepted_exception`

`automated_gate` must not be used until a real script, test, CI job, scan, or system check exists.

## 3. Exception Rule

| Exception | Baseline | Severity | Reason | Compensating control | Approval | Expiry | Restore blocking condition | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

S0 security issues, missing rollback/forward-fix path, missing provenance, and missing recovery path are not releasable by default.

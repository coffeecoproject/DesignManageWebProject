# Gate Register

## 1. Gate Inventory

| Baseline | Gate name | Gate class | Enforcement mechanism | Command / CI job | Manual approval | Required evidence | Current status | Blocking effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Project governance/workflow | Baseline preflight | document_gate | `AGENTS.md` and workflow docs | N/A | no | Preflight text in task close-out | bootstrap_asset_only | Blocks non-trivial undocumented changes |
| 2 Requirements/change | Requirement intake | document_gate | Requirement record | N/A | depends on scope | `docs/requirements/0001-intake.md` updates | bootstrap_asset_only | Blocks unclear business implementation |
| 3 Architecture/ADR | ADR for material decisions | manual_approval_gate | ADR record | N/A | yes for irreversible decisions | `docs/adr/*.md` | bootstrap_asset_only | Blocks architecture commitment |
| 4 Engineering | Local DB dependency commands | evidence_gate | Real scripts and command outputs | `scripts/local/db-config.sh`, `scripts/local/db-up.sh`, `scripts/local/db-status.sh`, `scripts/local/db-psql.sh`, `scripts/local/db-logs.sh`, `scripts/local/db-down.sh` | no | `docs/evidence/local-environment-evidence.md` | ready_with_evidence | Does not imply app/tooling readiness |
| 4 Engineering | App/tooling command inventory | evidence_gate | Future scripts and command outputs | TBD | no | Command output evidence | planned_gap | Blocks implementation readiness claim |
| 5 Environment | Environment separation | evidence_gate | Environment matrix and real config | TBD | yes for production | Config evidence | planned_gap | Blocks release readiness |
| 6 Infrastructure/platform | Production platform changes | manual_approval_gate | User approval and platform evidence | TBD | yes | ADR/config/deploy evidence | planned_gap | Blocks production changes |
| 7 Code structure | Structure drift control | document_gate | Code structure document | N/A | no | Updated structure doc | bootstrap_asset_only | Blocks unmanaged structure changes |
| 8 UI/design-system | Route/page inventory | document_gate | Route/page inventory | TBD | no | Route/page inventory and visual evidence | bootstrap_asset_only | Blocks frontend readiness claim |
| 9 API/data-contract | Contract compatibility | evidence_gate | API/data contract docs and tests | TBD | depends on data impact | Contract/test evidence | planned_gap | Blocks backend/data readiness claim |
| 10 Dependency/supply-chain | Dependency admission | document_gate | Dependency admission record | TBD | no | Dependency review evidence | bootstrap_asset_only | Blocks unmanaged dependency intake |
| 11 Testing | Test evidence gate | evidence_gate | Planned automation after commands exist | TBD | no | Test results | planned_gap | Blocks readiness claim |
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

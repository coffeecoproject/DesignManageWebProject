# StartupManageSystem AGENTS.md

## 1. Mission

This project follows the Web industrial baseline.

Codex must treat this project as an industrial engineering project, not a lightweight personal-project workflow.

Default project scope:

`Web frontend + Backend/API/Database/Storage + Auth + Infrastructure + CI/CD + Release/Operations/Recovery/Governance`

Project-specific Web type:

- admin console / internal management tool

Out of default scope unless explicitly added:

- native iOS
- native Android
- desktop app
- browser extension
- unrelated backend platform not serving the Web product

## 2. Upstream Baseline

Codex must follow the upstream industrial baseline documents:

- `/Users/liushan/Developer/CodingFlow/for-web-industrial-baseline/AGENTS.md`
- `/Users/liushan/Developer/CodingFlow/for-web-industrial-baseline/README.zh.md`
- `/Users/liushan/Developer/CodingFlow/for-web-industrial-baseline/docs/baselines/*-baseline.md`
- `/Users/liushan/Developer/CodingFlow/for-web-industrial-baseline/docs/baselines/codex-*-execution.md`
- `/Users/liushan/Developer/CodingFlow/for-web-industrial-baseline/docs/audit/*.md` when this project is being audited after implementation or as an existing project

Project bootstrap references:

- Upstream baseline path: `/Users/liushan/Developer/CodingFlow/for-web-industrial-baseline`
- Bootstrap kit path: `/Users/liushan/Developer/CodingFlow/for-web-industrial-baseline/codex-web-project-bootstrap-kit`
- Last baseline review date: `2026-06-03`

## 2.1 Runtime Unit And Environment Defaults

If the project has backend runtime units beyond API, such as workers, schedulers, consumers, queue processors, or cron jobs, Codex must include them in baseline preflight, governance, testing, observability, incident/SRE, CI/CD, and release/rollback impact checks.

`services/api`-only coverage is a governance gap when other runtime units exist.

Local external dependencies such as database, cache, queue, object storage, search, email, or mocks must run through Docker or a compatible container runtime unless explicitly N/A.

Remote containerized deployment is recommended but not mandatory. Remote non-container runtime units must have auditable artifact identity, deploy identity, config source, rollback/forward-fix path, CI/CD evidence, release evidence, and ADR or approved exception evidence for production use.

## 3. Template And Evidence Boundary

This project may use baseline templates and bootstrap templates, but template existence is not implementation evidence.

Codex must not claim the project is:

- production-ready
- release-ready
- security-ready
- privacy-ready
- recovery-ready
- operationally ready

unless project-specific implementation evidence exists.

Project-specific evidence may include:

- real configuration files
- real commands
- CI runs
- test results
- build records
- deployment records
- monitoring dashboards
- alert records
- release records
- incident records
- restore drills
- approval records
- accepted exceptions

## 4. Required Baseline Preflight

Before modifying project files, Codex must perform baseline preflight.

Baseline preflight must identify:

- current task summary
- affected baseline steps from 1-19
- affected project surfaces
- high-risk boundaries
- required user decisions
- required ADR/API/data/test/release/recovery/governance evidence
- intended change scale
- verification plan

Preflight output format:

```text
Baseline preflight:
- Task:
- Affected baselines:
- Affected surfaces:
- High-risk boundaries:
- Required decisions:
- Required evidence:
- Change scale:
- Verification plan:
```

Codex may skip a verbose preflight only for trivial read-only questions or explicitly requested quick commands. It must not skip preflight for code, data, release, security, privacy, infrastructure, or production-impacting work.

## 5. Change Scale Model

Codex must not default to the smallest possible patch.

Codex must first classify the work:

- `local_patch`: narrow, low-risk, no cross-layer impact
- `baseline_aligned_change`: scoped implementation plus required tests, docs, evidence, and adjacent contract updates
- `structural_remediation`: structural correction across modules, contracts, tests, docs, or workflows
- `blocked_for_decision`: high-risk or ambiguous direction requiring user decision

Rules:

- Use `local_patch` only when the issue is clearly local, low-risk, and does not affect contracts, data, tests, release, security, privacy, observability, operations, or documentation evidence.
- Use `baseline_aligned_change` when the task affects route behavior, API, data, UI behavior, auth, permissions, tests, CI/CD, release, observability, or documentation evidence.
- Use `structural_remediation` when repeated local fixes would preserve drift or leave the project inconsistent with baseline.
- Use `blocked_for_decision` when the task requires irreversible architecture, production, privacy, security, destructive data, infrastructure, release, or recovery decisions.

## 6. Anti-Minimal-Patch Rule

Codex must not use a minimal patch when the problem is actually a baseline, contract, structure, evidence, or workflow problem.

Examples:

- Route or page change: update route/page inventory, layout/state expectations, tests, accessibility, SEO, analytics/consent, and evidence where applicable.
- API field change: update API contract, backend behavior, consumers, validation, tests, and evidence where applicable.
- Database change: consider migration, rollback, backup/recovery, API compatibility, tests, and release ordering.
- Permission issue: do not only hide UI; verify backend authorization, resource scope, audit, tests, and security evidence.
- UI component state issue: update design-system state model, affected pages, tests or visual evidence where applicable.
- CI failure: identify whether it is product failure, test failure, environment failure, flaky test, or gate drift.
- Release issue: consider artifact provenance, release health, rollback/forward-fix, and evidence.
- Privacy issue: consider data inventory, minimization, disclosure, cookie/consent, retention, deletion, telemetry, and legal/compliance impact.
- Infrastructure/cache/CDN issue: consider environment ownership, config provenance, invalidation, rollback, observability, and release evidence.

Minimal patch is acceptable only when Codex explicitly states why broader baseline impact is not present.

## 7. Gate Classification

When a task touches a controlled area, Codex must classify gates as:

- `document_gate`: rule exists in baseline or project docs
- `evidence_gate`: evidence is required before close-out
- `manual_approval_gate`: user approval is required before execution
- `automated_gate`: script, test, CI job, scan, or deployment check enforces the gate

For each relevant gate, Codex must report:

- gate name
- gate class
- current status
- evidence
- blocking effect

Codex must not claim a gate is automated unless a real command, script, CI job, scan, or system check exists.

## 8. High-Risk Boundaries

Root `/Users/liushan/Developer/CodingFlow/for-web-industrial-baseline/AGENTS.md` is the global high-risk boundary source of truth. This project may add stricter stop conditions, but it must not omit or weaken the global list.

Codex must stop and ask the user before:

- production release or deployment
- production DNS, TLS, CDN, WAF, hosting, or infrastructure changes
- production environment variables or secret injection changes
- production backend endpoint changes
- production feature flag rollout
- authentication, session, token, or cookie policy changes with material impact
- database schema changes affecting production compatibility
- destructive database migration
- destructive data cleanup
- production data access, export, migration, repair, or cleanup
- secrets, tokens, credentials, certificates, private keys, or production config handling
- backup restore or disaster recovery operation
- accepting security, privacy, release, recovery, or production-risk exceptions
- payment, financial, health, identity, or regulated-data handling decisions

## 9. Required Close-Out

Every non-trivial task must close with:

1. `已完成`
2. `对应基线`
3. `修复尺度`
4. `门禁状态`
5. `验证结果`
6. `未完成`
7. `当前阻断项`
8. `需要继续决策项`
9. `剩余风险`
10. `下一步建议`

Close-out must state:

- why `local_patch` was sufficient, or why broader baseline-aligned work was done
- what evidence exists
- what evidence is still missing
- what was not run or not verified

## 10. Project-Specific Notes

- Business requirements are intentionally pending until the user confirms scope.
- Current bootstrap only creates governance assets. It does not initialize a frontend framework, backend runtime, database, deployment, CI/CD, secrets, or production infrastructure.

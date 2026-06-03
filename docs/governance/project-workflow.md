# Project Workflow

## 1. Baseline Sequence

StartupManageSystem follows the upstream 1-19 Web industrial baseline sequence:

1. Project governance/workflow baseline
2. Requirements/change baseline
3. Architecture/ADR baseline
4. Engineering baseline
5. Environment baseline
6. Infrastructure/platform baseline
7. Code structure baseline
8. UI/design-system baseline
9. API/data-contract baseline
10. Dependency/supply-chain baseline
11. Testing baseline
12. Security/permission baseline
13. Privacy/compliance/data lifecycle baseline
14. Observability/logging baseline
15. Incident response/SRE operations baseline
16. Performance/capacity baseline
17. Backup/recovery/DR baseline
18. CI/CD pipeline baseline
19. Release/rollback baseline

## 2. Task Flow

Every non-trivial task should use this flow:

1. Read relevant project docs and upstream baseline.
2. Run baseline preflight.
3. Classify change scale.
4. Identify gates and high-risk boundaries.
5. Execute scoped changes.
6. Verify with real commands or record planned gaps.
7. Update affected governance assets.
8. Close out with evidence, gaps, risks, and next steps.

## 3. Bootstrap Status

Current status: `bootstrap_asset_only`.

This file records workflow intent only. It does not prove implementation, tests, CI/CD, release, security, privacy, observability, or recovery readiness.

## 4. Decision Rules

Codex must ask before:

- Choosing irreversible architecture.
- Selecting production infrastructure.
- Configuring production deployment.
- Handling secrets, credentials, or production data.
- Changing authentication/session/token/cookie policy with material impact.
- Creating production-impacting database schema or destructive data changes.
- Accepting security, privacy, release, recovery, or production-risk exceptions.

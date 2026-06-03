# CI/CD Quality Gates

## 1. Status

Status: `planned_gap`.

No CI/CD pipeline, jobs, artifacts, permissions, or evidence retention exist yet.

## 2. Planned Gate Model

| Gate | Trigger | Required checks | Evidence | Status |
| --- | --- | --- | --- | --- |
| PR gate | Pull request | lint, format, typecheck, unit, smoke E2E | CI run | planned_gap |
| main gate | Merge to main | full test matrix, build, scan | CI run | planned_gap |
| release candidate gate | Release candidate | full E2E, visual regression, security/privacy, performance | CI and manual evidence | planned_gap |
| production release gate | Production deploy | approval, artifact provenance, health check, rollback path | release record | planned_gap |

## 3. Artifact And Provenance

- Artifact identity: TBD.
- Build provenance: TBD.
- Deployment identity: TBD.
- Evidence retention: TBD.

## 4. Required Future Evidence

- Real workflow files.
- Successful CI runs.
- Failure handling and flaky policy.
- Artifact and release records.

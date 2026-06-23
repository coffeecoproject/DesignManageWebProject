# Personnel Frontend Domain Normalization V1

## 1. Scope

This hardcut normalizes the personnel frontend before backend integration.

In scope:

- Create a personnel frontend domain layer under `apps/web/src/features/people`.
- Move stable people-domain rules out of page components.
- Introduce a mock repository/adapter boundary so current seed data is not consumed as page-owned data.
- Keep existing route scope: `人员总览`, `人员档案`, `人事异动`, `岗位管理`, `考勤假勤`, and `考勤月报`.
- Update governance, testing, and evidence docs for the new frontend boundary.

Out of scope:

- Backend/API implementation.
- Database schema, migrations, seed scripts, or storage integration.
- Authentication, authorization, account system roles, or permission enforcement.
- New personnel route groups such as organization chart, standalone employment, or standalone task-capability pages.
- Task execution details, payroll, settlement, finance, or production-readiness claims.

## 2. Current Problem

Personnel frontend behavior is currently page-driven. Stable rules such as archive list status, create defaults, task access status, attendance eligibility, overview availability, and movement effects are implemented inside page/provider files. This works for a prototype, but it will make backend integration fragile because API adapters would have to preserve page-specific mock shapes and duplicated derived logic.

## 3. Target State

The frontend personnel domain should have a clear dependency direction:

```text
page components
  -> people domain selectors / commands
  -> people repository adapter
  -> current mock seed data
```

Backend integration should later replace the repository adapter without rewriting UI rules. The backend should provide factual data; frontend selectors may continue to derive management summaries such as archive completeness, availability summary, and display labels.

## 4. Domain Boundary

The first normalized domain layer owns:

- Personnel type and status classification.
- Active/inactive relationship checks.
- Archive list status and missing-file summary.
- Create defaults for status, salary mode, work calendar assignment, and task access.
- Attendance eligibility and attendance effect/status helpers.
- Overview availability summary from full-time status, attendance facts, and work calendar facts.
- Movement-effect application to frontend session personnel rows.
- Position member-count derivation.

The domain layer does not own:

- UI components, Ant Design state, drawer mode, form layout, or table column definitions.
- System permission roles.
- Task execution detail state.
- Work-calendar configuration ownership.
- Payroll or financial settlement.

## 5. Compatibility Stance

Compatibility stance: `backward-compatible frontend structural refactor`.

Visible behavior should remain the same unless existing behavior contradicts confirmed business boundaries. Current frontend session state remains mock-backed and prototype-only.

## 6. Affected Paths

Expected code paths:

- `apps/web/src/features/people/peopleTypes.ts`
- `apps/web/src/features/people/PeopleOrganizationState.tsx`
- `apps/web/src/features/people/PeopleOverviewPage.tsx`
- `apps/web/src/features/people/PeopleArchivesPage.tsx`
- `apps/web/src/features/people/PeopleAttendancePage.tsx`
- new personnel domain/repository files under `apps/web/src/features/people/`

Expected docs:

- `docs/project/code-structure.md`
- `docs/web/route-page-inventory.md`
- `docs/testing/test-plan.md`
- `docs/evidence/frontend-baseline-evidence.md`
- this contract document

## 7. Stop Conditions

Stop and ask before:

- Adding or removing active personnel submodules.
- Introducing real API endpoints, DTO compatibility claims, or database schemas.
- Changing production data, auth, permissions, or account system roles.
- Moving task, performance amount, payroll, or finance rules into personnel.
- Changing confirmed visible business behavior beyond structural normalization.

## 8. Verification Plan

Required verification:

- TypeScript typecheck.
- Root lint.
- Targeted lint for changed people files.
- Static scan that pages no longer directly import raw personnel mock data where the repository boundary should own it.
- `git diff --check`.
- `build:web` if global build gate is available; record unrelated blockers if it is not.

Browser smoke is useful for UI behavior but not mandatory for this first structural pass when selectors preserve existing rendering and compile gates pass.

## 9. Governance Notes

The project currently does not contain the hardcut skill's expected `docs/README.md`, `docs/governance/current-development-profile-v1.md`, `docs/governance/industrial-hardcut-workflow-v1.md`, or `docs/governance/context-intake-governance-v1.md`. This normalization uses the existing project workflow, code-structure, route inventory, test plan, API placeholder, data placeholder, and upstream Web industrial baseline as the closest available source of truth.

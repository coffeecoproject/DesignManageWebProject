# AI Native Dev Kit Adoption V1

Date: 2026-06-28

Status: thin_operational_bridge_active

Source: `coffeecoproject/ai-native-dev-kit`

Source commit: `bb83080e43596ee8846fb2f1ff90092ef3a8111f`

Dev Kit version: `1.8.1`

## 1. Decision

StartupManageSystem adopts AI Native Dev Kit as a workflow adapter layer.

This migration does not replace the existing project `AGENTS.md` or the upstream Web industrial baseline. The existing Web industrial baseline remains the project engineering-quality authority; AI Native Dev Kit provides task workflow, classification, evidence, review-loop, claim-control, context-governance, and launch-readiness structure.

## 2. Adoption Mode

Mode: `thin_operational_bridge`

Baseline level: `BL1`

Selected profiles:

- `web-app`
- `internal-admin`

Selected industrial packs:

- none enabled by default

Explicitly not enabled:

- BL2
- all unrelated platform profiles
- all industrial packs as active project requirements
- Dev Kit CI workflows
- Dev Kit examples/evals/releases/starters

## 3. Why This Shape

The Dev Kit read-only assessment identified the project as:

- `DIRTY_WORKTREE_PROJECT`
- `GOVERNED_EXISTING_PROJECT`
- `PARTIALLY_BOOTSTRAPPED_PROJECT`
- `PRODUCTION_GOVERNED_PROJECT`

The project already has:

- project `AGENTS.md`
- upstream Web industrial baseline references
- governance docs
- evidence docs
- release, recovery, incident, and operations planning docs
- large active frontend business-module work in the current worktree

Therefore a direct `init` or `update` bootstrap would create duplicate governance and risk overwriting existing authority. This adapter keeps the Dev Kit isolated under `.ai-native/` and exposes only package-script entry points.

## 4. Existing Governance Map

| AI Native Concept | Existing Project Asset | Current Coverage | Gap / Conflict | Decision |
|---|---|---|---|---|
| Agent rules | `AGENTS.md` | Covered | Dev Kit AGENTS template is not authoritative here | Keep existing, append adapter section only |
| Engineering baseline | `/Users/liushan/Developer/CodingFlow/for-web-industrial-baseline`, `docs/project/*`, `docs/web/*` | Covered | Dev Kit baseline is generic | Existing Web industrial baseline remains authoritative |
| Environment baseline | `docs/project/environment-matrix.md`, `docs/environment-baseline.md` | Partial | CI/release/secret ownership pending | Add root environment baseline for AI Native checks |
| Project profile | `docs/project/project-definition.md`, `docs/project-profile.md` | Partial | Dev Kit expects root profile doc | Add root profile doc |
| Preflight | `AGENTS.md` section 4 | Covered | Dev Kit adds task classification language | Map; do not weaken current preflight |
| Patch classification | `AGENTS.md` section 5 plus AI Native docs | Covered | Naming differs | Map to existing `local_patch / baseline_aligned_change / structural_remediation / blocked_for_decision` |
| Evidence refs | `docs/evidence/*`, `docs/testing/test-plan.md` | Covered | Dev Kit has optional evidence templates | Keep project evidence docs as source of truth |
| Review loop | Existing manual review/testing flow | Partial | No dedicated Dev Kit review-loop artifact yet | Use Dev Kit as optional workflow reference |
| Claim control | `AGENTS.md` evidence boundary, docs/evidence | Covered | Need explicit package script | Add `ai-native:claim` |
| Context governance | Git-backed docs and AGENTS dirty-worktree rules | Covered | Dev Kit has additional checks | Add `ai-native:context` |
| Launch readiness | `docs/release/*`, `docs/recovery/*`, `docs/operations/*` | Partial | Real release evidence pending | Use Dev Kit launch checks as non-production-readiness guard |

## 5. Adopted Assets

Copied under `.ai-native/`:

- license, notice, README, version, manifest, and security/contribution docs
- `core/`
- `checklists/`
- `docs/`
- `templates/`
- `prompts/`
- `scripts/`
- `schemas/`
- `profiles/web-app/`
- `profiles/internal-admin/`
- `industrial-packs/README.md`
- `industrial-packs/index.json`
- `industrial-packs/selection-guide.md`
- `industrial-packs/schema/`
- `industrial-packs/web-app/`
- `industrial-packs/internal-admin/`
- `.ai-native/version.json`

Not copied:

- `.github/`
- `examples/`
- `evals/`
- `releases/`
- `starters/`
- platform profiles for iOS, Android, WeChat mini program, backend-only, or unrelated risk overlays
- non-selected industrial pack directories

## 6. Package Script Entry Points

Root `package.json` exposes:

- `ai-native:next`
- `ai-native:baseline`
- `ai-native:check`
- `ai-native:doctor`
- `ai-native:claim`
- `ai-native:context`
- `ai-native:launch`

These are local workflow checks only. The adapter does not deploy, mutate production state, write secrets, or approve release.

`ai-native:check` is project-specific and runs `.ai-native/scripts/check-startup-adapter.mjs`. It verifies this thin adapter rather than the upstream full bootstrap layout. `ai-native:context` and `ai-native:launch` are also project-specific adapter checks that verify existing context-governance, release, recovery, incident, and environment-boundary assets instead of requiring root-level AI Native artifact directories.

The upstream `check --mode core`, `context-governance`, and `launch-readiness` commands expect root-level AI Native CI, scripts, artifact directories, and full AGENTS sections. Those full-bootstrap expectations are intentionally not the acceptance gate for this project because this project preserves its existing Web industrial baseline.

## 7. Authority Order

When rules conflict:

1. System/developer instructions in the active Codex session.
2. Project `AGENTS.md`.
3. Upstream Web industrial baseline referenced by `AGENTS.md`.
4. Project-specific docs and evidence.
5. AI Native Dev Kit adapter assets under `.ai-native/`.

AI Native Dev Kit may add stricter workflow gates, but it must not weaken existing project high-risk boundaries, evidence requirements, or close-out requirements.

## 8. Forbidden Without Separate Approval

- Running Dev Kit `init` or `update` directly against the project root.
- Replacing `AGENTS.md`.
- Replacing existing governance, evidence, release, recovery, or route/data/API docs.
- Adding Dev Kit CI workflows.
- Enabling BL2 or industrial packs as binding gates.
- Copying unrelated platform profiles or starters.
- Modifying production/deployment/secret/database/auth/permission files.

## 9. Current Open Decisions

| Decision | Recommended | Status |
|---|---|---|
| Enable BL2 | No; keep BL1 until backend/production evidence matures | Deferred |
| Enable selected industrial packs as binding gates | No; keep as reference only for now | Deferred |
| Add AI Native CI checks | No; run locally first | Deferred |
| Rework AGENTS.md fully | No; append adapter section only | Done |
| Add root environment baseline | Yes | Done |
| Add root project profile | Yes | Done |

## 10. Verification Plan

Run after migration:

```bash
corepack pnpm ai-native:next
corepack pnpm ai-native:baseline
corepack pnpm ai-native:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:web
corepack pnpm build:web
git diff --check
```

AI Native checks are workflow diagnostics. Passing them does not mean production readiness.

## 11. Verification Results

Verified on: 2026-06-28

| Command | Result | Notes |
|---|---|---|
| `corepack pnpm ai-native:next` | PASS | Reports governed/dirty project protection and read-only-first recommendation; expected for this adapter mode |
| `corepack pnpm ai-native:baseline` | PASS | Recommends `BL1` with `web-app` and `internal-admin` profile candidates |
| `corepack pnpm ai-native:check` | PASS | Project-specific adapter check passed |
| `corepack pnpm ai-native:context` | PASS | Context-governance adapter check passed |
| `corepack pnpm ai-native:launch` | PASS | Launch-boundary adapter check passed; this is not production readiness |
| `corepack pnpm ai-native:doctor` | PASS | Runs `ai-native:next` plus adapter check |
| `corepack pnpm ai-native:claim` | PASS | Claim-control passed; missing README.zh-CN/VERSION/final-reports are optional project-root artifacts |
| `corepack pnpm lint` | PASS | Web lint passed |
| `corepack pnpm typecheck` | PASS | Web TypeScript build passed |
| `corepack pnpm test:web` | PASS | 185/185 web unit tests passed |
| `corepack pnpm build:web` | PASS | Web production build passed |
| `git diff --check` | PASS | No whitespace errors in tracked diffs |

Remaining evidence gaps:

- Full AI Native root bootstrap checks are intentionally not used as acceptance gates.
- CI/CD, production, release, rollback, monitoring, secrets, backend, database, and real environment ownership remain pending until separately evidenced.
- `.ai-native` is an adapter asset directory; it does not make BL2 or industrial packs binding project requirements.

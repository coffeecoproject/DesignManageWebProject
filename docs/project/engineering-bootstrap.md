# Engineering Bootstrap

## 1. Repository Layout

Current repository layout:

```text
/
  AGENTS.md
  README.md
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  docker-compose.yml
  .editorconfig
  .env.local.example
  .gitignore
  apps/
    web/
  scripts/local/
  docs/
```

Implemented app layout:

```text
apps/web/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  eslint.config.js
  src/
    main.tsx
    app/
    features/people/
    styles/
```

Backend/API/storage/auth runtime units are not initialized yet.

## 2. Runtime And Package Manager

- Frontend runtime: Node.js with Vite dev server.
- Frontend framework: React 18 + TypeScript.
- UI framework: Ant Design 5 + Ant Design Pro Components.
- Package manager: `pnpm@11.1.3` through Corepack.
- Lockfile policy: `pnpm-lock.yaml` is the source of dependency resolution.
- Runtime version pinning: package manager pinned in root `package.json`; Node engine pinning is still pending.
- Git repository: initialized on branch `main`.
- Formatting baseline: `.editorconfig`.

## 3. Command Inventory

| Purpose | Command | Status | Evidence |
| --- | --- | --- | --- |
| install | `corepack pnpm install` | ready_with_evidence | Passed on 2026-06-09 after network approval. |
| peer dependency check | `corepack pnpm peers check` | ready_with_evidence | `No peer dependency issues found`. |
| dev frontend | `corepack pnpm dev:web` | ready_with_evidence | Serves `apps/web` on `http://127.0.0.1:5173`. |
| lint | `corepack pnpm lint` | ready_with_evidence | Passed on 2026-06-09. |
| typecheck | `corepack pnpm typecheck` | ready_with_evidence | Passed on 2026-06-09. |
| build frontend | `corepack pnpm build:web` | ready_with_evidence | Passed on 2026-06-09. |
| local database config check | `scripts/local/db-config.sh` | ready_with_evidence | Validates local Compose configuration. |
| start local database | `scripts/local/db-up.sh` | ready_with_evidence | Starts isolated local Postgres. |
| inspect local database | `scripts/local/db-status.sh` | ready_with_evidence | Checks local Postgres health. |
| local database psql | `scripts/local/db-psql.sh` | ready_with_evidence | Connects to isolated local Postgres. |
| local database logs | `scripts/local/db-logs.sh` | ready_with_evidence | Shows local Postgres logs. |
| stop local database | `scripts/local/db-down.sh` | bootstrap_asset_only | Stops local Postgres without deleting volume. |
| dev API | TBD | planned_gap | Backend not initialized. |
| format | TBD | planned_gap | Formatter command not initialized. |
| unit test | TBD | planned_gap | Unit test runner not initialized. |
| E2E smoke | TBD | planned_gap | E2E not initialized. |

## 4. Local Startup Path

Install dependencies:

```bash
corepack pnpm install
```

Run frontend:

```bash
corepack pnpm dev:web
```

Frontend URL:

```text
http://127.0.0.1:5173
```

Local dependency startup:

```bash
scripts/local/db-up.sh
scripts/local/db-status.sh
```

Host connection string for local tools:

```text
postgres://startupmanage_app:startupmanage_local_dev_only@127.0.0.1:55432/startupmanage_local
```

## 5. Storage Path

File/object storage scope is TBD. No storage path has been selected.

Database storage is isolated in Docker volume `startupmanage_local_pgdata`.

Frontend build output is `apps/web/dist/` and is ignored by git.

## 6. Evidence Boundary

Frontend baseline commands now have local evidence, but this does not imply production, release, security, privacy, recovery, or operational readiness.

Real readiness still requires backend/API/auth/data implementation, automated tests beyond lint/typecheck/build, CI evidence, release evidence, monitoring, backup/recovery evidence, and explicit production approval.

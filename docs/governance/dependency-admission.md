# Dependency Admission

## 1. Status

Status: `frontend_baseline_admitted`.

Local Docker database dependency and frontend baseline dependencies have been admitted for local development.

Security boundary:

- `corepack pnpm install` completed with lockfile supply-chain policy verification on 2026-06-09.
- `corepack pnpm peers check` passed on 2026-06-09.
- A dedicated vulnerability/license scan command is still pending and must be added before security readiness or release readiness is claimed.

## 2. Admission Record

| Dependency | Version | Purpose | Owner | License | Security review | Alternative considered | Decision | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Docker image `postgres` | `16-alpine` | Local database dependency runtime | Codex/user | PostgreSQL License | Local-only baseline dependency; not a production dependency decision | Native local Postgres rejected due port/data isolation risk | admitted for local baseline | `docker-compose.yml`, `docs/evidence/local-environment-evidence.md` |
| `react` / `react-dom` | `18.3.1` | Frontend runtime and rendering | Codex/user | MIT | Widely used OSS runtime; no auth/privacy SDK behavior | Vue/Svelte not selected because Ant Design Pro-style baseline aligns with React ecosystem | admitted for frontend baseline | `apps/web/package.json`, `pnpm-lock.yaml` |
| `react-router-dom` | `7.17.0` | SPA routing | Codex/user | MIT | Client routing only; no security boundary without backend auth | File router deferred to keep baseline simple | admitted for frontend baseline | `apps/web/src/app/router.tsx` |
| `antd` | `5.29.3` | Admin UI component library | Codex/user | MIT | UI-only dependency; AntD 6 rejected because ProComponents peer range expects AntD 4/5 | Custom UI rejected due baseline speed and consistency | admitted for frontend baseline | `apps/web/package.json`, `corepack pnpm peers check` |
| `@ant-design/icons` | `6.2.5` | Icon set for admin shell/actions | Codex/user | MIT | UI-only dependency | Inline SVG rejected to keep icon system consistent | admitted for frontend baseline | `apps/web/src/app/shell.tsx` |
| `@ant-design/pro-components` | `2.8.10` | Ant Design Pro-style layout, cards, tables | Codex/user | MIT | UI-only dependency; peer check passed with AntD 5 | Raw AntD-only shell considered but weaker for Pro-style baseline | admitted for frontend baseline | `apps/web/src/app/shell.tsx`, people pages |
| `vite` | `8.0.16` | Frontend dev server and production build | Codex/user | MIT | Build tooling only; local dev server bound to `127.0.0.1` | Next.js deferred because backend/rendering model is not confirmed | admitted for frontend baseline | `apps/web/vite.config.ts` |
| `@vitejs/plugin-react` | `6.0.2` | React support for Vite | Codex/user | MIT | Build tooling only | N/A | admitted for frontend baseline | `apps/web/vite.config.ts` |
| `typescript` | `6.0.3` | Static type checking | Codex/user | Apache-2.0 | Tooling only | JavaScript-only rejected due governance baseline | admitted for frontend baseline | `apps/web/tsconfig.json` |
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` | `10.4.1`, `10.0.1`, `8.60.1`, `17.6.0` | Linting | Codex/user | MIT | Tooling only | Formatter/linter suite pending later | admitted for frontend baseline | `apps/web/eslint.config.js`, `corepack pnpm lint` |
| `@types/react`, `@types/react-dom` | `18.3.31`, `18.3.7` | React TypeScript types | Codex/user | MIT | Tooling only | N/A | admitted for frontend baseline | `apps/web/package.json` |

## 3. Rules

- New dependencies require purpose, owner, license, and security review notes.
- Lockfile must be committed with dependency changes.
- Vulnerability/license scan path must be documented before dependency readiness is claimed beyond local baseline.
- Third-party SDKs that affect privacy, auth, analytics, payment, identity, or regulated data require explicit review.
- Dependency changes must rerun `corepack pnpm peers check`, `corepack pnpm typecheck`, `corepack pnpm lint`, and `corepack pnpm build:web`.

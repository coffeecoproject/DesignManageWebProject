# Dependency Admission

## 1. Status

Status: `bootstrap_asset_only`.

One local-only Docker image dependency has been admitted for the database runtime.

## 2. Admission Record

| Dependency | Version | Purpose | Owner | License | Security review | Alternative considered | Decision | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Docker image `postgres` | `16-alpine` | Local database dependency runtime | Codex/user | PostgreSQL License | Local-only baseline dependency; not a production dependency decision | Native local Postgres rejected due port/data isolation risk | admitted for local baseline | `docker-compose.yml`, `docs/evidence/local-environment-evidence.md` |

## 3. Rules

- New dependencies require purpose, owner, license, and security review notes.
- Lockfile must be committed once a package manager is selected.
- Vulnerability/license scan path must be documented before dependency readiness is claimed.
- Third-party SDKs that affect privacy, auth, analytics, payment, identity, or regulated data require explicit review.

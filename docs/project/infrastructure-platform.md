# Infrastructure Platform

## 1. Platform Scope

- Hosting/platform: TBD.
- DNS: TBD.
- TLS: TBD.
- CDN: TBD.
- WAF: TBD.
- IaC: TBD.
- Secret injection: TBD.
- Artifact storage/provenance: TBD.

## 2. Current Status

Status: `planned_gap`.

No remote infrastructure has been selected or configured.

Local-only infrastructure:

- Postgres dependency runtime is configured in `compose.yaml` and run by napbox, one isolated environment per git worktree.
- Local volume: napbox named volume `pgdata`, per environment.
- Host port: assigned by napbox and fixed for the environment; read it with `napbox env`.

## 3. High-Risk Boundary

Codex must ask before:

- production DNS, TLS, CDN, WAF, hosting, or infrastructure changes
- production deployment automation
- production environment variable or secret injection changes
- accepting production infrastructure risk exceptions

## 4. Required Future Evidence

- Platform decision ADR.
- Environment-specific config inventory.
- Secret source and injection evidence.
- Deployment artifact identity.
- Rollback or forward-fix path.
- CI/CD and release records.

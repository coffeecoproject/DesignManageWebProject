# Data Contract Placeholder

## 1. Status

Status: `planned_gap`.

Local database runtime is configured, but no database schema, migration, rollback path, storage contract, or data lifecycle behavior has been defined.

## 2. Data Entity Inventory

| Entity | Purpose | Owner | Sensitivity | Storage | API exposure | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD | TBD | planned_gap | Business scope pending |

## 3. Migration And Rollback

- Migration strategy: TBD.
- Rollback/forward-fix strategy: TBD.
- Seed/test data: TBD.
- Backup/recovery impact: TBD.

## 3.1 Local Database Isolation

| Item | Value | Status |
| --- | --- | --- |
| Engine | Postgres `16-alpine` via Docker Compose | bootstrap_asset_only |
| Host port | `55432` | bootstrap_asset_only |
| Database | `startupmanage_local` | bootstrap_asset_only |
| User | `startupmanage_app` | bootstrap_asset_only |
| Network | `startupmanage_local_net` | bootstrap_asset_only |
| Volume | `startupmanage_local_pgdata` | bootstrap_asset_only |

This local database is a dependency runtime only. It does not imply any schema or data contract is ready.

## 4. Contract Rules

- Data model changes require API/data contract updates.
- Production-impacting schema changes require explicit approval.
- Destructive data changes are high-risk and require user approval.

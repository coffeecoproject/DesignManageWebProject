# Frontend Domain State Hardcut Evidence

Date: `2026-07-19`

Scope: frontend-only shared session state, cross-route consumption, and file-action truthfulness. Backend persistence, browser validation, authentication, authorization, object storage, and production readiness are not claimed.

## Implemented contract

- Ledger initialization draft, enabled snapshot, import batch, and operation records are owned by `FinanceLedgerInitializationProvider`.
- General ledger consumes only the enabled and trial-balanced initialization snapshot. Withdrawing enablement removes the snapshot from general-ledger calculation.
- Bank statement rows and import batches are owned by `FinanceBankStatementProvider` after the first mutation, so import and reconciliation changes survive route navigation in the current frontend session.
- People movement records are owned with the people master in `PeopleOrganizationProvider`; saving an effective movement commits the movement record and people effect through one domain entry point.
- Performance signature archives are owned by `PerformanceSignatureProvider`; current/history archive changes survive route navigation in the current frontend session.
- Related-file preview and download actions are rendered only for explicit callbacks with real behavior or records containing a resource URL. Frontend prototype notification handlers were removed.

## Automated gate

`apps/web/scripts/frontend-domain-state-hardcut.mjs` fails when:

- a controlled domain record is restored to page-local `useState`;
- a required provider is removed from `RootApp`;
- general ledger stops consuming the enabled initialization snapshot;
- related-file actions stop deriving default preview/download behavior from resource URLs;
- fake preview/download prototype messages return to frontend source.

The gate runs as part of `corepack pnpm test:web`.

## Acceptance boundary

- Route navigation in one mounted frontend session preserves the controlled domain state.
- A full browser refresh still resets in-memory state to frontend seeds. This is expected until backend repositories are connected.
- Historical Mock file records without a resource URL remain visible as metadata but do not expose nonfunctional actions.

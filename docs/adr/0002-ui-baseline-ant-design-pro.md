# ADR 0002: Ant Design Pro UI Baseline

## Status

Accepted

## Date

2026-06-09

## Context

StartupManageSystem is a multi-role Web admin console for multi-customer, multi-brand design-service operations management.

The confirmed business direction requires:

- main module / submodule navigation
- dense table and filter workflows
- customer/contract, store order, task, rule, personnel, settlement, finance, and reporting modules
- role-scoped dashboards
- task status, review, rework, acceptance, and settlement states
- predictable repeated-use operational screens

The user reviewed the UI direction options and selected the Ant Design Pro style as the UI baseline.

## Decision

Use Ant Design Pro style as the visual and interaction baseline for the admin console.

This means the baseline UI should prefer:

- dark sidebar plus light work area
- `PageContainer`-style page headers, breadcrumbs, and action areas
- dense `ProTable`-style list pages with query forms, saved filters where useful, status columns, row actions, pagination, and batch actions
- `ProForm`-style create/edit/search forms
- drawers for task/order/person/rule details and audit traces
- modals for confirmations and focused workflows
- Ant Design status tags, badges, statistics, cards, tabs, segmented controls, and step/status indicators
- restrained enterprise visual language with Ant blue as the primary action color

This ADR selects the UI baseline style. It does not by itself finalize:

- frontend framework
- package manager
- component library dependency admission
- exact Ant Design / ProComponents package versions
- Umi vs non-Umi application structure
- backend/API/data implementation

Those choices require separate implementation decisions and dependency review.

## Consequences

- Future route/page designs should follow Ant Design Pro interaction density and layout conventions unless a later ADR changes the baseline.
- The route/page inventory should model two navigation levels at minimum: main module and submodule.
- The first prototype should demonstrate Ant Design Pro-quality list, filter, detail drawer, dashboard, and status workflows.
- If Ant Design or ProComponents are admitted as dependencies, dependency admission and implementation evidence must be recorded before claiming implementation readiness.
- Visual QA should compare against this baseline, not against the earlier low-fidelity mock image.

## Evidence

- User selected Ant Design Pro style on 2026-06-09.
- UI candidates documented in `docs/web/ui-baseline-style-options.md`.
- Business module draft documented in `docs/requirements/0002-business-modules-draft.md`.


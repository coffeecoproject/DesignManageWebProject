# Design System Scope

## 1. Current Status

Status: `frontend_ui_baseline_implemented`.

Selected UI baseline: Ant Design Pro style.

Decision record: `docs/adr/0002-ui-baseline-ant-design-pro.md`.

UI baseline style candidates are documented in `docs/web/ui-baseline-style-options.md`.

Current frontend implementation:

- App path: `apps/web`
- Stack: Vite + React + TypeScript + Ant Design.
- Active navigation scope: `人员组织`, `客户管理`, `任务管理`, `绩效管理`, `薪酬管理`, `财务管理`, plus `系统管理`.
- Active personnel submodules: `人员总览`, `人员档案`, `人事异动`, `岗位管理`, `考勤假勤`, `考勤月报`.
- Active customer submodules: `客户档案`, `品牌管理`, `门店管理`, `合同管理`.
- Implemented shell: custom dark sidebar, light work area, sticky topbar breadcrumb, global actions, user block, sidebar collapse control, independent sidebar-menu scrolling, and independent right-content scrolling.
- Implemented page patterns: single-line metric cards, single-row compact filters, shared management table, shared drawer detail tabs, shared management page scaffold, shared detail sections/grids/drawer titles/status tags, shared file slots/dropzones/requirement panels, task assignment candidate selectors, personnel/status/risk tags, business-role tags, status/detail drawers, sectioned detail field grids, compact workbench tables, personnel archive detail display, attendance monthly result ledger with table primary adjustment action and separate month/person adjustment drawer, monthly salary result ledger with integrated salary-adjustment drawer and compact salary/performance detail tables, task workflow panels, performance-rule preset detail display, business-role default permission display, position extra-permission display, compact pagination, compact sidebar, empty/not-found state, route loading state.
- Desktop browser baseline: minimum layout width `1180px`; mobile-specific behavior is intentionally not in scope yet.

## 2. Expected Admin Console Controls

The following are expected for an admin console once business scope is confirmed:

- Sidebar or top-level navigation.
- Dense table/list views.
- Search, filters, sorting, pagination.
- Detail drawers or detail pages.
- Forms with validation.
- Status tags and workflow states.
- Toasts or inline feedback.
- Confirmation dialogs for destructive actions.
- Empty, loading, error, and permission-denied states.

Currently implemented controls in the frontend baseline:

- `Layout`
- `Menu`
- `Breadcrumb`
- `Card`
- `Table`
- `Select`
- `Input`
- `Button`
- `Tag`
- `Avatar`
- `Drawer`
- `Tabs`
- `List`

Shared component baseline: `ManagementTable` is the canonical Ant Design table wrapper for workbench pages. It owns the lightly bordered workbench shell, compact toolbar, automatic horizontal scroll width, fixed table layout, default alignment strategy, compact pagination spacing, and optional row-click behavior. `DetailTabs` is the canonical drawer/detail tab component for detail surfaces. It owns the complete tab header, active underline, shared `detail-tabs` class contract, and tab-panel wrapper so business pages only provide tab labels and content sections. `MetricGrid`/`MetricCard`, `FilterPanel`/`FilterBar`/`FilterField`/`KeywordFilter`, and `ManagementPageScaffold` own repeated list-page summary, query, action, count, and table structure. `DrawerShell` is the canonical Ant Design drawer wrapper for shared footer actions, generic `detail-drawer-shell` class naming, body test anchors, and optional detail-body layout. `DetailDrawerShell` is the canonical read-only/detail drawer wrapper and owns `drawer-detail-layout`; pages using it must not assemble `drawer-detail-layout` or `drawer-footer-actions` manually. `DrawerFormShell` reuses `DrawerShell` for create/edit/detail form drawers and owns mode-aware footer actions. `ImportDrawerShell` is the semantic wrapper for import and preview drawers; it reuses the detail body layout and structured footer actions so import pages do not assemble low-level Drawer footers manually. `WorkflowDrawerShell` is the semantic wrapper for review/approval/acceptance drawers; it owns workflow footer ordering, danger action rendering, drawer detail body layout, and structured close/secondary/danger/primary actions. Feature pages should use `DetailDrawerShell` for read-only detail surfaces, `DrawerFormShell` for create/edit form surfaces, `ImportDrawerShell` for import/preview flows, `WorkflowDrawerShell` for workflow-processing drawers, and low-level `DrawerShell` only for specialized drawers with an explicit `contentLayout` decision. `DetailSection`/`DetailInfoGrid` own drawer/detail section and static field display; `DetailDrawerTitle` owns drawer title, subtitle, and optional status presentation; `StatusTag` owns status Tag rendering and exposes semantic tone values instead of page-level status-tag class names. `FileSlot`, `FileSlotGrid`, `FileRequirementPanel`, and `FileUploadDropzone` own required file slots, voucher requirement display, list-style upload slots, and supplemental file dropzones; pages pass structured labels, files, callbacks, and semantic status tones instead of assembling internal upload controls or passing component CSS classes. `TaskAssignmentCandidatePicker` is the task-module candidate picker wrapper for executor/acceptor assignment; it owns disabled-before-expected-duration behavior, searchable drawer filtering, candidate tone tags, blocker/warning copy, and selected-person display while leaving Ant Design Drawer/Input/Segmented internals untouched.

Typography baseline: admin-console typography is tokenized in `apps/web/src/styles/global.css`. The approved font-size scale is `12px`, `13px`, `14px`, `16px`, `18px`, and `22px`; text above `22px` is not allowed in the current management-console baseline. Tables and dense field grids should use `12px` or `13px`; ordinary controls use `14px`; section/drawer titles use `16px`; drawer/profile highlights use `18px`; metric numbers use `22px`. Status values are not metrics: status text should use `Tag` or `16px` maximum text, while numeric summary units should be visually demoted to ordinary-control size.

## 3. Rules

- Do not create a marketing landing page for the admin console.
- Use restrained, task-focused UI.
- Use reusable components and document states.
- Route/page changes must update `route-page-inventory.md`.
- The selected baseline must support two-level navigation at minimum: main module and submodule.
- Dense operational tables, filters, drawers/detail panels, workflow status, and role-scoped dashboards are baseline needs.
- Follow Ant Design Pro-style page structure: dark sidebar, light work area, page container, table query forms, dense data tables, status tags, drawers, modals, statistics, and tabs.
- The earlier low-fidelity mock image is not UI-quality evidence; future prototype screenshots must be judged against Ant Design Pro-quality layouts.
- Current route/navigation baseline must not expose deferred modules until the user confirms them.
- Sidebar compact mode must keep the brand title and module/menu titles readable; icon-only collapse is not allowed for this baseline.
- App shell scrolling must be container-owned: the body/root must not carry admin-page scrolling, the sidebar menu scrolls independently when navigation grows, the right content area scrolls independently, and the right topbar stays visible while page content scrolls.
- Operational table columns must define deliberate `width` values; long free-text columns should receive proportionally more width, and status/action columns should remain compact.
- Workbench pages must use `ManagementTable` instead of page-local Ant Design `Table` shells when they need the standard dense management table behavior.
- Workbench pages must not pass page-local `scrollX`; `ManagementTable` calculates the horizontal scroll width from column widths and applies a buffer so right-edge columns remain reachable.
- Task assignment selectors should use `TaskAssignmentCandidatePicker` instead of page-local Select option markup when they need searchable recommended/selectable/unavailable candidate states.
- Management table columns default to centered alignment; identity columns such as `人员` stay left aligned unless a column explicitly overrides `align`.
- Management tables should use a lightly bordered outer card and subtle inner table border; avoid full cell boxing unless a future dense comparison workflow requires it.
- Dense management tables should scroll internally on narrow browser widths instead of compressing business fields; key identity columns may be fixed left when row-level scanning is required.
- Do not introduce page-local oversized headings or one-off font sizes. New UI must use the typography tokens in `global.css`, and management pages should not use marketing-scale typography.
- Personnel list detail should open from row click; avoid a dedicated `查看` action column when row click is the primary interaction.
- Personnel archive detail should open in a wide drawer from row click. The archive list remains the primary workbench surface, while the drawer carries static personnel data, salary archive, contract/agreement data, collection account, related files, and operation records without flattening every low-frequency field into the first view.
- Personnel archive currently uses plaintext static mock values because the user has confirmed no prototype privacy masking is needed there. This is not production privacy evidence; real data access still requires role authorization, audit logging, and field-level privacy decisions before integration.
- Personnel overview drawers should prefer status summaries and sectioned field grids; avoid turning overview into full personnel archive, task, settlement, finance, or permission-management workflows.
- Personnel overview may show non-monetary work-evaluation signals, but settlement rules, payment amounts, finance results, review/appeal, monthly closing, and cross-month attribution must stay in dedicated workflows.
- Vendor chunk budget is set to `1200 kB` for the initial Ant Design Pro baseline; business growth should use route-level splitting and measured bundle review.

## 4. Evidence Needed Later

- Screenshots across target viewports.
- Accessibility check evidence.
- Visual regression evidence where applicable.
- Authenticated/permission-denied UI states after auth model is selected.

## 5. Current Evidence

| Evidence | Status | Location |
| --- | --- | --- |
| UI baseline decision | accepted | `docs/adr/0002-ui-baseline-ant-design-pro.md` |
| Route/page implementation | implemented | `apps/web/src/app/router.tsx`, `apps/web/src/app/shell.tsx`, `apps/web/src/features/people/`, `apps/web/src/features/customers/`, `apps/web/src/features/tasks/`, `apps/web/src/features/performance/`, `apps/web/src/features/salary/`, `apps/web/src/features/finance/`, `apps/web/src/features/system/` |
| TypeScript gate | passed | `corepack pnpm typecheck` |
| Lint gate | passed | `corepack pnpm lint` |
| Production build gate | passed | `corepack pnpm build:web` |
| Browser visual smoke | passed | Opened local routes in the in-app browser; custom topbar/sidebar, active personnel/customer/task/performance/finance/system submodules, single-line metric cards, shared `ManagementTable`, shared `DetailTabs`, row-click drawers, business-role package display, task-type standard-library controls, task assignment candidate selectors, type-dependent status controls, plaintext static mock archive details, compact pagination, and shared file-slot/dropzone/voucher panels sanity checks passed. |

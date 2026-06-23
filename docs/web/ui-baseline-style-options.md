# UI Baseline Style Options

## 1. Metadata

- Status: selected
- Date: 2026-06-09
- Purpose: collect selectable UI baseline directions before implementing the admin console

## 2. Product UI Needs

StartupManageSystem is an internal management console with:

- multi-level modules and submodules
- dense tables and filters
- task workflow states
- rule/version management
- settlement and finance views
- role-based navigation
- sensitive personnel information
- dashboards with drill-down

The UI should prioritize operational clarity, scanability, predictable navigation, and low-friction repeated use.

## 3. Candidate Style Directions

### Option A: Ant Design Pro Style

Reference:

- Ant Design components: https://ant.design/components/overview/
- ProLayout: https://next-procomponents.ant.design/en-US/components/layout/
- ProComponents introduction: https://next-procomponents.ant.design/en-US/docs/intro/
- Ant Design visualization page guidance: https://ant.design/docs/spec/visualization-page/

Visual and UX character:

- Enterprise admin console feel.
- Dense but familiar tables, forms, filters, drawers, modals, and status tags.
- Sidebar-first navigation with page container, breadcrumbs, page actions, and table query forms.
- Strong fit for Chinese enterprise/admin workflows.

Best fit:

- Multi-module operations backend.
- Complex tables and forms.
- Rule configuration and settlement workflows.
- Fast prototype-to-implementation path if Ant Design is selected.

Tradeoffs:

- Can look generic if not themed carefully.
- Heavy component style; needs discipline to avoid screen clutter.

### Option B: shadcn/ui Modern Operations Style

Reference:

- shadcn/ui blocks: https://v3.shadcn.com/blocks
- shadcn dashboard block reference: https://shadcncraft.com/blocks/official-shadcn/dashboard

Visual and UX character:

- Clean, modern, monochrome-leaning SaaS operations UI.
- Sidebar + top header + cards + data table composition.
- Good control over details because components are copied into the codebase and styled locally.
- Works well for a restrained but polished internal tool.

Best fit:

- Custom product identity.
- Modern React/Tailwind stack.
- Screens that need mixed cards, tables, charts, and detail drawers without looking like a default enterprise template.

Tradeoffs:

- More assembly work than Ant Design.
- Advanced data-grid behavior may require TanStack Table and extra engineering decisions.

### Option C: IBM Carbon / Data Operations Style

Reference:

- Carbon patterns overview: https://carbondesignsystem.com/patterns/overview/
- Carbon dashboards guidance: https://carbondesignsystem.com/data-visualization/dashboards/
- Carbon data table: https://carbondesignsystem.com/components/data-table/usage/

Visual and UX character:

- Highly structured, neutral, data-heavy enterprise style.
- Strong hierarchy, restrained palette, good dashboard discipline.
- Emphasis on patterns for filtering, forms, notifications, empty states, dashboards, and global header.

Best fit:

- Operating finance, task analytics, and drill-down dashboards.
- Users who need reliability and data comprehension over visual warmth.

Tradeoffs:

- Can feel too corporate/industrial for a smaller business if copied too literally.
- Requires careful localization and typography choices for Chinese-heavy screens.

### Option D: Atlassian Work-Management Style

Reference:

- Atlassian Design System: https://atlassian.design/design-system/
- Atlassian components: https://atlassian.design/components
- Atlassian primitives: https://atlassian.design/components/primitives/overview/

Visual and UX character:

- Work-management/productivity feel.
- Strong fit for task queues, comments, status lozenges, inline edits, drawers, and collaborative review flows.
- Navigation and page structures can support project/task workflows naturally.

Best fit:

- Delivery manager, reviewer, and designer workflows.
- Task state tracking, review feedback, and exception handling.

Tradeoffs:

- Some Atlassian layout/navigation packages are access-limited or product-specific.
- More useful as visual/interaction inspiration than as a direct component dependency.

### Option E: Material / MUI Operations Style

Reference:

- Material data tables guidance: https://m2.material.io/components/data-tables
- MUI X Data Grid: https://mui.com/x/react-data-grid/getting-started
- MUI X repository overview: https://github.com/mui/mui-x

Visual and UX character:

- Broadly familiar Material-style surfaces, forms, dialogs, and tables.
- Strong data-grid ecosystem through MUI X.
- Smooth fit for modern React apps and finance-like tables if MUI is selected.

Best fit:

- Data grid-heavy screens.
- Teams comfortable with Material UI.
- Apps needing robust table features and common UI conventions.

Tradeoffs:

- MUI X advanced grid features can introduce commercial licensing decisions.
- Material visual language may feel less tailored unless themed carefully.

## 4. Recommended Shortlist

For this product, the strongest candidates are:

1. Option A: Ant Design Pro Style
2. Option B: shadcn/ui Modern Operations Style
3. Option D: Atlassian Work-Management Style

Reasoning:

- Ant Design Pro best matches Chinese enterprise admin density and table/form workflows.
- shadcn/ui gives the cleanest custom modern baseline if we want the product to feel less template-like.
- Atlassian is useful for task/review/exception workflows even if not selected as the component stack.

## 5. Selection Criteria

Choose the baseline by deciding:

- Should the system feel more like a dense Chinese enterprise admin console or a modern SaaS operations tool?
- Is fast implementation with mature admin components more important than custom visual identity?
- Are task/review workflows or finance/table workflows the visual priority?
- Should the first prototype optimize for desktop-only density or also strong responsive behavior?

## 6. Baseline Decision Placeholder

Selected UI baseline: Option A, Ant Design Pro Style.

Selection date: 2026-06-09.

Decision evidence:

- User selected Ant Design Pro style after reviewing the options.
- ADR: `docs/adr/0002-ui-baseline-ant-design-pro.md`

Implementation boundary:

- This selects the visual and interaction baseline.
- It does not yet select frontend framework, package manager, exact dependency versions, or whether to use Umi.
- Dependency admission is required before adding Ant Design, ProComponents, or related packages.

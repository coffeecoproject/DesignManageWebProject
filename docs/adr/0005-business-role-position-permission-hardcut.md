# ADR 0005: Business Role And Position Permission Boundary

Date: `2026-06-21`

Status: `accepted_for_frontend_prototype`

Supersedes: `0003-position-role-permission-hardcut.md`

## Context

The previous frontend prototype moved permission-item editing into `/system/roles` and removed position-level permission exceptions from `岗位管理`.

That was still not aligned with the target lightweight middle-platform model discussed for this project:

- Account system roles should stay in the future account/auth domain.
- Business roles should be reusable default permission packages.
- Positions should be able to bind multiple business roles.
- Positions should also be able to add extra permissions on top of those default packages.
- Personnel should eventually inherit permissions from one or more positions.

## Decision

Hard cut to this frontend model:

```text
Person -> positions
Position -> business roles
Business role -> default permissions
Position -> extra permissions
Position effective permissions = union(fixed business role default permissions, position extra permissions)
Account -> system role
```

Current frontend implementation scope:

- `/system/roles` is labeled `业务角色`.
- `/system/roles` displays six read-only business roles: `经营管理角色`, `财务角色`, `行政人事角色`, `设计执行角色`, `设计审核角色`, and `外协执行角色`.
- `/system/roles` does not create business roles, edit role names/status, or add/remove default permission items.
- `/people/position-permissions` stays under `人员组织 / 岗位管理`.
- `岗位管理` binds positions to multiple business roles.
- `岗位管理` owns position-level extra permissions.
- `岗位管理` displays effective permissions as the union of fixed business-role default permissions and position extra permissions.
- Position extra-permission selection excludes permissions already inherited from selected business roles.
- Business-role and position effective-permission displays share the same grouped permission presentation component and reuse the existing role-permission layout styles.

Account system roles remain future account/auth data and are not rendered in personnel, task, customer, finance, performance, salary, or tax business modules.

Expected future account system roles remain:

- `超级管理员`
- `管理员`
- `普通人员`

## Consequences

- `/system/roles` is now a read-only business-role package view, not a permission editing workbench.
- `/people/position-permissions` is the only current frontend surface for adding position-level extra permissions.
- The current frontend can preview position effective permissions, but this is not backend authorization evidence.
- Personnel authorization now consumes effective-dated position-assignment records and supports concurrent positions in the frontend contract.
- Fixed position data scopes, menu filtering, route guards, selected mutation controls, and personnel/task record filtering consume the same frontend authorization result. Backend enforcement and audit persistence remain future authorization work.
- Any future backend permission implementation must treat frontend-hidden controls as insufficient; backend authorization checks are still required.

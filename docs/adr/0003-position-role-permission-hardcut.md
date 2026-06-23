# ADR 0003: Position Permission Role And Account Role Boundary

Date: `2026-06-11`

Status: `superseded_by_0005`

Superseded by: `0005-business-role-position-permission-hardcut.md`

## Context

The previous prototype mixed position configuration, system role labels, role default permissions, and position-level permission exceptions in `/people/position-permissions` and personnel pages.

That model made permission ownership ambiguous:

- Position rows could bind multiple old system-role labels.
- Personnel archive records could carry system-role labels directly.
- Position rows could add or close inherited permissions.
- `/system/roles` was labeled as system-role permission management while also acting as the permission source for positions.

## Decision

Hard cut to this frontend model:

```text
Person -> position
Position -> permission roles
Permission role -> permissions
Position permissions = union(permission roles.permissions)
Account -> system role
```

System roles are account-level labels, not personnel archive fields and not business permissions. The current frontend business modules do not render or edit account system roles.

Future account-system-role values are:

- `超级管理员`
- `管理员`
- `普通人员`

All current business positions, including `CEO` and `外协设计师`, default to business personnel. If a real account needs `管理员` or `超级管理员`, that grant must happen through future account management with audit evidence, not through personnel archive or position editing.

Permission roles managed by `/system/roles` are business permission roles:

- `经营管理角色`
- `财务角色`
- `行政人事角色`
- `设计执行角色`
- `设计审核角色`
- `外协执行角色`

`超级管理员` is not a permission role. System capabilities such as account management, role-permission administration, and system settings are deferred to the future account-level authorization model, not inherited through position permission roles or personnel archive fields.

Position default role bindings are:

| Position | Permission roles |
| --- | --- |
| `CEO` | `经营管理角色` |
| `财务专员` | `财务角色` |
| `行政专员` | `行政人事角色` |
| `空间设计师` | `设计执行角色` |
| `主案设计师` | `设计执行角色`, `设计审核角色` |
| `外协设计师` | `外协执行角色` |

## Consequences

- `/people/position-permissions` no longer supports position-level permission exceptions.
- Position drawers use `岗位信息`, `角色配置`, `权限预览`, and `岗位文件`.
- `/system/roles` is the only frontend surface that adds or removes permissions from permission roles.
- Personnel overview and personnel archive pages do not render or edit account system roles.
- Personnel archive creation/editing does not require system role and does not derive salary mode from system role.
- Mock audit rows use named actors instead of role labels as operators.
- Position pages can preview permissions but cannot edit individual permissions.
- Real backend authorization, database schema, audit logging, and session enforcement remain future work.

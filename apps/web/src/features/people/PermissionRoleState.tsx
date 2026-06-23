import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  accessRoleOptions,
  getRolesBoundPositions,
  positionRoleDefaults,
  rolePermissionDefaults,
  type AccessRole
} from './rolePermissionModel';

export type RoleStatus = '启用' | '停用';

export type RolePermissionRow = {
  id: string;
  code: string;
  role: AccessRole;
  permissions: string[];
  positions: string[];
  status: RoleStatus;
  updatedAt: string;
};

type PermissionRoleStateValue = {
  permissionByRole: Record<AccessRole, string[]>;
  positionRoleBindings: PositionRoleBindingMap;
  roleRows: RolePermissionRow[];
  syncRolePositions: (positionRows: PositionRoleBinding[]) => void;
};

type PositionRoleBinding = {
  position: string;
  roleBindings: AccessRole[];
};

export type PositionRoleBindingMap = Record<string, AccessRole[]>;

const prototypeToday = '2026-06-11';

const roleMeta: Record<AccessRole, Pick<RolePermissionRow, 'id' | 'code' | 'updatedAt'>> = {
  经营管理角色: {
    id: 'role-business-management',
    code: 'ROLE-2026-001',
    updatedAt: prototypeToday
  },
  财务角色: {
    id: 'role-finance',
    code: 'ROLE-2026-002',
    updatedAt: prototypeToday
  },
  行政人事角色: {
    id: 'role-admin-hr',
    code: 'ROLE-2026-003',
    updatedAt: prototypeToday
  },
  设计执行角色: {
    id: 'role-design-execution',
    code: 'ROLE-2026-004',
    updatedAt: prototypeToday
  },
  设计审核角色: {
    id: 'role-design-review',
    code: 'ROLE-2026-005',
    updatedAt: prototypeToday
  },
  外协执行角色: {
    id: 'role-external-execution',
    code: 'ROLE-2026-006',
    updatedAt: prototypeToday
  }
};

function createRoleRows(): RolePermissionRow[] {
  return accessRoleOptions.map((role) => ({
    ...roleMeta[role],
    permissions: rolePermissionDefaults[role],
    positions: getRolesBoundPositions(role),
    role,
    status: '启用'
  }));
}

function createPositionRoleBindings(): PositionRoleBindingMap {
  return Object.entries(positionRoleDefaults).reduce((currentMap, [position, roleBindings]) => {
    currentMap[position] = roleBindings;
    return currentMap;
  }, {} as PositionRoleBindingMap);
}

function getPositionsByRole(roleRows: RolePermissionRow[], positionRows: PositionRoleBinding[]) {
  return roleRows.reduce((currentMap, row) => {
    const role = row.role;
    currentMap[role] = positionRows
      .filter((positionRow) => positionRow.roleBindings.includes(role))
      .map((positionRow) => positionRow.position);
    return currentMap;
  }, {} as Record<AccessRole, string[]>);
}

function updateRolePositions(roleRows: RolePermissionRow[], positionRows: PositionRoleBinding[]) {
  const positionsByRole = getPositionsByRole(roleRows, positionRows);

  return roleRows.map((row) => ({
    ...row,
    positions: positionsByRole[row.role] ?? []
  }));
}

const PermissionRoleStateContext = createContext<PermissionRoleStateValue | undefined>(undefined);

export function PermissionRoleProvider({ children }: { children: ReactNode }) {
  const [roleRows, setRoleRows] = useState<RolePermissionRow[]>(() => createRoleRows());
  const [positionRoleBindings, setPositionRoleBindings] = useState<PositionRoleBindingMap>(() => createPositionRoleBindings());

  const permissionByRole = useMemo(
    () =>
      roleRows.reduce((currentMap, row) => {
        currentMap[row.role] = row.status === '启用' ? row.permissions : [];
        return currentMap;
      }, {} as Record<AccessRole, string[]>),
    [roleRows]
  );

  const value = useMemo<PermissionRoleStateValue>(
    () => ({
      permissionByRole,
      positionRoleBindings,
      roleRows,
      syncRolePositions(positionRows) {
        setPositionRoleBindings(
          positionRows.reduce((currentMap, row) => {
            currentMap[row.position] = row.roleBindings;
            return currentMap;
          }, {} as PositionRoleBindingMap)
        );
        setRoleRows((currentRows) => updateRolePositions(currentRows, positionRows));
      }
    }),
    [permissionByRole, positionRoleBindings, roleRows]
  );

  return <PermissionRoleStateContext.Provider value={value}>{children}</PermissionRoleStateContext.Provider>;
}

export function usePermissionRoleState() {
  const value = useContext(PermissionRoleStateContext);

  if (!value) {
    throw new Error('usePermissionRoleState must be used within PermissionRoleProvider');
  }

  return value;
}

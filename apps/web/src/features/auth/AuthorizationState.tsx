import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePeopleOrganizationState, peopleOrganizationToday } from '../people/PeopleOrganizationState';
import { usePermissionRoleState } from '../people/PermissionRoleState';
import {
  hasBusinessPermission,
  hasSystemPermission,
  resolveEffectiveAuthorization,
  type EffectiveAuthorization,
  type FrontendAccount,
  type SystemPermission
} from './authorizationModel';

const demoAccount: FrontendAccount = {
  id: 'account-demo-super-admin',
  memberId: '20260001',
  name: '李明',
  status: '启用',
  systemRole: '超级管理员'
};

type AuthorizationStateValue = {
  authorization: EffectiveAuthorization;
  can: (permission: string) => boolean;
  canSystem: (permission: SystemPermission) => boolean;
};

const AuthorizationStateContext = createContext<AuthorizationStateValue | undefined>(undefined);

export function AuthorizationProvider({ children }: { children: ReactNode }) {
  const { peopleRows, positionRows } = usePeopleOrganizationState();
  const { permissionByRole } = usePermissionRoleState();
  const member = peopleRows.find((person) => person.id === demoAccount.memberId);
  const authorization = useMemo(
    () => resolveEffectiveAuthorization({
      account: demoAccount,
      member,
      permissionByRole,
      positions: positionRows,
      today: peopleOrganizationToday
    }),
    [member, permissionByRole, positionRows]
  );
  const value = useMemo<AuthorizationStateValue>(() => ({
    authorization,
    can: (permission) => hasBusinessPermission(authorization, permission),
    canSystem: (permission) => hasSystemPermission(authorization, permission)
  }), [authorization]);

  return <AuthorizationStateContext.Provider value={value}>{children}</AuthorizationStateContext.Provider>;
}

export function useAuthorizationState() {
  const value = useContext(AuthorizationStateContext);

  if (!value) {
    throw new Error('useAuthorizationState must be used within AuthorizationProvider');
  }

  return value;
}

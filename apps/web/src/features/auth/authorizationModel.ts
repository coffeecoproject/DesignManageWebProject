import type { PeopleMember, PeoplePositionAssignment } from '../people/peopleTypes';
import type { PositionManagementRecord } from '../people/peopleDomain';
import type { AccessRole } from '../people/rolePermissionModel';

export type SystemRole = '超级管理员' | '管理员' | '普通人员';
export type SystemPermission =
  | 'system.accounts.manage'
  | 'system.configuration.manage'
  | 'system.initialization.manage'
  | 'system.roles.view';

export type PeopleDataScope = '本人' | '全部人员';
export type TaskDataScope = '本人参与' | '负责验收' | '全部任务';
export type CustomerDataScope = '关联品牌' | '全部客户';
export type FinanceDataScope = '不可访问' | '查看' | '管理';
export type SalaryDataScope = '本人' | '全部人员';

export type PositionDataScope = {
  people: PeopleDataScope;
  tasks: TaskDataScope;
  customers: CustomerDataScope;
  finance: FinanceDataScope;
  salary: SalaryDataScope;
};

export type FrontendAccount = {
  id: string;
  memberId?: string;
  name: string;
  status: '启用' | '停用';
  systemRole: SystemRole;
};

export type EffectiveAuthorization = {
  account: FrontendAccount;
  activeAssignments: PeoplePositionAssignment[];
  businessPermissions: string[];
  dataScopes: PositionDataScope;
  systemPermissions: SystemPermission[];
};

export const defaultPositionDataScope: PositionDataScope = {
  people: '本人',
  tasks: '本人参与',
  customers: '关联品牌',
  finance: '不可访问',
  salary: '本人'
};

export const systemRolePermissionDefaults: Record<SystemRole, SystemPermission[]> = {
  超级管理员: ['system.accounts.manage', 'system.configuration.manage', 'system.initialization.manage', 'system.roles.view'],
  管理员: ['system.accounts.manage', 'system.configuration.manage', 'system.roles.view'],
  普通人员: []
};

const peopleScopeRank: Record<PeopleDataScope, number> = { 本人: 0, 全部人员: 1 };
const taskScopeRank: Record<TaskDataScope, number> = { 本人参与: 0, 负责验收: 1, 全部任务: 2 };
const customerScopeRank: Record<CustomerDataScope, number> = { 关联品牌: 0, 全部客户: 1 };
const financeScopeRank: Record<FinanceDataScope, number> = { 不可访问: 0, 查看: 1, 管理: 2 };
const salaryScopeRank: Record<SalaryDataScope, number> = { 本人: 0, 全部人员: 1 };

function getWidestScope<T extends string>(values: T[], rank: Record<T, number>, fallback: T) {
  return values.reduce((widest, value) => (rank[value] > rank[widest] ? value : widest), fallback);
}

export function mergePositionDataScopes(scopes: PositionDataScope[]): PositionDataScope {
  return {
    people: getWidestScope(scopes.map((scope) => scope.people), peopleScopeRank, defaultPositionDataScope.people),
    tasks: getWidestScope(scopes.map((scope) => scope.tasks), taskScopeRank, defaultPositionDataScope.tasks),
    customers: getWidestScope(scopes.map((scope) => scope.customers), customerScopeRank, defaultPositionDataScope.customers),
    finance: getWidestScope(scopes.map((scope) => scope.finance), financeScopeRank, defaultPositionDataScope.finance),
    salary: getWidestScope(scopes.map((scope) => scope.salary), salaryScopeRank, defaultPositionDataScope.salary)
  };
}

export function isPositionAssignmentActive(assignment: PeoplePositionAssignment, today: string) {
  return assignment.status === '生效中'
    && assignment.effectiveFrom <= today
    && (!assignment.effectiveTo || assignment.effectiveTo >= today);
}

function hasActivePeopleRelationship(member?: PeopleMember) {
  return Boolean(member && member.status !== '离职' && member.status !== '结束合作');
}

export function resolveEffectiveAuthorization({
  account,
  member,
  permissionByRole,
  positions,
  today
}: {
  account: FrontendAccount;
  member?: PeopleMember;
  permissionByRole: Record<AccessRole, string[]>;
  positions: PositionManagementRecord[];
  today: string;
}): EffectiveAuthorization {
  if (account.status !== '启用') {
    return {
      account,
      activeAssignments: [],
      businessPermissions: [],
      dataScopes: defaultPositionDataScope,
      systemPermissions: []
    };
  }

  const activeAssignments = hasActivePeopleRelationship(member)
    ? member?.positionAssignments.filter((assignment) => isPositionAssignmentActive(assignment, today)) ?? []
    : [];
  const activePositionIds = new Set(activeAssignments.map((assignment) => assignment.positionId));
  const activePositionNames = new Set(activeAssignments.map((assignment) => assignment.positionName));
  const activePositions = positions.filter(
    (position) => position.status === '启用' && (activePositionIds.has(position.id) || activePositionNames.has(position.position))
  );
  const businessPermissions = Array.from(
    new Set(
      activePositions.flatMap((position) => [
        ...position.roleBindings.flatMap((role) => permissionByRole[role] ?? []),
        ...position.extraPermissions
      ])
    )
  );

  return {
    account,
    activeAssignments,
    businessPermissions,
    dataScopes: mergePositionDataScopes(activePositions.map((position) => position.dataScopes)),
    systemPermissions: systemRolePermissionDefaults[account.systemRole]
  };
}

export function hasBusinessPermission(authorization: EffectiveAuthorization, permission: string) {
  return authorization.businessPermissions.includes(permission);
}

export function hasSystemPermission(authorization: EffectiveAuthorization, permission: SystemPermission) {
  return authorization.systemPermissions.includes(permission);
}

export function canAccessPerson(authorization: EffectiveAuthorization, memberId: string) {
  return authorization.dataScopes.people === '全部人员' || authorization.account.memberId === memberId;
}

export function canAccessTask(
  authorization: EffectiveAuthorization,
  task: { acceptorId?: string; executorId?: string }
) {
  if (authorization.dataScopes.tasks === '全部任务') {
    return true;
  }

  const memberId = authorization.account.memberId;
  if (!memberId) {
    return false;
  }

  if (task.executorId === memberId) {
    return true;
  }

  return authorization.dataScopes.tasks === '负责验收' && task.acceptorId === memberId;
}

import type { TagChipTone } from '../../components/TagChip';

export type PositionName = 'CEO' | '财务专员' | '行政专员' | '空间设计师' | '主案设计师' | '外协设计师';
export type PermissionCategory = '人员组织' | '客户任务' | '绩效薪酬' | '财务税务' | '文件资料';

export type PermissionDefinition = {
  id: string;
  name: string;
  category: PermissionCategory;
};

export const positionOptions: PositionName[] = ['CEO', '财务专员', '行政专员', '空间设计师', '主案设计师', '外协设计师'];

export const positionIdByName: Record<PositionName, string> = {
  CEO: 'position-ceo',
  财务专员: 'position-finance',
  行政专员: 'position-admin',
  空间设计师: 'position-space-designer',
  主案设计师: 'position-lead-designer',
  外协设计师: 'position-external-designer'
};

export function getPositionId(position: string) {
  return position in positionIdByName ? positionIdByName[position as PositionName] : `position-${position}`;
}

export const accessRoleOptions = [
  '经营管理角色',
  '财务角色',
  '行政人事角色',
  '设计执行角色',
  '设计审核角色',
  '外协执行角色'
] as const;

export type AccessRole = (typeof accessRoleOptions)[number];

const accessRoleTone: Record<string, TagChipTone> = {
  经营管理角色: 'blue',
  财务角色: 'green',
  行政人事角色: 'purple',
  设计执行角色: 'blue',
  设计审核角色: 'amber',
  外协执行角色: 'gray'
};

export const permissionCategoryTone: Record<PermissionCategory, TagChipTone> = {
  人员组织: 'green',
  客户任务: 'blue',
  绩效薪酬: 'purple',
  财务税务: 'amber',
  文件资料: 'gray'
};

export function getAccessRoleTone(role: AccessRole) {
  return accessRoleTone[role] ?? 'blue';
}

export const permissionCategoryOrder: PermissionCategory[] = ['人员组织', '客户任务', '绩效薪酬', '财务税务', '文件资料'];

export const permissionCatalog: PermissionDefinition[] = [
  { id: 'people.overview.read', name: '人员总览查看', category: '人员组织' },
  { id: 'people.archive.read', name: '人员档案查看', category: '人员组织' },
  { id: 'people.archive.manage', name: '人员档案维护', category: '人员组织' },
  { id: 'people.movement.manage', name: '人事异动维护', category: '人员组织' },
  { id: 'people.position.manage', name: '岗位管理', category: '人员组织' },
  { id: 'people.attendance.manage', name: '考勤管理', category: '人员组织' },
  { id: 'customer.read', name: '客户资料查看', category: '客户任务' },
  { id: 'customer.manage', name: '客户资料维护', category: '客户任务' },
  { id: 'task.read', name: '任务查看', category: '客户任务' },
  { id: 'task.submit', name: '任务成果提交', category: '客户任务' },
  { id: 'task.manage', name: '任务管理', category: '客户任务' },
  { id: 'task.accept', name: '任务验收', category: '客户任务' },
  { id: 'performance.read', name: '绩效查看', category: '绩效薪酬' },
  { id: 'performance.manage', name: '绩效管理', category: '绩效薪酬' },
  { id: 'salary.read', name: '薪酬社保查看', category: '绩效薪酬' },
  { id: 'salary.manage', name: '薪酬社保维护', category: '绩效薪酬' },
  { id: 'finance.read', name: '财务数据查看', category: '财务税务' },
  { id: 'finance.manage', name: '财务账务维护', category: '财务税务' },
  { id: 'tax.read', name: '税务数据查看', category: '财务税务' },
  { id: 'tax.manage', name: '税务办理', category: '财务税务' },
  { id: 'file.read', name: '文件查看', category: '文件资料' },
  { id: 'file.manage', name: '文件维护', category: '文件资料' }
];

export const rolePermissionDefaults: Record<AccessRole, string[]> = {
  经营管理角色: permissionCatalog.map((permission) => permission.id),
  财务角色: ['people.archive.read', 'customer.read', 'salary.read', 'salary.manage', 'finance.read', 'finance.manage', 'tax.read', 'tax.manage', 'file.read'],
  行政人事角色: ['people.overview.read', 'people.archive.read', 'people.archive.manage', 'people.movement.manage', 'people.position.manage', 'people.attendance.manage', 'performance.read', 'performance.manage', 'salary.read', 'salary.manage', 'file.read', 'file.manage'],
  设计执行角色: ['customer.read', 'task.read', 'task.submit', 'performance.read', 'file.read', 'file.manage'],
  设计审核角色: ['customer.read', 'task.read', 'task.manage', 'task.accept', 'performance.read', 'file.read'],
  外协执行角色: ['customer.read', 'task.read', 'task.submit', 'performance.read', 'file.read', 'file.manage']
};

export const positionRoleDefaults: Record<PositionName, AccessRole[]> = {
  CEO: ['经营管理角色'],
  财务专员: ['财务角色'],
  行政专员: ['行政人事角色'],
  空间设计师: ['设计执行角色'],
  主案设计师: ['设计执行角色', '设计审核角色'],
  外协设计师: ['外协执行角色']
};

export function getPermissionCategory(permission: string): PermissionCategory {
  return permissionCatalog.find((item) => item.id === permission)?.category ?? '文件资料';
}

export function getPermissionName(permission: string) {
  return permissionCatalog.find((item) => item.id === permission)?.name ?? permission;
}

export function getPositionRoles(position: string): AccessRole[] {
  return position in positionRoleDefaults ? positionRoleDefaults[position as PositionName] : [];
}

export function getRolesBoundPositions(role: AccessRole) {
  return positionOptions.filter((position) => positionRoleDefaults[position].includes(role));
}

export function mergePermissions(permissionGroups: string[][]) {
  return Array.from(new Set(permissionGroups.flat()));
}

export function getBusinessRolePermissions(roles: AccessRole[], permissionByRole: Record<AccessRole, string[]>) {
  return mergePermissions(roles.map((role) => permissionByRole[role] ?? []));
}

export function getPositionEffectivePermissions({
  extraPermissions,
  permissionByRole,
  roles
}: {
  extraPermissions: string[];
  permissionByRole: Record<AccessRole, string[]>;
  roles: AccessRole[];
}) {
  return mergePermissions([getBusinessRolePermissions(roles, permissionByRole), extraPermissions]);
}

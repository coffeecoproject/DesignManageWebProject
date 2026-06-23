import type { TagChipTone } from '../../components/TagChip';

export type AccessRole = string;
export type PositionName = 'CEO' | '财务专员' | '行政专员' | '空间设计师' | '主案设计师' | '外协设计师';
export type PermissionCategory = '人员组织' | '任务协作' | '经营财务' | '文件资料';

export type PermissionDefinition = {
  id: string;
  name: string;
  category: PermissionCategory;
};

export const positionOptions: PositionName[] = ['CEO', '财务专员', '行政专员', '空间设计师', '主案设计师', '外协设计师'];

export const accessRoleOptions: AccessRole[] = [
  '经营管理角色',
  '财务角色',
  '行政人事角色',
  '设计执行角色',
  '设计审核角色',
  '外协执行角色'
];

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
  任务协作: 'blue',
  经营财务: 'amber',
  文件资料: 'gray'
};

export function getAccessRoleTone(role: AccessRole) {
  return accessRoleTone[role] ?? 'blue';
}

export const permissionCategoryOrder: PermissionCategory[] = ['人员组织', '任务协作', '经营财务', '文件资料'];

export const permissionCatalog: PermissionDefinition[] = [
  { id: 'people-overview', name: '人员总览查看', category: '人员组织' },
  { id: 'people-archive-read', name: '人员档案查看', category: '人员组织' },
  { id: 'people-archive-manage', name: '人员档案维护', category: '人员组织' },
  { id: 'people-movement-manage', name: '人事异动维护', category: '人员组织' },
  { id: 'task-view', name: '任务查看', category: '任务协作' },
  { id: 'task-submit', name: '任务成果提交', category: '任务协作' },
  { id: 'task-assign', name: '任务分配', category: '任务协作' },
  { id: 'task-acceptance', name: '任务验收', category: '任务协作' },
  { id: 'proposal-review', name: '方案审核', category: '任务协作' },
  { id: 'business-dashboard', name: '经营看板查看', category: '经营财务' },
  { id: 'finance-view', name: '财务数据查看', category: '经营财务' },
  { id: 'operating-loss', name: '经营损失记录', category: '经营财务' },
  { id: 'salary-archive-read', name: '薪资档案查看', category: '经营财务' },
  { id: 'salary-monthly-read', name: '薪酬明细查看', category: '经营财务' },
  { id: 'salary-monthly-manage', name: '薪酬明细维护', category: '经营财务' },
  { id: 'file-view', name: '文件查看', category: '文件资料' },
  { id: 'file-manage', name: '文件维护', category: '文件资料' },
  { id: 'design-file-upload', name: '设计文件上传', category: '文件资料' }
];

export const rolePermissionDefaults: Record<AccessRole, string[]> = {
  经营管理角色: ['经营看板查看', '财务数据查看', '经营损失记录', '薪酬明细查看', '任务查看', '任务验收', '文件查看'],
  财务角色: ['财务数据查看', '经营损失记录', '薪资档案查看', '薪酬明细查看', '薪酬明细维护', '人员档案查看', '文件查看'],
  行政人事角色: ['人员总览查看', '人员档案查看', '人员档案维护', '人事异动维护', '文件维护'],
  设计执行角色: ['任务查看', '任务成果提交', '设计文件上传', '文件查看'],
  设计审核角色: ['任务查看', '任务分配', '任务验收', '方案审核', '文件查看'],
  外协执行角色: ['任务查看', '任务成果提交', '设计文件上传', '文件查看']
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
  return permissionCatalog.find((item) => item.name === permission)?.category ?? '文件资料';
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

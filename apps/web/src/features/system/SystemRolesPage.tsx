import type { TableColumnsType } from 'antd';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { TagChipList } from '../../components/TagChip';
import { CompactCell } from '../../components/TableCell';
import type { SystemPermission, SystemRole } from '../auth/authorizationModel';
import { systemRolePermissionDefaults } from '../auth/authorizationModel';

type SystemRoleRow = {
  code: string;
  description: string;
  permissions: SystemPermission[];
  role: SystemRole;
};

const systemPermissionNames: Record<SystemPermission, string> = {
  'system.accounts.manage': '账号管理',
  'system.configuration.manage': '系统配置',
  'system.initialization.manage': '账套初始化',
  'system.roles.view': '角色查看'
};

const rows: SystemRoleRow[] = [
  { code: 'SYS-ROLE-001', description: '管理账号、系统配置与初始化事项', permissions: systemRolePermissionDefaults.超级管理员, role: '超级管理员' },
  { code: 'SYS-ROLE-002', description: '管理账号与日常系统配置', permissions: systemRolePermissionDefaults.管理员, role: '管理员' },
  { code: 'SYS-ROLE-003', description: '仅使用岗位授予的业务能力', permissions: systemRolePermissionDefaults.普通人员, role: '普通人员' }
];

const columns: TableColumnsType<SystemRoleRow> = [
  {
    title: '系统角色',
    dataIndex: 'role',
    width: 220,
    render: (role: SystemRole, record) => <CompactCell primary={role} secondary={record.code} />
  },
  {
    title: '系统权限',
    dataIndex: 'permissions',
    width: 420,
    render: (permissions: SystemPermission[]) => (
      <TagChipList
        emptyText="无系统管理权限"
        items={permissions.map((permission) => systemPermissionNames[permission])}
        tone="gray"
        wrap
      />
    )
  },
  { title: '说明', dataIndex: 'description', width: 360 }
];

export function SystemRolesPage() {
  return (
    <ManagementPageScaffold>
      <ManagementTable
        columns={columns}
        count={{ unit: '个角色', value: rows.length }}
        dataSource={rows}
        rowKey="code"
        title="系统角色"
      />
    </ManagementPageScaffold>
  );
}

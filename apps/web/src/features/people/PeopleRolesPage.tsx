import {
  KeyOutlined,
  SafetyCertificateOutlined,
  TeamOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useState } from 'react';
import { BindingSummaryGrid } from '../../components/BindingSummaryGrid';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DrawerProfileCard } from '../../components/DrawerProfileCard';
import { DrawerShell } from '../../components/DrawerShell';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { TagChip, TagChipList } from '../../components/TagChip';
import { CellText, CompactCell } from '../../components/TableCell';
import { PermissionGroupList, PermissionPreviewTags } from './PermissionDisplay';
import { type RolePermissionRow, usePermissionRoleState } from './PermissionRoleState';
import { getAccessRoleTone } from './rolePermissionModel';

function BusinessRoleCell({ record }: { record: RolePermissionRow }) {
  return (
    <div className="role-cell">
      <span className="role-cell-avatar">{record.role.slice(0, 1)}</span>
      <CompactCell primary={record.role} secondary={record.code} />
    </div>
  );
}

function PositionTags({ positions }: { positions: string[] }) {
  if (positions.length === 0) {
    return <CellText tone="subtle">未绑定岗位</CellText>;
  }

  return <TagChipList items={positions} tone="gray" wrap />;
}

function RolePositionScope({ positions }: { positions: string[] }) {
  return (
    <BindingSummaryGrid
      emptyText="未绑定岗位"
      items={positions.map((position) => ({
        extra: <TagChip label="岗位绑定" />,
        key: position,
        label: position
      }))}
    />
  );
}

function BusinessRoleDrawer({
  record,
  open,
  onClose
}: {
  record?: RolePermissionRow;
  open: boolean;
  onClose: () => void;
}) {
  if (!record) {
    return null;
  }

  return (
    <DrawerShell
      cancelAction={{ label: '关闭', onClick: onClose }}
      className="people-detail-drawer role-permission-drawer"
      contentLayout="detail"
      open={open}
      title={
        <DetailDrawerTitle
          subtitle="系统管理 / 业务角色"
          title="业务角色详情"
        />
      }
      width={720}
      onClose={onClose}
    >
      <DrawerProfileCard
        avatar={record.role.slice(0, 1)}
        subtitle={record.code}
        tags={[
          <TagChip key="role" label="默认权限包" tone={getAccessRoleTone(record.role)} />,
          <TagChip key="permissionCount" label={`${record.permissions.length} 项权限`} />
        ]}
        title={record.role}
      />

      <DetailSummaryCards
        columns={2}
        items={[
          {
            icon: <KeyOutlined />,
            key: 'permissions',
            label: '默认权限',
            value: `${record.permissions.length} 项`
          },
          {
            icon: <TeamOutlined />,
            key: 'positions',
            label: '绑定岗位',
            value: `${record.positions.length} 个`
          }
        ]}
      />

      <DetailTabs
        defaultActiveKey="info"
        tabTestIdPrefix="people-role-detail-tab"
        testId="people-role-detail-tabs"
        items={[
          {
            key: 'info',
            label: '角色信息',
            children: (
              <>
                <DetailSection icon={<SafetyCertificateOutlined />} title="业务角色">
                  <DetailInfoGrid
                    columns={2}
                    items={[
                      { label: '业务角色', value: <TagChip label={record.role} tone={getAccessRoleTone(record.role)} /> },
                      { label: '业务角色编码', value: record.code }
                    ]}
                  />
                </DetailSection>

                <DetailSection icon={<TeamOutlined />} title="绑定岗位">
                  <RolePositionScope positions={record.positions} />
                </DetailSection>
              </>
            )
          },
          {
            key: 'permissions',
            label: '默认权限',
            children: (
              <DetailSection icon={<KeyOutlined />} title="默认权限">
                <PermissionGroupList permissions={record.permissions} />
              </DetailSection>
            )
          }
        ]}
      />
    </DrawerShell>
  );
}

export function PeopleRolesPage() {
  const { roleRows } = usePermissionRoleState();
  const [activeRole, setActiveRole] = useState<RolePermissionRow>();

  function closeRoleDrawer() {
    setActiveRole(undefined);
  }

  const columns: TableColumnsType<RolePermissionRow> = [
    {
      title: '业务角色',
      key: 'role',
      width: 190,
      render: (_, record) => <BusinessRoleCell record={record} />
    },
    {
      title: '默认权限',
      dataIndex: 'permissions',
      width: 360,
      render: (permissions: string[]) => <PermissionPreviewTags permissions={permissions} />
    },
    {
      title: '绑定岗位',
      dataIndex: 'positions',
      width: 260,
      render: (positions: string[]) => <PositionTags positions={positions} />
    }
  ];

  return (
    <ManagementPageScaffold layout="table-workbench">
      <ManagementTable<RolePermissionRow>
        columns={columns}
        count={{ value: roleRows.length, unit: '个业务角色' }}
        dataSource={roleRows}
        rowTestIdPrefix="people-role-table-row"
        rowKey="id"
        tableTestId="people-role-table"
        onRowClick={setActiveRole}
      />

      <BusinessRoleDrawer
        record={activeRole}
        open={Boolean(activeRole)}
        onClose={closeRoleDrawer}
      />
    </ManagementPageScaffold>
  );
}

import {
  AuditOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  TeamOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useState } from 'react';
import { AuditTrailSection } from '../../components/AuditTrailSection';
import type { AuditTrailRecord } from '../../components/AuditTrailTable';
import { BindingSummaryGrid } from '../../components/BindingSummaryGrid';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DrawerProfileCard } from '../../components/DrawerProfileCard';
import { DrawerShell } from '../../components/DrawerShell';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { TagChip, TagChipList } from '../../components/TagChip';
import { CellText, CompactCell } from '../../components/TableCell';
import { PermissionGroupList, PermissionPreviewTags } from './PermissionDisplay';
import { type RolePermissionRow, type RoleStatus, usePermissionRoleState } from './PermissionRoleState';
import { getAccessRoleTone } from './rolePermissionModel';

const roleStatusTone = {
  启用: 'green',
  停用: 'gray'
} as const;

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

function getBusinessRoleAuditTrailRecords(record: RolePermissionRow): AuditTrailRecord[] {
  return [
    {
      time: record.updatedAt,
      actor: '系统预置',
      object: record.role,
      action: '维护默认权限包',
      summary: `默认权限 ${record.permissions.length} 项`,
      result: record.status === '启用' ? '成功' : '已作废',
      source: '业务角色',
      note: record.permissions.slice(0, 6).join(' / ')
    },
    {
      time: record.updatedAt,
      actor: '李明',
      object: record.role,
      action: '同步岗位绑定',
      summary: `绑定 ${record.positions.length} 个岗位`,
      result: '成功',
      source: '岗位管理',
      note: record.positions.length > 0 ? record.positions.join(' / ') : '当前未被岗位绑定'
    }
  ];
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
          status={record.status}
          statusToneMap={roleStatusTone}
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
            label: '业务角色信息',
            children: (
              <>
                <DetailSection icon={<SafetyCertificateOutlined />} title="业务角色">
                  <DetailInfoGrid
                    columns={2}
                    items={[
                      { label: '业务角色', value: <TagChip label={record.role} tone={getAccessRoleTone(record.role)} /> },
                      { label: '业务角色编码', value: record.code },
                      { label: '状态', value: <StatusTag toneMap={roleStatusTone} value={record.status} /> },
                      { label: '最近更新', value: record.updatedAt }
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
          },
          {
            key: 'audit',
            label: '变更记录',
            children: <AuditTrailSection icon={<AuditOutlined />} records={getBusinessRoleAuditTrailRecords(record)} title="变更记录" />
          }
        ]}
      />
    </DrawerShell>
  );
}

export function PeopleRolesPage() {
  const { permissionByRole, roleRows } = usePermissionRoleState();
  const [activeRole, setActiveRole] = useState<RolePermissionRow>();
  const rolePermissionCount = new Set(Object.values(permissionByRole).flat()).size;
  const boundPositionCount = new Set(roleRows.flatMap((row) => row.positions)).size;
  const enabledRoleCount = roleRows.filter((row) => row.status === '启用').length;

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
    },
    {
      title: '状态',
      dataIndex: 'status',
      align: 'center',
      width: 86,
      render: (status: RoleStatus) => <StatusTag toneMap={roleStatusTone} value={status} />
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      align: 'center',
      width: 104
    }
  ];

  return (
    <ManagementPageScaffold
      metrics={
        <MetricGrid columns={4}>
          <MetricCard label="业务角色" value={roleRows.length} icon={<SafetyCertificateOutlined />} />
          <MetricCard label="启用业务角色" value={enabledRoleCount} icon={<AuditOutlined />} />
          <MetricCard label="默认权限" value={rolePermissionCount} icon={<KeyOutlined />} />
          <MetricCard label="绑定岗位" value={boundPositionCount} icon={<TeamOutlined />} />
        </MetricGrid>
      }
    >
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

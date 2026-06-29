import {
  AuditOutlined,
  FileProtectOutlined,
  KeyOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { Input, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useMemo, useState } from 'react';
import { AuditTrailSection } from '../../components/AuditTrailSection';
import type { AuditTrailRecord } from '../../components/AuditTrailTable';
import { BindingSummaryGrid } from '../../components/BindingSummaryGrid';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailSection, ReadOnlyField, StatusTag } from '../../components/Detail';
import { DetailTabs } from '../../components/DetailTabs';
import { FileActionButtons } from '../../components/FileActionButtons';
import {
  DrawerFormField,
  DrawerFormGrid,
  DrawerFormShell,
  type DrawerFormState,
  useDrawerFormState
} from '../../components/DrawerForm';
import { FilePreviewModal } from '../../components/FilePreviewModal';
import { DrawerProfileCard } from '../../components/DrawerProfileCard';
import { FileSlot, FileSlotGrid } from '../../components/FileSlot';
import { FileUploadDropzone } from '../../components/FileUploadDropzone';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { TagChip, TagChipList } from '../../components/TagChip';
import { CellText } from '../../components/TableCell';
import { PermissionAddSelect, PermissionGroupList, PermissionPreviewTags } from './PermissionDisplay';
import { positionRequiredFileSlots, type PositionRequiredFileSlot } from './peopleFileSlotModel';
import {
  peopleOrganizationToday,
  type PositionManagementFile,
  type PositionManagementFileStatus,
  type PositionManagementRow,
  type PositionManagementStatus,
  usePeopleOrganizationState
} from './PeopleOrganizationState';
import { usePermissionRoleState, type RolePermissionRow, type RoleStatus } from './PermissionRoleState';
import {
  getBusinessRolePermissions,
  getAccessRoleTone,
  getPositionEffectivePermissions,
  type AccessRole
} from './rolePermissionModel';

type RoleStatusByRole = Record<AccessRole, RoleStatus>;

type PositionFormValue = {
  code: string;
  files: PositionManagementFile[];
  id: string;
  memberCount: number;
  positionName: string;
  positionStatus: PositionManagementStatus;
  extraPermissions: string[];
  selectedRoles: AccessRole[];
  uploadFiles: UploadFile[];
};

type PositionFormValidationResult =
  | {
      ok: true;
      positionName: string;
    }
  | {
      message: string;
      ok: false;
    };

const prototypeToday = peopleOrganizationToday;

const positionStatusTone = {
  启用: 'green',
  停用: 'gray'
} as const;

const positionFileStatusTone = {
  生效中: 'green'
} as const;

function getNextPositionSequence(rows: PositionManagementRow[]) {
  return (
    rows.reduce((maxSequence, row) => {
      const sequence = Number.parseInt(row.code.replace(/^POS-\d{4}-/, ''), 10);
      return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
    }, 0) + 1
  );
}

function createDraftPositionRow(rows: PositionManagementRow[]): PositionManagementRow {
  const sequence = getNextPositionSequence(rows);
  const paddedSequence = String(sequence).padStart(3, '0');

  return {
    code: `POS-2026-${paddedSequence}`,
    files: [],
    id: `position-new-${paddedSequence}`,
    memberCount: 0,
    position: '新岗位',
    extraPermissions: [],
    roleBindings: [],
    status: '启用',
    updatedAt: prototypeToday
  };
}

function buildPositionForm(record: PositionManagementRow): PositionFormValue {
  return {
    code: record.code,
    files: [...record.files],
    id: record.id,
    memberCount: record.memberCount,
    positionName: record.position,
    positionStatus: record.status,
    extraPermissions: [...record.extraPermissions],
    selectedRoles: [...record.roleBindings],
    uploadFiles: []
  };
}

function createPositionForm(rows: PositionManagementRow[]) {
  return buildPositionForm(createDraftPositionRow(rows));
}

function validatePositionForm(form: PositionFormValue): PositionFormValidationResult {
  const positionName = form.positionName.trim();

  if (!positionName) {
    return { message: '请输入岗位名称', ok: false };
  }

  return { ok: true, positionName };
}

function buildPositionRecord(
  form: PositionFormValue,
  record?: PositionManagementRow,
  normalizedPositionName = form.positionName.trim() || '新岗位'
): PositionManagementRow {
  return {
    code: record?.code ?? form.code,
    files: form.files,
    id: record?.id ?? form.id,
    memberCount: record?.memberCount ?? form.memberCount,
    position: normalizedPositionName,
    extraPermissions: form.extraPermissions,
    roleBindings: form.selectedRoles,
    status: form.positionStatus,
    updatedAt: prototypeToday
  };
}

function isPositionFileMatchedToSlot(file: Pick<PositionManagementFile, 'category' | 'name'>, slot: PositionRequiredFileSlot) {
  return file.category === slot.category || file.name.includes(slot.label);
}

function getPositionSlotFile<T extends Pick<PositionManagementFile, 'category' | 'name' | 'status'>>(files: T[], slot: PositionRequiredFileSlot) {
  return files.find((file) => isPositionFileMatchedToSlot(file, slot));
}

function getSupplementalPositionFiles(files: PositionManagementFile[]) {
  return files.filter((file) => !positionRequiredFileSlots.some((slot) => isPositionFileMatchedToSlot(file, slot)));
}

function getPositionRequiredFileCompleteness(files: PositionManagementFile[]) {
  const uploadedCount = positionRequiredFileSlots.filter((slot) => getPositionSlotFile(files, slot)).length;
  return {
    label: uploadedCount === positionRequiredFileSlots.length ? '已齐全' : '待补齐',
    total: positionRequiredFileSlots.length,
    uploaded: uploadedCount
  };
}

function getUploadFileSize(file: UploadFile) {
  return file.size ?? file.originFileObj?.size ?? 0;
}

function PositionCell({ record }: { record: PositionManagementRow }) {
  return <CellText>{record.position}</CellText>;
}

function getPositionAuditTrailRecords(
  record: PositionManagementRow,
  roles: AccessRole[],
  extraPermissions: string[],
  files: PositionManagementFile[],
  status: PositionManagementStatus
): AuditTrailRecord[] {
  const requiredFileLabels = positionRequiredFileSlots.map((slot) => slot.label);

  return [
    {
      time: record.updatedAt,
      actor: '李明',
      object: record.position,
      action: '维护岗位业务角色',
      summary: roles.length > 0 ? `绑定业务角色：${roles.join('、')}` : '未绑定业务角色',
      result: status === '启用' ? '成功' : '已作废',
      source: '岗位管理',
      note: roles.length > 0 ? roles.join(' / ') : '未绑定业务角色'
    },
    {
      time: record.updatedAt,
      actor: '李明',
      object: record.position,
      action: '维护岗位追加权限',
      summary: `追加权限 ${extraPermissions.length} 项`,
      result: status === '启用' ? '成功' : '已作废',
      source: '岗位管理',
      note: extraPermissions.length > 0 ? extraPermissions.join(' / ') : '无追加权限'
    },
    {
      time: record.updatedAt,
      actor: files[0]?.updatedBy ?? '周倩',
      object: record.position,
      action: '维护岗位文件',
      summary: `岗位文件 ${files.length} 份，必备文件为 ${requiredFileLabels.join('、')}`,
      result: '成功',
      source: '岗位管理',
      note: files.length > 0 ? files.map((file) => file.category).join(' / ') : '暂无岗位文件'
    }
  ];
}

function getPositionRoleLabel(role: AccessRole, roleStatusByRole: RoleStatusByRole) {
  return roleStatusByRole[role] === '停用' ? `${role} / 停用` : role;
}

function PositionRoleTags({
  roleStatusByRole = {},
  variant = 'wrap',
  roles
}: {
  roleStatusByRole?: RoleStatusByRole;
  variant?: 'summary' | 'wrap';
  roles: AccessRole[];
}) {
  const summary = variant === 'summary';

  return (
    <TagChipList
      emptyText="未绑定业务角色"
      items={roles}
      maxVisible={summary ? 2 : roles.length}
      getLabel={(role) => getPositionRoleLabel(role, roleStatusByRole)}
      getTooltipLabel={(role) => getPositionRoleLabel(role, roleStatusByRole)}
      tone={(role) => (roleStatusByRole[role] === '停用' ? 'gray' : getAccessRoleTone(role))}
      getKey={(role) => role}
      overflowTone="gray"
      overflowVariant={summary ? 'compact-overflow' : 'default'}
      tooltipSeparator=" / "
      variant={summary ? 'compact' : 'default'}
      wrap={!summary}
    />
  );
}

function PositionManagementDrawer({
  drawer,
  permissionByRole,
  roleRows,
  onSave
}: {
  drawer: DrawerFormState<PositionManagementRow, PositionFormValue>;
  permissionByRole: Record<AccessRole, string[]>;
  roleRows: RolePermissionRow[];
  onSave: (record: PositionManagementRow) => void;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const [previewFile, setPreviewFile] = useState<PositionManagementFile>();
  const { form, record } = drawer;
  const roleStatusByRole = useMemo(
    () =>
      roleRows.reduce((currentMap, row) => {
        currentMap[row.role] = row.status;
        return currentMap;
      }, {} as RoleStatusByRole),
    [roleRows]
  );

  if (!drawer.mode) {
    return null;
  }

  const previewRecord = buildPositionRecord(form, record);
  const supplementalPositionFiles = getSupplementalPositionFiles(form.files);
  const inheritedPermissions = getBusinessRolePermissions(form.selectedRoles, permissionByRole);
  const effectivePermissions = getPositionEffectivePermissions({
    extraPermissions: form.extraPermissions,
    permissionByRole,
    roles: form.selectedRoles
  });
  const positionAuditTrailRecords = getPositionAuditTrailRecords(previewRecord, form.selectedRoles, form.extraPermissions, form.files, form.positionStatus);

  function handlePositionRequiredFileUpload(slot: PositionRequiredFileSlot, file: UploadFile) {
    if (!file.name) {
      return;
    }

    const fileSize = getUploadFileSize(file);

    if (fileSize > slot.maxSizeMb * 1024 * 1024) {
      void messageApi.error(`${slot.label} 文件不能超过 ${slot.maxSizeMb}MB`);
      return;
    }

    drawer.setForm((currentForm) => {
      const existingFile = getPositionSlotFile(currentForm.files, slot);
      const nextFile: PositionManagementFile = {
        category: slot.category,
        id: existingFile?.id ?? `POSFILE-${currentForm.code}-${slot.key}-${file.uid || prototypeToday}`,
        name: file.name.includes(slot.label) ? file.name : `${slot.label} - ${file.name}`,
        status: '生效中',
        updatedAt: prototypeToday,
        updatedBy: '李明'
      };

      return {
        ...currentForm,
        files: [nextFile, ...currentForm.files.filter((currentFile) => currentFile.id !== existingFile?.id)]
      };
    });
    void messageApi.success(`${slot.label} 已上传`);
  }

  function handlePositionRequiredFileDelete(slot: PositionRequiredFileSlot) {
    const existingFile = getPositionSlotFile(form.files, slot);

    if (!existingFile) {
      return;
    }

    drawer.setForm((currentForm) => ({
      ...currentForm,
      files: currentForm.files.filter((file) => file.id !== existingFile.id)
    }));
    void messageApi.success(`${slot.label} 已删除`);
  }

  function handlePositionSupplementalUploadChange(fileList: UploadFile[]) {
    const uploadedFiles: PositionManagementFile[] = fileList.map((file, index) => ({
      category: '补充资料',
      id: `POSFILE-${form.code}-SUP-${file.uid || String(index + 1).padStart(3, '0')}`,
      name: file.name,
      status: '生效中',
      updatedAt: prototypeToday,
      updatedBy: '李明'
    }));
    const uploadedFileNames = new Set(uploadedFiles.map((file) => file.name));

    drawer.setForm((currentForm) => ({
      ...currentForm,
      files: [
        ...uploadedFiles,
        ...currentForm.files.filter((file) => !file.id.includes('-SUP-') && !uploadedFileNames.has(file.name))
      ],
      uploadFiles: fileList
    }));
  }

  function addExtraPermission(permission: string) {
    if (form.extraPermissions.includes(permission) || inheritedPermissions.includes(permission)) {
      void messageApi.warning('该权限已存在');
      return;
    }

    drawer.updateForm('extraPermissions', [...form.extraPermissions, permission]);
  }

  function removeExtraPermission(permission: string) {
    drawer.updateForm(
      'extraPermissions',
      form.extraPermissions.filter((item) => item !== permission)
    );
  }

  const positionFileColumns: TableColumnsType<PositionManagementFile> = [
    {
      title: '文件名称',
      dataIndex: 'name',
      width: 190,
      render: (name: string) => <CellText>{name}</CellText>
    },
    {
      title: '类型',
      dataIndex: 'category',
      align: 'center',
      width: 92
    },
    {
      title: '状态',
      dataIndex: 'status',
      align: 'center',
      width: 92,
      render: (status: PositionManagementFileStatus) => <StatusTag toneMap={positionFileStatusTone} value={status} />
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      align: 'center',
      width: 108
    },
    {
      title: '操作',
      key: 'actions',
      align: 'center',
      width: 160,
      render: (_, file) => (
        <FileActionButtons
          record={file}
          onDelete={(record) => {
            void messageApi.success(`${record.name} 删除请求已记录`);
          }}
          onPreview={setPreviewFile}
        />
      )
    }
  ];

  function handleDrawerClose() {
    setPreviewFile(undefined);
    drawer.cancel();
  }

  function handleSavePosition() {
    const validation = validatePositionForm(form);

    if (!validation.ok) {
      void messageApi.warning(validation.message);
      return;
    }

    onSave(buildPositionRecord(form, record, validation.positionName));
    void messageApi.success(drawer.isCreateMode ? '岗位已新增' : '岗位配置已暂存');
    handleDrawerClose();
  }

  return (
    <>
      {contextHolder}
      <DrawerFormShell
        cancelAction={{ label: '取消', onClick: handleDrawerClose }}
        layout="detail"
        open={drawer.open}
        primaryAction={{ label: drawer.isCreateMode ? '创建岗位' : '保存调整', onClick: handleSavePosition }}
        title={
          <DetailDrawerTitle
            status={form.positionStatus}
            statusToneMap={positionStatusTone}
            subtitle="人员组织 / 岗位管理"
            title={drawer.isCreateMode ? '新增岗位' : '编辑岗位配置'}
          />
        }
        width={720}
        onClose={handleDrawerClose}
      >
        <DrawerProfileCard
          avatar={(form.positionName.trim() || '岗').slice(0, 1)}
          subtitle={form.code}
          tags={[
            <StatusTag key="status" toneMap={positionStatusTone} value={form.positionStatus} />,
            <TagChip key="members" label={`${form.memberCount} 人`} />,
            <TagChip key="permissions" label={`${effectivePermissions.length} 项有效权限`} />
          ]}
          title={form.positionName.trim() || '新岗位'}
        />

        <DetailTabs
          defaultActiveKey="position"
          tabTestIdPrefix="people-position-detail-tab"
          testId="people-position-detail-tabs"
          items={[
            {
              key: 'position',
              label: '岗位信息',
              children: (
                <DetailSection icon={<SolutionOutlined />} title="岗位">
                  <DrawerFormGrid>
                    <DrawerFormField label="岗位名称" required>
                      <Input value={form.positionName} onChange={(event) => drawer.updateForm('positionName', event.target.value)} />
                    </DrawerFormField>
                    <ReadOnlyField label="岗位编码" value={form.code} />
                    <DrawerFormField label="岗位状态" required>
                      <Select
                        options={(['启用', '停用'] satisfies PositionManagementStatus[]).map((status) => ({
                          label: status,
                          value: status
                        }))}
                        value={form.positionStatus}
                        onChange={(positionStatus) => drawer.updateForm('positionStatus', positionStatus)}
                      />
                    </DrawerFormField>
                    <ReadOnlyField label="关联人员" value={`${form.memberCount} 人`} />
                  </DrawerFormGrid>
                </DetailSection>
              )
            },
            {
              key: 'roles',
              label: '业务角色',
              children: (
                <DetailSection icon={<SafetyCertificateOutlined />} title="业务角色">
                  <DrawerFormGrid>
                    <DrawerFormField wide label="业务角色">
                      <Select
                        mode="multiple"
                        options={roleRows.map((roleRow) => ({
                          label: roleRow.status === '停用' ? `${roleRow.role}（停用）` : roleRow.role,
                          value: roleRow.role
                        }))}
                        value={form.selectedRoles}
                        onChange={(nextRoles) => drawer.updateForm('selectedRoles', nextRoles)}
                      />
                    </DrawerFormField>
                  </DrawerFormGrid>
                  <BindingSummaryGrid
                    emptyText="未绑定业务角色"
                    items={form.selectedRoles.map((role) => ({
                      extra: `${permissionByRole[role]?.length ?? 0} 项默认权限`,
                      key: role,
                      label: <TagChip label={role} tone={roleStatusByRole[role] === '停用' ? 'gray' : getAccessRoleTone(role)} />
                    }))}
                  />
                </DetailSection>
              )
            },
            {
              key: 'extra-permissions',
              label: '追加权限',
              children: (
                <DetailSection icon={<KeyOutlined />} title="岗位追加权限">
                  <PermissionAddSelect
                    excludedPermissions={inheritedPermissions}
                    placeholder="+ 添加追加权限"
                    selectedPermissions={form.extraPermissions}
                    onAdd={addExtraPermission}
                  />
                  <PermissionGroupList
                    emptyText="暂无岗位追加权限"
                    permissions={form.extraPermissions}
                    onRemove={removeExtraPermission}
                  />
                </DetailSection>
              )
            },
            {
              key: 'effective-permissions',
              label: '有效权限',
              children: (
                <DetailSection icon={<KeyOutlined />} title="有效权限">
                  <PermissionGroupList
                    emptyText="暂无有效权限"
                    permissions={effectivePermissions}
                  />
                </DetailSection>
              )
            },
            {
              key: 'files',
              label: '岗位文件',
              children: (
                <DetailSection icon={<FileProtectOutlined />} title="岗位相关文件">
                  <FileSlotGrid>
                    {positionRequiredFileSlots.map((slot) => {
                      const file = getPositionSlotFile(form.files, slot);

                      return (
                        <FileSlot
                          accept={slot.accept}
                          description={slot.description}
                          file={file}
                          key={slot.key}
                          status={file?.status ?? '未上传'}
                          statusTone={file ? positionFileStatusTone[file.status] : 'amber'}
                          title={slot.label}
                          onPreview={setPreviewFile}
                          onRemove={() => handlePositionRequiredFileDelete(slot)}
                          onSelect={(uploadFile) => handlePositionRequiredFileUpload(slot, uploadFile)}
                        />
                      );
                    })}
                  </FileSlotGrid>

                  <FileUploadDropzone
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    description="任职说明、评估模板、岗位补充说明等资料可按需上传，不影响保存。"
                    fileList={form.uploadFiles}
                    multiple
                    title="补充资料"
                    uploadText="上传补充资料"
                    onChange={handlePositionSupplementalUploadChange}
                  />
                  {supplementalPositionFiles.length > 0 ? (
                    <CompactDetailTable<PositionManagementFile>
                      className="archive-maintenance-table"
                      columns={positionFileColumns}
                      dataSource={supplementalPositionFiles}
                      rowKey="id"
                      scrollX={642}
                    />
                  ) : null}
                </DetailSection>
              )
            },
            {
              key: 'audit',
              label: '变更记录',
              children: <AuditTrailSection icon={<AuditOutlined />} records={positionAuditTrailRecords} title="变更记录" />
            }
          ]}
        />
      </DrawerFormShell>
      <FilePreviewModal
        file={previewFile}
        icon={<FileProtectOutlined />}
        statusToneMap={positionFileStatusTone}
        title="岗位文件预览"
        onClose={() => setPreviewFile(undefined)}
      />
    </>
  );
}

export function PeoplePositionManagementPage() {
  const { positionRows, savePosition: savePositionRecord } = usePeopleOrganizationState();
  const { permissionByRole, roleRows, syncRolePositions } = usePermissionRoleState();
  const enabledCount = positionRows.filter((row) => row.status === '启用').length;
  const memberCount = positionRows.reduce((total, row) => total + row.memberCount, 0);
  const incompleteFileCount = positionRows.filter((row) => {
    const completeness = getPositionRequiredFileCompleteness(row.files);
    return completeness.uploaded < completeness.total;
  }).length;
  const roleStatusByRole = useMemo(
    () =>
      roleRows.reduce((currentMap, row) => {
        currentMap[row.role] = row.status;
        return currentMap;
      }, {} as RoleStatusByRole),
    [roleRows]
  );
  const positionDrawer = useDrawerFormState<PositionManagementRow, PositionFormValue>({
    createForm: () => createPositionForm(positionRows),
    editForm: buildPositionForm
  });

  function savePosition(nextRecord: PositionManagementRow) {
    const nextRows = savePositionRecord(nextRecord);
    syncRolePositions(nextRows);
  }

  const columns: TableColumnsType<PositionManagementRow> = [
    {
      title: '岗位编号',
      dataIndex: 'code',
      align: 'center',
      width: 118
    },
    {
      title: '岗位',
      key: 'position',
      width: 140,
      render: (_, record) => <PositionCell record={record} />
    },
    {
      title: '业务角色',
      dataIndex: 'roleBindings',
      width: 280,
      render: (roles: AccessRole[]) => <PositionRoleTags roleStatusByRole={roleStatusByRole} roles={roles} />
    },
    {
      title: '追加权限',
      dataIndex: 'extraPermissions',
      width: 180,
      render: (extraPermissions: string[]) => <PermissionPreviewTags emptyText="无追加权限" maxVisible={2} permissions={extraPermissions} />
    },
    {
      title: '岗位文件',
      key: 'files',
      align: 'center',
      width: 120,
      render: (_, record) => {
        const completeness = getPositionRequiredFileCompleteness(record.files);

        return (
          <div className="position-file-status-cell">
            <StatusTag tone={completeness.uploaded === completeness.total ? 'green' : 'amber'} value={completeness.label} />
            <span>
              {completeness.uploaded}/{completeness.total}
            </span>
          </div>
        );
      }
    },
    {
      title: '关联人员',
      dataIndex: 'memberCount',
      align: 'center',
      width: 96,
      render: (memberCount: number) => `${memberCount} 人`
    },
    {
      title: '状态',
      dataIndex: 'status',
      align: 'center',
      width: 86,
      render: (status: PositionManagementStatus) => <StatusTag toneMap={positionStatusTone} value={status} />
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
      layout="table-workbench"
      metrics={
        <MetricGrid columns={4}>
          <MetricCard label="岗位数" value={positionRows.length} icon={<SolutionOutlined />} />
          <MetricCard label="启用岗位" value={enabledCount} icon={<SafetyCertificateOutlined />} />
          <MetricCard label="关联人员" value={memberCount} icon={<TeamOutlined />} />
          <MetricCard label="待补文件" value={incompleteFileCount} icon={<FileProtectOutlined />} />
        </MetricGrid>
      }
    >
      <ManagementTable<PositionManagementRow>
        columns={columns}
        count={{ value: positionRows.length, unit: '个岗位' }}
        dataSource={positionRows}
        primaryAction={{ icon: <PlusOutlined />, label: '新增岗位', onClick: positionDrawer.openCreate }}
        rowTestIdPrefix="people-position-table-row"
        rowKey="id"
        tableTestId="people-position-table"
        onRowClick={positionDrawer.openEdit}
      />
      <PositionManagementDrawer
        drawer={positionDrawer}
        permissionByRole={permissionByRole}
        roleRows={roleRows}
        onSave={savePosition}
      />
    </ManagementPageScaffold>
  );
}

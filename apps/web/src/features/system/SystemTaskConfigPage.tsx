import {
  CheckCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
  ProfileOutlined,
  StopOutlined
} from '@ant-design/icons';
import { Input, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DrawerFormShell, type ModeDrawerState, useModeDrawerState } from '../../components/DrawerForm';
import { DrawerProfileCard } from '../../components/DrawerProfileCard';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { TagChipList } from '../../components/TagChip';
import { CompactCell } from '../../components/TableCell';
import { useTaskManagementState } from '../tasks/TaskManagementState';
import {
  taskConfigCategories,
  type TaskConfigFormValue,
  type TaskConfigRow,
  type TaskConfigStatus,
  useTaskConfigState
} from './TaskConfigState';

const taskConfigStatusTone = {
  启用: 'green',
  停用: 'gray'
} as const;

const taskConfigCategoryTone = {
  设计交付: 'blue',
  图像处理: 'amber',
  下单支持: 'green'
} as const;

const defaultTaskConfigForm: TaskConfigFormValue = {
  category: '设计交付',
  deliveryHints: ['建议提供任务交付文件'],
  name: '',
  note: ''
};

function TaskConfigCell({ record }: { record: TaskConfigRow }) {
  return <CompactCell primary={record.name} secondary={record.code} />;
}

function buildTaskConfigForm(record?: TaskConfigRow): TaskConfigFormValue {
  if (!record) {
    return {
      ...defaultTaskConfigForm,
      deliveryHints: [...defaultTaskConfigForm.deliveryHints]
    };
  }

  return {
    category: record.category,
    deliveryHints: [...record.deliveryHints],
    name: record.name,
    note: record.note
  };
}

function normalizeTaskConfigForm(formValue: TaskConfigFormValue): TaskConfigFormValue {
  return {
    ...formValue,
    deliveryHints: formValue.deliveryHints.map((item) => item.trim()).filter(Boolean),
    name: formValue.name.trim(),
    note: formValue.note.trim()
  };
}

function TaskConfigDrawer({
  drawer,
  existingRows,
  record,
  onCreate,
  onSave,
  onToggleStatus
}: {
  drawer: ModeDrawerState<string, TaskConfigFormValue>;
  existingRows: TaskConfigRow[];
  record?: TaskConfigRow;
  onCreate: (nextValue: TaskConfigFormValue) => void;
  onSave: (id: string, nextValue: TaskConfigFormValue) => void;
  onToggleStatus: (record: TaskConfigRow) => void;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const mode = drawer.mode ?? 'detail';
  const isCreateMode = mode === 'create';
  const isDetailMode = mode === 'detail';
  const isEditMode = mode === 'edit';
  const formValue = isDetailMode && record ? buildTaskConfigForm(record) : drawer.form;
  const status = record?.status ?? '启用';
  const code = record?.code ?? '保存后生成';
  const normalizedName = formValue.name.trim();
  const saveDisabled = !normalizedName || formValue.deliveryHints.map((item) => item.trim()).filter(Boolean).length === 0;

  function updateFormValue<T extends keyof TaskConfigFormValue>(key: T, value: TaskConfigFormValue[T]) {
    drawer.updateForm(key, value);
  }

  function handleSave() {
    const nextValue = normalizeTaskConfigForm(formValue);

    if (!nextValue.name) {
      void messageApi.warning('请输入任务类型名称');
      return;
    }

    if (nextValue.deliveryHints.length === 0) {
      void messageApi.warning('请至少维护一项交付提示');
      return;
    }

    if (existingRows.some((row) => row.id !== record?.id && row.name === nextValue.name)) {
      void messageApi.warning('任务类型名称已存在');
      return;
    }

    if (isCreateMode) {
      onCreate(nextValue);
      void messageApi.success('任务类型已新增');
      return;
    }

    if (!record) {
      return;
    }

    onSave(record.id, nextValue);
    void messageApi.success('任务类型已保存');
  }

  function getTitle() {
    if (isCreateMode) {
      return '新增任务类型';
    }

    if (isEditMode) {
      return '编辑任务类型';
    }

    return '任务类型详情';
  }

  return (
    <>
      {contextHolder}
      <DrawerFormShell
        className="task-config-drawer"
        detailActions={
          isDetailMode && record
            ? {
                closeAction: { label: '关闭', onClick: drawer.close },
                primaryAction: { label: '编辑', onClick: () => drawer.openEdit() },
                secondaryAction: {
                  danger: record.status === '启用',
                  label: record.status === '启用' ? '停用' : '启用',
                  onClick: () => onToggleStatus(record)
                }
              }
            : undefined
        }
        formActions={
          !isDetailMode
            ? {
                cancelAction: { label: '取消', onClick: drawer.cancel },
                primaryAction: {
                  disabled: saveDisabled,
                  label: isCreateMode ? '创建任务类型' : '保存配置',
                  onClick: handleSave
                }
              }
            : undefined
        }
        mode={mode}
        open={drawer.open}
        title={<DetailDrawerTitle status={status} statusToneMap={taskConfigStatusTone} subtitle="系统管理 / 任务配置" title={getTitle()} />}
        width={760}
        onClose={isDetailMode ? drawer.close : drawer.cancel}
      >
        <DrawerProfileCard
          avatar={(formValue.name.trim() || '任').slice(0, 1)}
          subtitle={code}
          tags={[<StatusTag key="category" toneMap={taskConfigCategoryTone} value={formValue.category} />]}
          title={formValue.name.trim() || '新任务类型'}
        />

        <DetailSection icon={<ProfileOutlined />} title="基础配置">
          <DetailInfoGrid
            columns={2}
            items={[
              {
                label: '任务类型名称 *',
                value: isDetailMode ? (
                  formValue.name
                ) : (
                  <Input
                    placeholder="例如：门店P图"
                    value={formValue.name}
                    onChange={(event) => updateFormValue('name', event.target.value)}
                  />
                )
              },
              { label: '任务类型编码', value: code },
              {
                label: '任务分类',
                value: isDetailMode ? (
                  <StatusTag toneMap={taskConfigCategoryTone} value={formValue.category} />
                ) : (
                  <Select
                    options={taskConfigCategories.map((category) => ({ label: category, value: category }))}
                    value={formValue.category}
                    onChange={(value) => updateFormValue('category', value)}
                  />
                )
              },
              { label: '状态', value: <StatusTag toneMap={taskConfigStatusTone} value={status} /> },
              { label: '最近更新', value: record?.updatedAt ?? '保存后生成' }
            ]}
          />
        </DetailSection>

        <DetailSection icon={<FileTextOutlined />} title="交付提示">
          <DetailInfoGrid
            columns={1}
            items={[
              {
                label: '提示内容 *',
                value: isDetailMode ? (
                  <TagChipList items={formValue.deliveryHints} maxVisible={8} wrap />
                ) : (
                  <Select
                    mode="tags"
                    placeholder="输入后回车添加"
                    value={formValue.deliveryHints}
                    onChange={(value) => updateFormValue('deliveryHints', value)}
                  />
                )
              }
            ]}
          />
        </DetailSection>

        <DetailSection icon={<FileTextOutlined />} title="说明">
          {isDetailMode ? (
            <div className="task-config-note-text">{formValue.note || '暂无说明'}</div>
          ) : (
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 5 }}
              placeholder="记录该任务类型的适用边界、后续品牌配置注意事项"
              value={formValue.note}
              onChange={(event) => updateFormValue('note', event.target.value)}
            />
          )}
        </DetailSection>
      </DrawerFormShell>
    </>
  );
}

export function SystemTaskConfigPage() {
  const { createTaskConfig, taskConfigRows, updateTaskConfig, updateTaskConfigStatus } = useTaskConfigState();
  const { storeTaskRows } = useTaskManagementState();
  const [messageApi, contextHolder] = message.useMessage();
  const [statusFilter, setStatusFilter] = useState<'全部' | TaskConfigStatus>('全部');
  const [categoryFilter, setCategoryFilter] = useState<'全部' | TaskConfigRow['category']>('全部');
  const [keyword, setKeyword] = useState('');
  const taskConfigDrawer = useModeDrawerState<string, TaskConfigFormValue>({
    createForm: () => buildTaskConfigForm(),
    detailForm: (id) => buildTaskConfigForm(taskConfigRows.find((row) => row.id === id))
  });
  const activeTaskConfig = taskConfigDrawer.record
    ? taskConfigRows.find((row) => row.id === taskConfigDrawer.record)
    : undefined;

  const enabledCount = taskConfigRows.filter((row) => row.status === '启用').length;
  const disabledCount = taskConfigRows.length - enabledCount;
  const deliveryHintCount = new Set(taskConfigRows.flatMap((row) => row.deliveryHints)).size;

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return taskConfigRows.filter((row) => {
      const matchesStatus = statusFilter === '全部' || row.status === statusFilter;
      const matchesCategory = categoryFilter === '全部' || row.category === categoryFilter;
      const matchesKeyword =
        !normalizedKeyword ||
        [row.name, row.code, row.category, row.note, ...row.deliveryHints]
          .join(' ')
          .toLowerCase()
          .includes(normalizedKeyword);

      return matchesStatus && matchesCategory && matchesKeyword;
    });
  }, [categoryFilter, keyword, statusFilter, taskConfigRows]);

  function openCreateDrawer() {
    taskConfigDrawer.openCreate();
  }

  function openDetailDrawer(record: TaskConfigRow) {
    taskConfigDrawer.openDetail(record.id);
  }

  function saveNewTaskConfig(nextValue: TaskConfigFormValue) {
    createTaskConfig(nextValue);
    taskConfigDrawer.close();
  }

  function saveTaskConfig(id: string, nextValue: TaskConfigFormValue) {
    updateTaskConfig(id, nextValue);
    taskConfigDrawer.openDetail(id);
  }

  function toggleTaskConfigStatus(record: TaskConfigRow) {
    const nextStatus: TaskConfigStatus = record.status === '启用' ? '停用' : '启用';
    const activeTaskCount = storeTaskRows.filter(
      (task) => task.taskConfigId === record.id && !['已完成', '已中止'].includes(task.status)
    ).length;
    const result = updateTaskConfigStatus(record.id, nextStatus, activeTaskCount);
    if (!result.success) {
      void messageApi.warning(result.message);
      return;
    }
    void messageApi.success(`${record.name}已${nextStatus}`);
  }

  const columns: TableColumnsType<TaskConfigRow> = [
    {
      title: '任务类型',
      key: 'task',
      width: 200,
      render: (_, record) => <TaskConfigCell record={record} />
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 120,
      render: (category: TaskConfigRow['category']) => <StatusTag toneMap={taskConfigCategoryTone} value={category} />
    },
    {
      title: '交付提示',
      dataIndex: 'deliveryHints',
      width: 300,
      render: (items: string[]) => <TagChipList items={items} maxVisible={2} />
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 86,
      render: (status: TaskConfigStatus) => <StatusTag toneMap={taskConfigStatusTone} value={status} />
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      width: 110
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={4}>
          <MetricCard label="任务类型" value={taskConfigRows.length} icon={<ProfileOutlined />} />
          <MetricCard label="启用类型" value={enabledCount} icon={<CheckCircleOutlined />} />
          <MetricCard label="停用类型" value={disabledCount} icon={<StopOutlined />} />
          <MetricCard label="交付提示" value={deliveryHintCount} icon={<FileTextOutlined />} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField as="div" label="状态">
              <Select
                options={['全部', '启用', '停用'].map((status) => ({ label: status, value: status }))}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </FilterField>
            <FilterField as="div" label="分类">
              <Select
                options={['全部', ...taskConfigCategories].map((category) => ({ label: category, value: category }))}
                value={categoryFilter}
                onChange={setCategoryFilter}
              />
            </FilterField>
            <KeywordFilter
              as="div"
              placeholder="名称 / 编码 / 文件要求"
              value={keyword}
              width="wide"
              onChange={setKeyword}
            />
          </FilterBar>
        </FilterPanel>
      }
    >

      <ManagementTable<TaskConfigRow>
        columns={columns}
        count={{ value: filteredRows.length, unit: '个任务类型' }}
        dataSource={filteredRows}
        primaryAction={{ icon: <PlusOutlined />, label: '新增任务类型', onClick: openCreateDrawer }}
        rowTestIdPrefix="system-task-config-table-row"
        rowKey="id"
        tableTestId="system-task-config-table"
        onRowClick={openDetailDrawer}
      />

      <TaskConfigDrawer
        drawer={taskConfigDrawer}
        existingRows={taskConfigRows}
        record={activeTaskConfig}
        onCreate={saveNewTaskConfig}
        onSave={saveTaskConfig}
        onToggleStatus={toggleTaskConfigStatus}
      />
    </ManagementPageScaffold>
  );
}

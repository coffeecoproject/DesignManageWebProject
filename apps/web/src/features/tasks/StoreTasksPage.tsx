import {
  CheckCircleOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  ReloadOutlined,
  StopOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Input, Modal, Select, message } from 'antd';
import { useMemo, useState } from 'react';
import { DateScopeFilter, getDateScopeMonthRange, getDateScopeRange } from '../../components/DateFilterFields';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { useCustomerManagementState } from '../customers/CustomerManagementState';
import { useAuthorizationState } from '../auth/AuthorizationState';
import { canAccessTask } from '../auth/authorizationModel';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { usePerformanceResults } from '../performance/usePerformanceResults';
import { useTaskConfigState } from '../system/TaskConfigState';
import { useWorkCalendarState } from '../system/WorkCalendarState';
import { TaskCreateDrawer } from './TaskCreateDrawer';
import { TaskDetailDrawer } from './TaskDetailDrawer';
import { TaskListTable } from './TaskListTable';
import {
  buildTerminatedTaskRecord,
  defaultTaskFilters,
  getFilteredStoreTasks,
  getTaskListMetrics,
  taskMaterialTypeOptions,
  type TaskFilterState
} from './taskListFormModel';
import { taskManagementNow, type StoreTaskRecord, useTaskManagementState } from './TaskManagementState';
import { useTaskCreateFormState } from './useTaskCreateFormState';

const taskListCurrentMonth = taskManagementNow.slice(0, 7);
const taskListCurrentMonthRange = getDateScopeMonthRange(taskListCurrentMonth);

export function TaskListPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { authorization } = useAuthorizationState();
  const {
    brandRows,
    customerRows,
    deriveCustomerStatus,
    getBrandById,
    getCustomerById,
    storeRows
  } = useCustomerManagementState();
  const { attendanceRecords, peopleRows } = usePeopleOrganizationState();
  const { publishedMonthlyRecords } = usePerformanceResults();
  const { taskConfigRows } = useTaskConfigState();
  const { annualExceptionRows, workCalendarRows } = useWorkCalendarState();
  const {
    commitCustomerTaskAcceptance,
    createStoreTask,
    reverseTaskAcceptance,
    saveStoreTask,
    storeTaskRows
  } = useTaskManagementState();
  const [filters, setFilters] = useState<TaskFilterState>(defaultTaskFilters);
  const [activeTask, setActiveTask] = useState<StoreTaskRecord>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [reversalTask, setReversalTask] = useState<StoreTaskRecord>();
  const [reversalReason, setReversalReason] = useState('');
  const plannedDeliveryRange = useMemo(
    () => getDateScopeRange(filters.plannedDeliveryTime, taskListCurrentMonth),
    [filters.plannedDeliveryTime]
  );
  const availableBrandRows = useMemo(
    () =>
      brandRows.filter(
        (brand) =>
          brand.status === '启用' &&
          deriveCustomerStatus(brand.customerId) === '合作中' &&
          storeRows.some(
            (store) =>
              store.brandId === brand.id &&
              store.customerId === brand.customerId &&
              !['暂停', '闭店'].includes(store.status)
          )
      ),
    [brandRows, deriveCustomerStatus, storeRows]
  );
  const taskCreateForm = useTaskCreateFormState({
    annualExceptionRows,
    attendanceRecords,
    brandRows: availableBrandRows,
    getCustomerById,
    peopleRows,
    publishedPerformanceRecords: publishedMonthlyRecords,
    storeRows,
    storeTaskRows,
    taskConfigRows,
    workCalendarRows
  });

  function openCreateDrawer() {
    taskCreateForm.actions.reset();
    setCreateOpen(true);
  }

  function handleCreate() {
    const createInput = taskCreateForm.getCreateInput();

    if (!createInput.ready) {
      void messageApi.warning(createInput.warningMessage);
      return;
    }

    let nextTask: StoreTaskRecord;

    try {
      nextTask = createStoreTask(createInput.input);
    } catch (error) {
      void messageApi.warning(error instanceof Error ? error.message : '当前任务暂不可创建');
      return;
    }

    setActiveTask(nextTask);
    setDetailOpen(true);
    setCreateOpen(false);
    void messageApi.success('任务已创建');
  }

  function updateActiveTask(nextTask: StoreTaskRecord, successMessage: string) {
    saveStoreTask(nextTask);
    setActiveTask(nextTask);
    void messageApi.success(successMessage);
  }

  function handleTerminate(record: StoreTaskRecord) {
    updateActiveTask(buildTerminatedTaskRecord(record), '任务已中止');
  }

  function handleReverseAcceptance() {
    if (!reversalTask || !reversalReason.trim()) {
      return;
    }

    const result = reverseTaskAcceptance({
      actor: '李明',
      occurredAt: taskManagementNow,
      reason: reversalReason,
      taskId: reversalTask.id
    });

    if (!result.success) {
      void messageApi.warning(result.message ?? '当前验收结果不可撤销');
      return;
    }

    setReversalTask(undefined);
    setReversalReason('');
    setActiveTask(undefined);
    setDetailOpen(false);
    void messageApi.success('验收已撤销，相关绩效与结算来源已同步处理');
  }

  const filteredTasks = useMemo(
    () =>
      getFilteredStoreTasks({
        brandRows,
        customerRows,
        filters,
        plannedDeliveryRange,
        storeRows,
        storeTaskRows: storeTaskRows.filter((task) => canAccessTask(authorization, task))
      }),
    [authorization, brandRows, customerRows, filters, plannedDeliveryRange, storeRows, storeTaskRows]
  );

  const visibleTaskRows = useMemo(
    () => storeTaskRows.filter((task) => canAccessTask(authorization, task)),
    [authorization, storeTaskRows]
  );
  const metrics = useMemo(() => getTaskListMetrics(visibleTaskRows), [visibleTaskRows]);

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={6}>
          <MetricCard label="任务总数" value={metrics.total} icon={<FileTextOutlined />} />
          <MetricCard label="进行中" value={metrics.inProgress} icon={<ReloadOutlined />} />
          <MetricCard label="待验收" value={metrics.pendingAcceptance} icon={<CheckCircleOutlined />} />
          <MetricCard label="验收驳回" value={metrics.rejected} icon={<WarningOutlined />} />
          <MetricCard label="已完成" value={metrics.completed} icon={<FileDoneOutlined />} />
          <MetricCard label="已中止" value={metrics.stopped} icon={<StopOutlined />} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={taskListCurrentMonth}
              defaultRange={taskListCurrentMonthRange}
              label="计划交付"
              testIdPrefix="task-list-planned-delivery-filter"
              value={filters.plannedDeliveryTime}
              onChange={(plannedDeliveryTime) => setFilters((current) => ({ ...current, plannedDeliveryTime }))}
            />
            <FilterField label="品牌">
              <Select
                options={[
                  { label: '全部', value: '全部' },
                  ...brandRows.map((brand) => ({ label: brand.name, value: brand.id }))
                ]}
                value={filters.brandId}
                onChange={(brandId: TaskFilterState['brandId']) => setFilters((current) => ({ ...current, brandId }))}
              />
            </FilterField>
            <FilterField label="状态">
              <Select
                options={['全部', '进行中', '待验收', '验收驳回', '已完成', '已中止'].map((status) => ({ label: status, value: status }))}
                value={filters.status}
                onChange={(status: TaskFilterState['status']) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <FilterField label="甲方验收">
              <Select
                options={['全部', '待录入', '已完成'].map((status) => ({ label: status, value: status }))}
                value={filters.customerAcceptanceStatus}
                onChange={(customerAcceptanceStatus: TaskFilterState['customerAcceptanceStatus']) =>
                  setFilters((current) => ({ ...current, customerAcceptanceStatus }))
                }
              />
            </FilterField>
            <KeywordFilter
              allowClear
              placeholder="任务 / 门店 / 执行人 / 验收人"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
    >
      <TaskListTable
        records={filteredTasks}
        storeRows={storeRows}
        getBrandName={(brandId) => getBrandById(brandId)?.name ?? '-'}
        onCreate={openCreateDrawer}
        onRowClick={(record) => {
          setActiveTask(record);
          setDetailOpen(true);
        }}
      />

      <TaskCreateDrawer
        brandRows={availableBrandRows}
        formState={taskCreateForm}
        materialTypeOptions={taskMaterialTypeOptions}
        open={createOpen}
        storeRows={storeRows}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />

      <TaskDetailDrawer
        getBrandName={(brandId) => getBrandById(brandId)?.name ?? '-'}
        getCustomerName={(customerId) => getCustomerById(customerId)?.name ?? '-'}
        open={detailOpen}
        storeRows={storeRows}
        task={activeTask}
        onClose={() => setDetailOpen(false)}
        onSaveCustomerAcceptance={(record, input) => {
          const result = commitCustomerTaskAcceptance({ ...input, taskId: record.id });
          if (!result.success || !result.task) {
            void messageApi.warning(result.message ?? '甲方验收暂不可保存');
            return false;
          }

          setActiveTask(result.task);
          void messageApi.success(record.customerAcceptance ? '甲方验收已更正' : '甲方验收已录入');
          return true;
        }}
        onReverseAcceptance={(record) => {
          setReversalTask(record);
          setReversalReason('');
        }}
        onTerminate={handleTerminate}
      />

      <Modal
        cancelText="取消"
        okButtonProps={{ danger: true, disabled: !reversalReason.trim() }}
        okText="撤销验收"
        open={Boolean(reversalTask)}
        title="撤销验收"
        onCancel={() => {
          setReversalTask(undefined);
          setReversalReason('');
        }}
        onOk={handleReverseAcceptance}
      >
        <div className="task-acceptance-reversal-impact">
          撤销后任务退回待验收，相关绩效与结算来源同步撤销；已进入开票、收付、记账或锁期的事项保留原记录并转入财务更正。
        </div>
        <Input.TextArea
          autoSize={{ minRows: 3, maxRows: 6 }}
          maxLength={200}
          placeholder="填写撤销原因"
          showCount
          value={reversalReason}
          onChange={(event) => setReversalReason(event.target.value)}
        />
      </Modal>
    </ManagementPageScaffold>
  );
}

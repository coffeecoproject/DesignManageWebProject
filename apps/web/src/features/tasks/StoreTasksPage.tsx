import {
  CheckCircleOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  ReloadOutlined,
  StopOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Select, message } from 'antd';
import { useMemo, useState } from 'react';
import { DateScopeFilter, getDateScopeMonthRange, getDateScopeRange } from '../../components/DateFilterFields';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { useCustomerManagementState } from '../customers/CustomerManagementState';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { usePerformanceRuleState } from '../performance/PerformanceRuleState';
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
  const { brandRows, customerRows, getBrandById, getCustomerById, storeRows } = useCustomerManagementState();
  const { attendanceRecords, peopleRows } = usePeopleOrganizationState();
  const { performanceRuleRows } = usePerformanceRuleState();
  const { taskConfigRows } = useTaskConfigState();
  const { annualExceptionRows, workCalendarRows } = useWorkCalendarState();
  const { createStoreTask, saveStoreTask, storeTaskRows } = useTaskManagementState();
  const [filters, setFilters] = useState<TaskFilterState>(defaultTaskFilters);
  const [activeTask, setActiveTask] = useState<StoreTaskRecord>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const plannedDeliveryRange = useMemo(
    () => getDateScopeRange(filters.plannedDeliveryTime, taskListCurrentMonth),
    [filters.plannedDeliveryTime]
  );
  const taskCreateForm = useTaskCreateFormState({
    annualExceptionRows,
    attendanceRecords,
    brandRows,
    getCustomerById,
    peopleRows,
    performanceRuleRows,
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

    const nextTask = createStoreTask(createInput.input);

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

  const filteredTasks = useMemo(
    () =>
      getFilteredStoreTasks({
        brandRows,
        customerRows,
        filters,
        plannedDeliveryRange,
        storeRows,
        storeTaskRows,
        taskConfigRows
      }),
    [brandRows, customerRows, filters, plannedDeliveryRange, storeRows, storeTaskRows, taskConfigRows]
  );

  const metrics = useMemo(() => getTaskListMetrics(storeTaskRows), [storeTaskRows]);

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
        taskConfigRows={taskConfigRows}
        getBrandName={(brandId) => getBrandById(brandId)?.name ?? '-'}
        onCreate={openCreateDrawer}
        onRowClick={(record) => {
          setActiveTask(record);
          setDetailOpen(true);
        }}
      />

      <TaskCreateDrawer
        brandRows={brandRows}
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
        taskConfigRows={taskConfigRows}
        onClose={() => setDetailOpen(false)}
        onTerminate={handleTerminate}
      />
    </ManagementPageScaffold>
  );
}

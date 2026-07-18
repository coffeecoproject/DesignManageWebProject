import {
  AuditOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  ReloadOutlined,
  TeamOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Select } from 'antd';
import { useMemo, useState } from 'react';
import { DateScopeFilter, getDateScopeMonthRange, getDateScopeRange } from '../../components/DateFilterFields';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { useCustomerManagementState } from '../customers/CustomerManagementState';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { usePerformanceResults } from '../performance/usePerformanceResults';
import { useTaskConfigState } from '../system/TaskConfigState';
import { taskManagementNow, type StoreTaskRecord, useTaskManagementState } from './TaskManagementState';
import { PeopleTaskDrawer } from './PeopleTaskDrawer';
import { PeopleTaskTable } from './PeopleTaskTable';
import {
  buildPersonTaskSummaries,
  defaultPeopleTaskFilters,
  filterPersonTaskSummaries,
  getPersonTaskMetrics,
  type PeopleTaskFilterState
} from './personTaskViewModel';
import { getTaskTypeName as resolveTaskTypeName } from './taskDisplayModel';

const peopleTaskCurrentMonth = taskManagementNow.slice(0, 7);
const peopleTaskCurrentMonthRange = getDateScopeMonthRange(peopleTaskCurrentMonth);

export function PeopleTasksPage() {
  const { getBrandById, getCustomerById, storeRows } = useCustomerManagementState();
  const { peopleRows } = usePeopleOrganizationState();
  const { publishedMonthlyRecords } = usePerformanceResults();
  const { taskConfigRows } = useTaskConfigState();
  const { storeTaskRows } = useTaskManagementState();
  const [filters, setFilters] = useState<PeopleTaskFilterState>(defaultPeopleTaskFilters);
  const [activeSummaryId, setActiveSummaryId] = useState<string>();
  const completedRange = useMemo(() => getDateScopeRange(filters.completionTime, peopleTaskCurrentMonth), [filters.completionTime]);

  const summaries = useMemo(
    () =>
      buildPersonTaskSummaries({
        completedRange,
        peopleRows,
        publishedPerformanceRecords: publishedMonthlyRecords,
        storeTaskRows
      }),
    [completedRange, peopleRows, publishedMonthlyRecords, storeTaskRows]
  );
  const filteredSummaries = useMemo(() => filterPersonTaskSummaries(summaries, filters), [filters, summaries]);
  const activeSummary = activeSummaryId ? summaries.find((summary) => summary.id === activeSummaryId) : undefined;
  const metrics = useMemo(() => getPersonTaskMetrics(summaries), [summaries]);

  function getBrandName(task: StoreTaskRecord) {
    return getBrandById(task.brandId)?.name ?? '-';
  }

  function getCustomerName(task: StoreTaskRecord) {
    return getCustomerById(task.customerId)?.name ?? '-';
  }

  function getStoreLabel(task: StoreTaskRecord) {
    const store = storeRows.find((row) => row.id === task.storeId);
    return store ? `${store.name} / ${store.city}` : '-';
  }

  function getTaskTypeName(task: StoreTaskRecord) {
    return resolveTaskTypeName(task.taskConfigId, taskConfigRows);
  }

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      metrics={
        <MetricGrid columns={6}>
          <MetricCard icon={<TeamOutlined />} label="人员" value={metrics.people} />
          <MetricCard icon={<CheckCircleOutlined />} label="已完成" value={metrics.completedTasks} />
          <MetricCard icon={<ReloadOutlined />} label="执行中" value={metrics.inProgressTasks} />
          <MetricCard icon={<FileTextOutlined />} label="待验收" value={metrics.pendingAcceptanceTasks} />
          <MetricCard icon={<WarningOutlined />} label="逾期" value={metrics.overdueTasks} />
          <MetricCard icon={<AuditOutlined />} label="驳回次数" value={metrics.rejectionCount} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={peopleTaskCurrentMonth}
              defaultRange={peopleTaskCurrentMonthRange}
              label="完成时间"
              testIdPrefix="people-task-completion-time-filter"
              value={filters.completionTime}
              onChange={(completionTime) => setFilters((current) => ({ ...current, completionTime }))}
            />
            <FilterField label="人员类型">
              <Select
                className="field-control"
                options={[
                  { label: '全部', value: '全部' },
                  { label: '全职', value: '全职' },
                  { label: '兼职', value: '兼职' }
                ]}
                value={filters.personnelType}
                onChange={(personnelType: PeopleTaskFilterState['personnelType']) => setFilters((current) => ({ ...current, personnelType }))}
              />
            </FilterField>
            <FilterField label="任务状态">
              <Select
                className="field-control"
                options={[
                  { label: '全部', value: '全部' },
                  { label: '已完成', value: '已完成' },
                  { label: '执行中', value: '执行中' },
                  { label: '待验收', value: '待验收' },
                  { label: '逾期', value: '逾期' },
                  { label: '被驳回', value: '驳回' },
                  { label: '当前无任务', value: '当前无任务' }
                ]}
                value={filters.taskState}
                onChange={(taskState: PeopleTaskFilterState['taskState']) => setFilters((current) => ({ ...current, taskState }))}
              />
            </FilterField>
            <KeywordFilter
              placeholder="姓名 / 手机 / 岗位 / 任务"
              value={filters.keyword}
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
    >
      <PeopleTaskTable records={filteredSummaries} onRowClick={(summary) => setActiveSummaryId(summary.id)} />

      <PeopleTaskDrawer
        activeSummary={activeSummary}
        getBrandName={getBrandName}
        getCustomerName={getCustomerName}
        getStoreLabel={getStoreLabel}
        getTaskTypeName={getTaskTypeName}
        open={Boolean(activeSummary)}
        onClose={() => setActiveSummaryId(undefined)}
      />
    </ManagementPageScaffold>
  );
}

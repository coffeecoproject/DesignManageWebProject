import { CommentOutlined, FileDoneOutlined, ShopOutlined, WarningOutlined } from '@ant-design/icons';
import { Select } from 'antd';
import { useMemo, useState } from 'react';
import { DateScopeFilter, getDateScopeMonthRange, getDateScopeRange } from '../../components/DateFilterFields';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { useCustomerManagementState } from '../customers/CustomerManagementState';
import { useTaskConfigState } from '../system/TaskConfigState';
import { feedbackChannelOptions } from './TaskClientFeedbackShared';
import { taskManagementNow, type StoreTaskRecord, useTaskManagementState } from './TaskManagementState';
import { TaskFeedbackDrawer } from './TaskFeedbackDrawer';
import { TaskFeedbackTable } from './TaskFeedbackTable';
import {
  buildTaskFeedbackSummaries,
  defaultTaskFeedbackFilters,
  filterTaskFeedbackSummaries,
  getTaskFeedbackMetrics,
  type TaskFeedbackFilterState,
  type TaskFeedbackLookupContext
} from './taskFeedbackModel';
import { getTaskTypeName } from './taskDisplayModel';

const taskFeedbackCurrentMonth = taskManagementNow.slice(0, 7);
const taskFeedbackCurrentMonthRange = getDateScopeMonthRange(taskFeedbackCurrentMonth);

export function TaskFeedbackPage() {
  const { brandRows, customerRows, getBrandById, getCustomerById, storeRows } = useCustomerManagementState();
  const { taskConfigRows } = useTaskConfigState();
  const { clientFeedbackRows, storeTaskRows } = useTaskManagementState();
  const [filters, setFilters] = useState<TaskFeedbackFilterState>(defaultTaskFeedbackFilters);
  const [activeSummaryId, setActiveSummaryId] = useState<string>();
  const feedbackRange = useMemo(() => getDateScopeRange(filters.feedbackTime, taskFeedbackCurrentMonth), [filters.feedbackTime]);

  const filteredBrands = useMemo(
    () => (filters.customerId === '全部' ? brandRows : brandRows.filter((brand) => brand.customerId === filters.customerId)),
    [brandRows, filters.customerId]
  );
  const summaries = useMemo(
    () =>
      buildTaskFeedbackSummaries({
        clientFeedbackRows,
        storeTaskRows
      }),
    [clientFeedbackRows, storeTaskRows]
  );
  const lookup = useMemo<TaskFeedbackLookupContext>(
    () => ({
      getBrandName(task: StoreTaskRecord) {
        return getBrandById(task.brandId)?.name ?? '-';
      },
      getCustomerName(task: StoreTaskRecord) {
        return getCustomerById(task.customerId)?.name ?? '-';
      },
      getStoreLabel(task: StoreTaskRecord) {
        const store = storeRows.find((row) => row.id === task.storeId);
        return store ? `${store.name} / ${store.city}` : '-';
      },
      getTaskTypeName(task: StoreTaskRecord) {
        return getTaskTypeName(task.taskConfigId, taskConfigRows);
      }
    }),
    [getBrandById, getCustomerById, storeRows, taskConfigRows]
  );
  const filteredSummaries = useMemo(
    () => filterTaskFeedbackSummaries(summaries, filters, lookup, feedbackRange),
    [feedbackRange, filters, lookup, summaries]
  );
  const activeSummary = activeSummaryId ? summaries.find((summary) => summary.id === activeSummaryId) : undefined;
  const metrics = useMemo(() => getTaskFeedbackMetrics(summaries), [summaries]);

  return (
    <ManagementPageScaffold
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<ShopOutlined />} label="归档任务" value={metrics.tasks} />
          <MetricCard icon={<WarningOutlined />} label="驳回次数" value={metrics.reworkCount} />
          <MetricCard icon={<CommentOutlined />} label="甲方反馈" value={metrics.clientFeedbackCount} />
          <MetricCard icon={<FileDoneOutlined />} label="反馈截图" value={metrics.feedbackFiles} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={taskFeedbackCurrentMonth}
              defaultRange={taskFeedbackCurrentMonthRange}
              label="反馈时间"
              testIdPrefix="task-feedback-time-filter"
              value={filters.feedbackTime}
              onChange={(feedbackTime) => setFilters((current) => ({ ...current, feedbackTime }))}
            />
            <FilterField label="客户">
              <Select
                options={[
                  { label: '全部', value: '全部' },
                  ...customerRows.map((customer) => ({ label: customer.name, value: customer.id }))
                ]}
                value={filters.customerId}
                onChange={(customerId: TaskFeedbackFilterState['customerId']) =>
                  setFilters((current) => ({
                    ...current,
                    brandId: current.brandId !== '全部' && brandRows.find((brand) => brand.id === current.brandId)?.customerId !== customerId ? '全部' : current.brandId,
                    customerId
                  }))
                }
              />
            </FilterField>
            <FilterField label="品牌">
              <Select
                options={[
                  { label: '全部', value: '全部' },
                  ...filteredBrands.map((brand) => ({ label: brand.name, value: brand.id }))
                ]}
                value={filters.brandId}
                onChange={(brandId: TaskFeedbackFilterState['brandId']) => setFilters((current) => ({ ...current, brandId }))}
              />
            </FilterField>
            <FilterField label="反馈类型">
              <Select
                options={['全部', '有驳回', '有甲方反馈', '两者都有'].map((feedbackType) => ({ label: feedbackType, value: feedbackType }))}
                value={filters.feedbackType}
                onChange={(feedbackType: TaskFeedbackFilterState['feedbackType']) => setFilters((current) => ({ ...current, feedbackType }))}
              />
            </FilterField>
            <FilterField label="反馈渠道">
              <Select
                options={['全部', ...feedbackChannelOptions].map((channel) => ({ label: channel, value: channel }))}
                value={filters.channel}
                onChange={(channel: TaskFeedbackFilterState['channel']) => setFilters((current) => ({ ...current, channel }))}
              />
            </FilterField>
            <KeywordFilter
              allowClear
              placeholder="任务 / 人员 / 原因 / 反馈"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
    >
      <TaskFeedbackTable
        getBrandName={lookup.getBrandName}
        getCustomerName={lookup.getCustomerName}
        getStoreLabel={lookup.getStoreLabel}
        records={filteredSummaries}
        onRowClick={(summary) => setActiveSummaryId(summary.id)}
      />

      <TaskFeedbackDrawer
        activeSummary={activeSummary}
        getBrandName={lookup.getBrandName}
        getCustomerName={lookup.getCustomerName}
        getStoreLabel={lookup.getStoreLabel}
        getTaskTypeName={lookup.getTaskTypeName}
        open={Boolean(activeSummary)}
        onClose={() => setActiveSummaryId(undefined)}
      />
    </ManagementPageScaffold>
  );
}

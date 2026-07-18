import {
  CheckCircleOutlined,
  FileSearchOutlined,
  SearchOutlined,
  SendOutlined,
  TeamOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Select } from 'antd';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { StatusTag, type StatusTagTone } from '../../components/Detail';
import { DetailTabs } from '../../components/DetailTabs';
import {
  DateScopeFilter,
  getDateScopeMonthRange,
  getDateScopeRange,
  type DateRangeFilterValue,
  type DateScopeFilterValue
} from '../../components/DateFilterFields';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CellText, CompactCell } from '../../components/TableCell';
import { taskManagementToday } from '../tasks/TaskManagementState';
import { PerformanceResultDrawer } from './PerformanceResultDrawer';
import type {
  PerformanceMonthlyCategoryRecord,
  PerformanceResultLifecycleStatus,
  PerformanceResultReadRecord,
  PerformanceRuleCategory
} from './performanceTypes';
import { isMonthlyPerformanceResult } from './performanceResultModel';
import { getPerformanceQuarterMonths } from './performanceQuarterlyResultModel';
import { usePerformanceResults } from './usePerformanceResults';

type MonthlyEmployeeFilter = '全部' | string;
type PerformanceDetailTabKey = '综合' | PerformanceRuleCategory;
type PerformanceResultStatusFilter = '全部' | PerformanceResultLifecycleStatus;

type PerformanceMonthlyFilters = {
  employee: MonthlyEmployeeFilter;
  keyword: string;
  performanceTime: DateScopeFilterValue;
  status: PerformanceResultStatusFilter;
};

const defaultFilters: PerformanceMonthlyFilters = {
  employee: '全部',
  keyword: '',
  performanceTime: { mode: 'all' },
  status: '全部'
};

const performanceDetailTabs: Array<{
  key: PerformanceDetailTabKey;
  label: string;
  testIdKey: string;
}> = [
  { key: '综合', label: '综合', testIdKey: 'all' },
  { key: '绘图任务制', label: '绘图任务制', testIdKey: 'drawing' }
];

const resultStatusOptions: PerformanceResultStatusFilter[] = ['全部', '待发布', '已发布', '已结算'];
const resultStatusTone: Record<PerformanceResultLifecycleStatus, StatusTagTone> = {
  已发布: 'green',
  已更正: 'gray',
  已结算: 'green',
  待发布: 'amber'
};
const performanceDetailDefaultMonth = taskManagementToday.slice(0, 7);
const performanceDetailDefaultMonthRange = getDateScopeMonthRange(performanceDetailDefaultMonth);
const currentPerformanceActor = '李明';

function formatScore(value: number) {
  return Number.isInteger(value) ? `${value} 分` : `${value.toFixed(1)} 分`;
}

function formatOptionalScore(value?: number) {
  return typeof value === 'number' ? formatScore(value) : '-';
}

function formatMoney(value: number) {
  return `${value.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  })} 元`;
}

function getResultSourceRecord(readRecord: PerformanceResultReadRecord) {
  return isMonthlyPerformanceResult(readRecord.result)
    ? readRecord.result.calculationSnapshot.categoryRecord
    : undefined;
}

function getResultCategory(readRecord: PerformanceResultReadRecord) {
  return isMonthlyPerformanceResult(readRecord.result)
    ? readRecord.result.calculationSnapshot.categoryRecord.category
    : readRecord.result.calculationSnapshot.category;
}

function getResultAmount(readRecord: PerformanceResultReadRecord) {
  return isMonthlyPerformanceResult(readRecord.result)
    ? readRecord.result.monthlyAmount
    : readRecord.result.quarterFinalAmount;
}

function getPerformanceResultSecondary(record: PerformanceMonthlyCategoryRecord) {
  if (typeof record.taskScore === 'number') {
    return `任务完成分 ${formatScore(record.taskScore)}`;
  }

  return record.sourceLabel;
}

function getPerformancePeriodMonthRange(period: string) {
  if (/^\d{4}-Q[1-4]$/.test(period)) {
    const months = getPerformanceQuarterMonths(period);

    return {
      endDate: getDateScopeMonthRange(months[2]!).endDate,
      startDate: getDateScopeMonthRange(months[0]!).startDate
    };
  }

  return getDateScopeMonthRange(period);
}

function isPerformancePeriodInRange(period: string, range?: DateRangeFilterValue) {
  if (!range) {
    return true;
  }

  const monthRange = getPerformancePeriodMonthRange(period);

  return monthRange.startDate <= range.endDate && monthRange.endDate >= range.startDate;
}

function performanceResultMatchesFilters(
  readRecord: PerformanceResultReadRecord,
  filters: PerformanceMonthlyFilters,
  performanceRange?: DateRangeFilterValue
) {
  const { result } = readRecord;
  const record = getResultSourceRecord(readRecord);
  const keyword = filters.keyword.trim().toLowerCase();

  if (!isPerformancePeriodInRange(result.period, performanceRange)) {
    return false;
  }

  if (filters.employee !== '全部' && result.employeeNameSnapshot !== filters.employee) {
    return false;
  }

  if (filters.status !== '全部' && result.lifecycleStatus !== filters.status) {
    return false;
  }

  if (!keyword) {
    return true;
  }

  return [
    result.employeeNameSnapshot,
    result.workNoSnapshot,
    result.positionSnapshot,
    result.kind,
    result.lifecycleStatus,
    result.period,
    getResultCategory(readRecord),
    result.ruleNameSnapshot,
    result.ruleVersion,
    record?.sourceLabel,
    record?.note
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

function getPerformanceResultsForTab(tabKey: PerformanceDetailTabKey, records: PerformanceResultReadRecord[]) {
  return tabKey === '综合'
    ? records
    : records.filter((record) => getResultCategory(record) === tabKey);
}

function getPerformanceResultColumns(tabKey: PerformanceDetailTabKey): TableColumnsType<PerformanceResultReadRecord> {
  const columns: TableColumnsType<PerformanceResultReadRecord> = [
    {
      title: '绩效周期',
      key: 'period',
      width: 110,
      render: (_, readRecord) => <CellText>{readRecord.result.period}</CellText>
    },
    {
      align: 'center',
      title: '结果类型',
      key: 'kind',
      width: 104,
      render: (_, readRecord) => <CellText>{readRecord.result.kind}</CellText>
    },
    {
      title: '工号',
      key: 'workNo',
      width: 110,
      render: (_, readRecord) => <CellText>{readRecord.result.workNoSnapshot}</CellText>
    },
    {
      title: '人员',
      key: 'employee',
      width: 168,
      render: (_, readRecord) => (
        <CompactCell
          primary={readRecord.result.employeeNameSnapshot}
          secondary={readRecord.result.positionSnapshot}
        />
      )
    },
    {
      title: '绩效类别',
      key: 'category',
      width: 150,
      render: (_, readRecord) => {
        const record = getResultSourceRecord(readRecord);

        return (
          <CompactCell
            primary={getResultCategory(readRecord)}
            secondary={record?.sourceLabel ?? '月度结果归集'}
          />
        );
      }
    },
    {
      title: '绩效结果',
      key: 'result',
      width: 146,
      render: (_, readRecord) => {
        const result = readRecord.result;

        if (!isMonthlyPerformanceResult(result)) {
          const sourceCount = result.calculationSnapshot.sourceResults.length;
          const expectedCount = result.calculationSnapshot.expectedMonths.length;

          return (
            <CompactCell
              primary={formatMoney(result.quarterFinalAmount)}
              secondary={`已归集 ${sourceCount}/${expectedCount} 个月`}
            />
          );
        }

        const monthlyRecord = result.calculationSnapshot.categoryRecord;

        return (
          <CompactCell
            primary={formatOptionalScore(monthlyRecord.qualityScore)}
            secondary={getPerformanceResultSecondary(monthlyRecord)}
          />
        );
      }
    },
    {
      align: 'center',
      title: '结果状态',
      key: 'status',
      width: 126,
      render: (_, readRecord) => (
        <CompactCell
          align="center"
          primarySlot={
            <StatusTag
              tone={resultStatusTone[readRecord.result.lifecycleStatus]}
              value={readRecord.result.lifecycleStatus}
              variant="compact"
            />
          }
          secondary={
            readRecord.sourceChangedSincePublish
              ? '来源有变化'
              : `V${readRecord.result.version}`
          }
        />
      )
    },
    {
      align: 'center',
      title: '来源记录',
      key: 'sourceTaskCount',
      width: 110,
      render: (_, readRecord) => (
        <CellText>
          {isMonthlyPerformanceResult(readRecord.result)
            ? `${readRecord.result.calculationSnapshot.categoryRecord.sourceTaskCount} 条`
            : `${readRecord.result.calculationSnapshot.sourceResults.length} 个月`}
        </CellText>
      )
    },
    {
      align: 'right',
      title: '结果金额',
      key: 'resultAmount',
      width: 126,
      render: (_, readRecord) => <CellText>{formatMoney(getResultAmount(readRecord))}</CellText>
    },
    {
      align: 'right',
      title: '预发/差额',
      key: 'settlementAmount',
      width: 140,
      render: (_, readRecord) => (
        <CompactCell
          primary={formatMoney(
            isMonthlyPerformanceResult(readRecord.result)
              ? readRecord.result.prepayAmount
              : readRecord.result.quarterDifferenceAmount
          )}
          secondary={isMonthlyPerformanceResult(readRecord.result) ? '月度预发' : '季度差额'}
        />
      )
    }
  ];

  if (tabKey === '综合') {
    return columns;
  }

  const categoryColumnIndex = columns.findIndex((column) => column.key === 'category');
  columns.splice(categoryColumnIndex + 1, 0, {
    title: '绩效规则',
    key: 'rule',
    width: 170,
    render: (_, readRecord) => (
      <CompactCell
        primary={readRecord.result.ruleNameSnapshot}
        secondary={readRecord.result.ruleVersion}
      />
    )
  });

  return columns;
}

function getPerformanceActionTimestamp() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

export function PerformanceMonthlyPage() {
  const [filters, setFilters] = useState<PerformanceMonthlyFilters>(defaultFilters);
  const [activeTab, setActiveTab] = useState<PerformanceDetailTabKey>('综合');
  const [selectedResultKey, setSelectedResultKey] = useState<string>();
  const {
    allResults,
    correctResult,
    getResultHistory,
    publishResult,
    resolveEmployeeObjection
  } = usePerformanceResults();
  const selectedReadRecord = allResults.find(
    ({ result }) => result.resultKey === selectedResultKey
  ) ?? null;
  const selectedResultHistory = selectedReadRecord
    ? getResultHistory(selectedReadRecord.result.resultKey)
    : [];
  const employeeOptions = useMemo(
    () => ['全部', ...Array.from(new Set(allResults.map(({ result }) => result.employeeNameSnapshot)))],
    [allResults]
  );
  const performanceRange = useMemo(
    () => getDateScopeRange(filters.performanceTime, performanceDetailDefaultMonth),
    [filters.performanceTime]
  );
  const baseResults = useMemo(
    () =>
      allResults
        .filter((record) => performanceResultMatchesFilters(record, filters, performanceRange))
        .sort(
          (left, right) =>
            right.result.period.localeCompare(left.result.period)
            || left.result.employeeNameSnapshot.localeCompare(right.result.employeeNameSnapshot, 'zh-CN')
            || getResultCategory(left).localeCompare(getResultCategory(right), 'zh-CN')
            || getResultAmount(right) - getResultAmount(left)
        ),
    [allResults, filters, performanceRange]
  );
  const visibleResults = useMemo(
    () => getPerformanceResultsForTab(activeTab, baseResults),
    [activeTab, baseResults]
  );
  const employeeCount = useMemo(
    () => new Set(visibleResults.map(({ result }) => result.workNoSnapshot)).size,
    [visibleResults]
  );
  const draftCount = visibleResults.filter(({ result }) => result.lifecycleStatus === '待发布').length;
  const publishedResults = visibleResults.filter(
    ({ result }) => result.lifecycleStatus === '已发布' || result.lifecycleStatus === '已结算'
  );
  const publishedPrepayTotal = publishedResults.reduce(
    (total, { result }) => total + (isMonthlyPerformanceResult(result) ? result.prepayAmount : 0),
    0
  );

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      metrics={
        <MetricGrid columns={5}>
          <MetricCard icon={<TeamOutlined />} label="绩效员工" value={employeeCount} />
          <MetricCard icon={<FileSearchOutlined />} label="结果明细" value={visibleResults.length} />
          <MetricCard icon={<SendOutlined />} label="待发布" value={draftCount} />
          <MetricCard icon={<CheckCircleOutlined />} label="已发布" value={publishedResults.length} />
          <MetricCard icon={<WalletOutlined />} label="月度预发" value={formatMoney(publishedPrepayTotal)} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={performanceDetailDefaultMonth}
              defaultRange={performanceDetailDefaultMonthRange}
              label="绩效时间"
              testIdPrefix="performance-detail-time-filter"
              value={filters.performanceTime}
              onChange={(performanceTime) => setFilters((current) => ({ ...current, performanceTime }))}
            />
            <FilterField label="员工">
              <Select
                data-testid="performance-monthly-employee-filter"
                options={employeeOptions.map((employee) => ({ label: employee, value: employee }))}
                value={filters.employee}
                onChange={(employee: MonthlyEmployeeFilter) =>
                  setFilters((current) => ({ ...current, employee }))
                }
              />
            </FilterField>
            <FilterField label="结果状态">
              <Select
                data-testid="performance-result-status-filter"
                options={resultStatusOptions.map((status) => ({ label: status, value: status }))}
                value={filters.status}
                onChange={(status: PerformanceResultStatusFilter) =>
                  setFilters((current) => ({ ...current, status }))
                }
              />
            </FilterField>
            <KeywordFilter
              allowClear
              data-testid="performance-monthly-keyword-input"
              placeholder="员工/类别/绩效周期"
              prefix={<SearchOutlined />}
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
      pageId="performance-monthly"
    >
      <DetailTabs
        activeKey={activeTab}
        tabTestIdPrefix="performance-detail-category-tab"
        testId="performance-detail-category-tabs"
        variant="workbench"
        items={performanceDetailTabs.map((tab) => {
          const tabResults = getPerformanceResultsForTab(tab.key, baseResults);

          return {
            key: tab.key,
            label: tab.label,
            children: (
              <ManagementTable<PerformanceResultReadRecord>
                columns={getPerformanceResultColumns(tab.key)}
                count={{ value: tabResults.length, unit: '条绩效结果' }}
                dataSource={tabResults}
                rowKey={(record) => record.result.resultKey}
                rowTestIdPrefix={`performance-result-table-row-${tab.testIdKey}`}
                tableTestId={`performance-result-table-${tab.testIdKey}`}
                onRowClick={(record) => setSelectedResultKey(record.result.resultKey)}
              />
            )
          };
        })}
        onChange={(key) => setActiveTab(key as PerformanceDetailTabKey)}
      />

      <PerformanceResultDrawer
        actionTime={getPerformanceActionTimestamp()}
        history={selectedResultHistory}
        readRecord={selectedReadRecord}
        onClose={() => setSelectedResultKey(undefined)}
        onCorrect={(correctionReason, adjustment) =>
          selectedReadRecord
            ? correctResult(selectedReadRecord.result.resultKey, {
                actor: currentPerformanceActor,
                correctionReason,
                deliveredAt: getPerformanceActionTimestamp(),
                ...adjustment
              })
            : { reason: '未选择绩效结果', success: false }
        }
        onPublish={(input) =>
          selectedReadRecord
            ? publishResult(selectedReadRecord.result.resultKey, {
                actor: currentPerformanceActor,
                deliveredAt: getPerformanceActionTimestamp(),
                ...input
              })
            : { reason: '未选择绩效结果', success: false }
        }
        onResolveObjection={(resolutionSummary) =>
          selectedReadRecord
            ? resolveEmployeeObjection(selectedReadRecord.result.id, {
                actor: currentPerformanceActor,
                resolutionSummary,
                resolvedAt: getPerformanceActionTimestamp()
              })
            : { reason: '未选择绩效结果', success: false }
        }
      />
    </ManagementPageScaffold>
  );
}

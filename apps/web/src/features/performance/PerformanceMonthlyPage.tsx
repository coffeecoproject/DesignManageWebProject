import {
  AuditOutlined,
  CalculatorOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  PartitionOutlined,
  ProfileOutlined,
  SearchOutlined,
  TeamOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Empty, Select } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
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
import { OperationRecordSection } from '../../components/OperationRecordSection';
import type { OperationRecord } from '../../components/OperationRecordTable';
import { CellText, CompactCell } from '../../components/TableCell';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { useWorkCalendarState } from '../system/WorkCalendarState';
import { performanceDrawingTaskMonthlyRecords, performanceMonthlyCategoryRecords, performanceRulePresets } from './performanceMockData';
import { buildPerformanceMonthlyRecords } from './performanceMonthlyModel';
import { performanceSignatureEmployees, signatureRuleOptions } from './performanceSignatureArchiveData';
import type {
  PerformanceDrawingTaskMonthlyRecord,
  PerformanceMonthlyCategoryRecord,
  PerformanceRuleCategory
} from './performanceTypes';

type MonthlyEmployeeFilter = '全部' | string;
type PerformanceDetailTabKey = '综合' | PerformanceRuleCategory;

type PerformanceMonthlyFilters = {
  employee: MonthlyEmployeeFilter;
  keyword: string;
  performanceTime: DateScopeFilterValue;
};

const defaultFilters: PerformanceMonthlyFilters = {
  employee: '全部',
  keyword: '',
  performanceTime: { mode: 'all' }
};

const performanceDetailTabs: Array<{
  key: PerformanceDetailTabKey;
  label: string;
  testIdKey: string;
}> = [
  { key: '综合', label: '综合', testIdKey: 'all' },
  { key: '绘图任务制', label: '绘图任务制', testIdKey: 'drawing' },
  { key: '岗位职责考核', label: '岗位职责考核', testIdKey: 'duty' },
  { key: '项目奖金', label: '项目奖金', testIdKey: 'bonus' }
];

const performanceDetailAvailableMonths = Array.from(new Set(performanceMonthlyCategoryRecords.map((record) => record.performanceMonth))).sort();
const performanceDetailDefaultMonth =
  performanceDetailAvailableMonths[performanceDetailAvailableMonths.length - 1] ?? performanceDrawingTaskMonthlyRecords[0]?.performanceMonth ?? '2026-06';
const performanceDetailDefaultMonthRange = getDateScopeMonthRange(performanceDetailDefaultMonth);

function formatScore(value: number) {
  return Number.isInteger(value) ? `${value} 分` : `${value.toFixed(1)} 分`;
}

function formatOptionalScore(value?: number) {
  return typeof value === 'number' ? formatScore(value) : '-';
}

function formatRatio(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatMoney(value: number) {
  return `${value.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  })} 元`;
}

function formatSourceCount(value: number) {
  return value > 0 ? `${value} 条` : '-';
}

function getPerformanceResultSecondary(record: PerformanceMonthlyCategoryRecord) {
  if (typeof record.taskScore === 'number') {
    return `任务完成分 ${formatScore(record.taskScore)}`;
  }

  if (record.category === '岗位职责考核') {
    return '周期考核';
  }

  if (record.category === '项目奖金') {
    return '奖金确认';
  }

  return record.sourceLabel;
}

function isPerformanceMonthInRange(performanceMonth: string, range?: DateRangeFilterValue) {
  if (!range) {
    return true;
  }

  const monthRange = getDateScopeMonthRange(performanceMonth);

  return monthRange.startDate <= range.endDate && monthRange.endDate >= range.startDate;
}

function monthlyCategoryRecordMatchesFilters(record: PerformanceMonthlyCategoryRecord, filters: PerformanceMonthlyFilters, performanceRange?: DateRangeFilterValue) {
  const keyword = filters.keyword.trim().toLowerCase();

  if (!isPerformanceMonthInRange(record.performanceMonth, performanceRange)) {
    return false;
  }

  if (filters.employee !== '全部' && record.employeeName !== filters.employee) {
    return false;
  }

  if (!keyword) {
    return true;
  }

  return [
    record.employeeName,
    record.workNo,
    record.position,
    record.department,
    record.category,
    record.ruleName,
    record.ruleVersion,
    record.performanceMonth,
    record.sourceLabel,
    record.note
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

function getCategoryOperationRecords(record: PerformanceMonthlyCategoryRecord): OperationRecord[] {
  return record.events.map((event) => ({
    id: event.id,
    action: event.action,
    actor: event.actor,
    object: event.object,
    summary: event.summary,
    time: event.time
  }));
}

function getDrawingTaskDetail(
  record: PerformanceMonthlyCategoryRecord,
  drawingTaskRecords: PerformanceDrawingTaskMonthlyRecord[]
): PerformanceDrawingTaskMonthlyRecord | undefined {
  if (record.category !== '绘图任务制') {
    return undefined;
  }

  return drawingTaskRecords.find((item) => item.id === record.id);
}

function getPerformanceRecordsForTab(tabKey: PerformanceDetailTabKey, records: PerformanceMonthlyCategoryRecord[]) {
  return tabKey === '综合' ? records : records.filter((record) => record.category === tabKey);
}

function getPerformanceDetailColumns(tabKey: PerformanceDetailTabKey): TableColumnsType<PerformanceMonthlyCategoryRecord> {
  const columns: TableColumnsType<PerformanceMonthlyCategoryRecord> = [
    {
      title: '绩效周期',
      dataIndex: 'performanceMonth',
      width: 110,
      render: (performanceMonth: string) => <CellText>{performanceMonth}</CellText>
    },
    {
      title: '工号',
      dataIndex: 'workNo',
      width: 110,
      render: (workNo: string) => <CellText>{workNo}</CellText>
    },
    {
      title: '人员',
      key: 'employee',
      width: 168,
      render: (_, record) => <CompactCell primary={record.employeeName} secondary={`${record.position} / ${record.department}`} />
    },
    {
      title: '绩效类别',
      key: 'category',
      width: 150,
      render: (_, record) => <CompactCell primary={record.category} secondary={record.sourceLabel} />
    },
    {
      title: '绩效结果',
      key: 'result',
      width: 146,
      render: (_, record) => <CompactCell primary={formatOptionalScore(record.qualityScore)} secondary={getPerformanceResultSecondary(record)} />
    },
    {
      title: '来源记录',
      dataIndex: 'sourceTaskCount',
      width: 110,
      render: (value: number) => <CellText>{formatSourceCount(value)}</CellText>
    },
    {
      title: '绩效金额',
      dataIndex: 'monthlyAmount',
      width: 126,
      render: (value: number) => <CellText>{formatMoney(value)}</CellText>
    },
    {
      title: '预发金额',
      dataIndex: 'prepayAmount',
      width: 126,
      render: (value: number) => <CellText>{formatMoney(value)}</CellText>
    }
  ];

  if (tabKey === '综合') {
    return columns;
  }

  const sourceColumnIndex = columns.findIndex((column) => column.key === 'category');
  columns.splice(sourceColumnIndex + 1, 0, {
    title: '绩效规则',
    key: 'rule',
    width: 170,
    render: (_, record) => <CompactCell primary={record.ruleName} secondary={record.ruleVersion} />
  });

  return columns;
}

function PerformanceDetailDrawer({
  drawingTaskRecords,
  onClose,
  record
}: {
  drawingTaskRecords: PerformanceDrawingTaskMonthlyRecord[];
  onClose: () => void;
  record: PerformanceMonthlyCategoryRecord | null;
}) {
  const drawingTaskDetail = record ? getDrawingTaskDetail(record, drawingTaskRecords) : undefined;
  const operationRecords = record ? getCategoryOperationRecords(record) : [];

  return (
    <DetailDrawerShell
      bodyTestId="performance-detail-drawer"
      className="performance-monthly-drawer"
      closeAction={{ label: '关闭', onClick: onClose }}
      open={Boolean(record)}
      title={
        record ? (
          <DetailDrawerTitle subtitle={`${record.category} / ${record.ruleVersion}`} title={`${record.employeeName} ${record.performanceMonth} 绩效明细`} />
        ) : null
      }
      width={900}
      onClose={onClose}
    >
      {record ? (
        <div className="rule-readonly-stack performance-monthly-detail-stack">
          <DetailSummaryCards
            columns={4}
            items={[
              { icon: <TeamOutlined />, key: 'employee', label: '员工', value: record.employeeName },
              { icon: <ProfileOutlined />, key: 'month', label: '绩效周期', value: record.performanceMonth },
              { icon: <PartitionOutlined />, key: 'category', label: '绩效类别', value: record.category },
              { icon: <WalletOutlined />, key: 'amount', label: '绩效金额', value: formatMoney(record.monthlyAmount) }
            ]}
          />

          <DetailTabs
            tabTestIdPrefix="performance-detail-drawer-tab"
            testId="performance-detail-drawer-tabs"
            items={[
              {
                key: 'basic',
                label: '基础信息',
                children: (
                  <DetailSection icon={<ProfileOutlined />} title="基础信息">
                    <DetailInfoGrid
                      columns={3}
                      items={[
                        { label: '员工', value: `${record.employeeName} / ${record.workNo}` },
                        { label: '岗位', value: `${record.position} / ${record.department}` },
                        { label: '绩效周期', value: record.performanceMonth },
                        { label: '绩效类别', value: record.category },
                        { label: '绩效规则', value: `${record.ruleName} / ${record.ruleVersion}` },
                        { label: '来源', value: record.sourceLabel },
                        ...(record.executionContract
                          ? [
                              { label: '执行契约', value: record.executionContract.status },
                              {
                                label: '签署依据',
                                value: record.executionContract.signedRuleVersion
                                  ? `${record.executionContract.signedRuleName ?? record.executionContract.ruleName} / ${record.executionContract.signedAt ?? '-'}`
                                  : record.executionContract.note
                              },
                              {
                                label: '适用范围',
                                value: record.executionContract.applicablePositions.length > 0
                                  ? record.executionContract.applicablePositions.join(' / ')
                                  : '-'
                              }
                            ]
                          : []),
                        ...(record.employmentScope
                          ? [
                              {
                                label: '计绩区间',
                                value: `${record.employmentScope.effectiveStartDate} 至 ${record.employmentScope.effectiveEndDate}`
                              },
                              {
                                label: '计绩工作日',
                                value: `${record.employmentScope.effectiveWorkdays}/${record.employmentScope.monthWorkdays}`
                              }
                            ]
                          : [])
                      ]}
                    />
                  </DetailSection>
                )
              },
              {
                key: 'result',
                label: '结果金额',
                children: (
                  <DetailSection icon={<CheckCircleOutlined />} title="结果金额">
                    <DetailInfoGrid
                      columns={3}
                      items={[
                        { label: '质量分', value: formatOptionalScore(record.qualityScore) },
                        ...(typeof record.taskScore === 'number' ? [{ label: '任务完成分', value: formatScore(record.taskScore) }] : []),
                        ...(record.prorationSummary
                          ? [
                              { label: '满分口径', value: formatScore(record.prorationSummary.fullScore) },
                              { label: '达标线', value: formatScore(record.prorationSummary.baseLineScore) },
                              { label: '基础绩效上限', value: formatMoney(record.prorationSummary.basePerformanceAmount) }
                            ]
                          : []),
                        { label: '绩效金额', value: formatMoney(record.monthlyAmount) },
                        { label: '预发金额', value: formatMoney(record.prepayAmount) },
                        { label: '说明', value: record.note }
                      ]}
                    />
                  </DetailSection>
                )
              },
              {
                key: 'source',
                label: '来源明细',
                children: (
                  <DetailSection icon={<FileSearchOutlined />} title="来源明细">
                    <DetailInfoGrid
                      columns={3}
                      items={[
                        { label: '来源', value: record.sourceLabel },
                        { label: '来源记录', value: formatSourceCount(record.sourceTaskCount) },
                        ...(drawingTaskDetail
                          ? [
                              { label: '预发比例', value: formatRatio(drawingTaskDetail.amountSummary.prepayRatio) },
                              { label: '复核结算', value: drawingTaskDetail.amountSummary.settlementNote }
                            ]
                          : [{ label: '说明', value: record.note }])
                      ]}
                    />
                  </DetailSection>
                )
              },
              {
                key: 'records',
                label: '处理记录',
                children:
                  operationRecords.length > 0 ? (
                    <OperationRecordSection icon={<AuditOutlined />} records={operationRecords} title="处理记录" />
                  ) : (
                    <Empty description="暂无处理记录" />
                  )
              }
            ]}
          />
        </div>
      ) : null}
    </DetailDrawerShell>
  );
}

export function PerformanceMonthlyPage() {
  const [filters, setFilters] = useState<PerformanceMonthlyFilters>(defaultFilters);
  const [activeTab, setActiveTab] = useState<PerformanceDetailTabKey>('综合');
  const [selectedRecord, setSelectedRecord] = useState<PerformanceMonthlyCategoryRecord | null>(null);
  const { peopleRows } = usePeopleOrganizationState();
  const { annualExceptionRows, workCalendarRows } = useWorkCalendarState();
  const performanceMonthlyRecords = useMemo(
    () =>
      buildPerformanceMonthlyRecords({
        annualExceptionRows,
        categoryRecords: performanceMonthlyCategoryRecords,
        drawingTaskRecords: performanceDrawingTaskMonthlyRecords,
        peopleRows,
        ruleOptions: signatureRuleOptions,
        ruleRows: performanceRulePresets,
        signatureEmployees: performanceSignatureEmployees,
        workCalendarRows
      }),
    [annualExceptionRows, peopleRows, workCalendarRows]
  );

  const employeeOptions = useMemo(
    () => ['全部', ...Array.from(new Set(performanceMonthlyRecords.categoryRecords.map((record) => record.employeeName)))],
    [performanceMonthlyRecords.categoryRecords]
  );
  const performanceRange = useMemo(() => getDateScopeRange(filters.performanceTime, performanceDetailDefaultMonth), [filters.performanceTime]);

  const baseDetailRecords = useMemo(
    () =>
      performanceMonthlyRecords.categoryRecords
        .filter((record) => monthlyCategoryRecordMatchesFilters(record, filters, performanceRange))
        .sort(
          (left, right) =>
            right.performanceMonth.localeCompare(left.performanceMonth) ||
            left.employeeName.localeCompare(right.employeeName, 'zh-CN') ||
            left.category.localeCompare(right.category, 'zh-CN') ||
            right.monthlyAmount - left.monthlyAmount
        ),
    [filters, performanceMonthlyRecords.categoryRecords, performanceRange]
  );
  const detailRecords = useMemo(() => getPerformanceRecordsForTab(activeTab, baseDetailRecords), [activeTab, baseDetailRecords]);

  const employeeCount = useMemo(() => new Set(detailRecords.map((record) => record.workNo)).size, [detailRecords]);
  const monthlyAmountTotal = detailRecords.reduce((total, record) => total + record.monthlyAmount, 0);
  const prepayAmountTotal = detailRecords.reduce((total, record) => total + record.prepayAmount, 0);

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<TeamOutlined />} label="绩效员工" value={employeeCount} />
          <MetricCard icon={<FileSearchOutlined />} label="绩效明细" value={detailRecords.length} />
          <MetricCard icon={<WalletOutlined />} label="绩效总额" value={formatMoney(monthlyAmountTotal)} />
          <MetricCard icon={<CalculatorOutlined />} label="预发金额" value={formatMoney(prepayAmountTotal)} />
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
                onChange={(employee: MonthlyEmployeeFilter) => setFilters((current) => ({ ...current, employee }))}
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
        variant="section"
        items={performanceDetailTabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          children: (() => {
            const tabRecords = getPerformanceRecordsForTab(tab.key, baseDetailRecords);

            return (
              <ManagementTable<PerformanceMonthlyCategoryRecord>
                columns={getPerformanceDetailColumns(tab.key)}
                count={{ value: tabRecords.length, unit: '条绩效明细' }}
                dataSource={tabRecords}
                rowKey="id"
                rowTestIdPrefix={`performance-detail-table-row-${tab.testIdKey}`}
                tableTestId={`performance-detail-table-${tab.testIdKey}`}
                onRowClick={setSelectedRecord}
              />
            );
          })()
        }))}
        onChange={(key) => setActiveTab(key as PerformanceDetailTabKey)}
      />

      <PerformanceDetailDrawer
        drawingTaskRecords={performanceMonthlyRecords.drawingTaskRecords}
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </ManagementPageScaffold>
  );
}

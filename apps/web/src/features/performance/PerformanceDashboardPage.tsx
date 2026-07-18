import {
  BarChartOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
  LineChartOutlined,
  PieChartOutlined,
  TeamOutlined,
  WarningOutlined,
  WalletOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useMemo, useState, type CSSProperties } from 'react';
import { DashboardPanel } from '../../components/DashboardPanel';
import { DatePeriodRangeFilter } from '../../components/DateFilterFields';
import { StatusTag, type StatusTagTone } from '../../components/Detail';
import { FilterBar, FilterPanel } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CellText, CompactCell } from '../../components/TableCell';
import { usePerformanceRuleState } from './PerformanceRuleState';
import {
  buildPerformanceDashboardData,
  buildPerformanceDashboardPeriodRange,
  type PerformanceDashboardDistributionItem,
  type PerformanceDashboardEmployeeRow,
  type PerformanceDashboardPeriodMode,
  type PerformanceDashboardRiskLevel,
  type PerformanceDashboardRiskRow,
  type PerformanceDashboardTrendPoint
} from './performanceDashboardModel';
import { usePerformanceResults } from './usePerformanceResults';

type PerformanceDashboardCustomRange = {
  endDate: string;
  startDate: string;
};

type DashboardBarStyle = CSSProperties & {
  '--performance-dashboard-bar-width'?: string;
};

const performanceDashboardToday = '2026-06-15';
const performanceDashboardNow = '2026-06-15 10:00';
const defaultPerformanceDashboardPeriodMode: PerformanceDashboardPeriodMode = 'month';
const defaultPerformanceDashboardPeriodRange = buildPerformanceDashboardPeriodRange(
  defaultPerformanceDashboardPeriodMode,
  performanceDashboardToday
);

const riskToneMap: Record<PerformanceDashboardRiskLevel, StatusTagTone> = {
  high: 'red',
  low: 'gray',
  medium: 'amber'
};

function formatMoney(value: number) {
  return `${value.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  })} 元`;
}

function formatScore(value: number | null) {
  if (value === null) {
    return '-';
  }

  return Number.isInteger(value) ? `${value} 分` : `${value.toFixed(1)} 分`;
}

function getBarStyle(value: number, maxValue: number): DashboardBarStyle {
  const percent = maxValue > 0 ? Math.max((value / maxValue) * 100, value > 0 ? 10 : 0) : 0;

  return { '--performance-dashboard-bar-width': `${percent}%` };
}

function getPeakTrendPoint(trend: PerformanceDashboardTrendPoint[]) {
  return trend.reduce(
    (peak, point) => (point.amount > peak.amount ? point : peak),
    trend[0] ?? {
      amount: 0,
      date: '',
      employeeCount: 0,
      label: '-',
      prepayAmount: 0,
      recordCount: 0
    }
  );
}

function PerformanceTrendPanel({ trend }: { trend: PerformanceDashboardTrendPoint[] }) {
  const maxAmount = Math.max(1, ...trend.map((point) => point.amount));
  const peakPoint = getPeakTrendPoint(trend);
  const activeMonthCount = trend.filter((point) => point.recordCount > 0).length;
  const density = trend.length <= 4 ? 'compact' : 'default';

  return (
    <DashboardPanel icon={<LineChartOutlined />} title="周期趋势">
      <div className="performance-dashboard-trend-grid" data-density={density}>
        {trend.map((point) => (
          <div className="performance-dashboard-trend-card" key={point.date}>
            <div className="performance-dashboard-trend-month">
              <span>{point.label}</span>
              <strong>{formatMoney(point.amount)}</strong>
            </div>
            <div className="performance-dashboard-trend-body">
              <span className="performance-dashboard-trend-track">
                <span className="performance-dashboard-trend-fill" style={getBarStyle(point.amount, maxAmount)} />
              </span>
              <div className="performance-dashboard-trend-metrics">
                <span>预发 {formatMoney(point.prepayAmount)}</span>
                <span>记录 {point.recordCount} 条</span>
                <span>人员 {point.employeeCount} 人</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="performance-dashboard-trend-summary">
        <span>趋势月份 {trend.length} 个</span>
        <span>峰值 {peakPoint.label} / {formatMoney(peakPoint.amount)}</span>
        <span>有记录月份 {activeMonthCount} 个</span>
      </div>
    </DashboardPanel>
  );
}

function DistributionList({ items }: { items: PerformanceDashboardDistributionItem[] }) {
  if (items.length === 0) {
    return <div className="performance-dashboard-empty-state">暂无绩效数据</div>;
  }

  return (
    <div className="performance-dashboard-distribution-list">
      {items.map((item) => (
        <div className="performance-dashboard-distribution-row" key={item.key}>
          <span className="performance-dashboard-distribution-label">{item.label}</span>
          <span className="performance-dashboard-distribution-track">
            <span className="performance-dashboard-distribution-fill" style={getBarStyle(item.percent, 100)} />
          </span>
          <span className="performance-dashboard-distribution-value">{formatMoney(item.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function PerformanceDistributionPanel({
  categoryItems,
  positionItems,
  ruleVersionItems
}: {
  categoryItems: PerformanceDashboardDistributionItem[];
  positionItems: PerformanceDashboardDistributionItem[];
  ruleVersionItems: PerformanceDashboardDistributionItem[];
}) {
  return (
    <DashboardPanel icon={<PieChartOutlined />} title="绩效分布">
      <div className="performance-dashboard-distribution-grid">
        <section>
          <div className="performance-dashboard-subtitle">绩效类别</div>
          <DistributionList items={categoryItems} />
        </section>
        <section>
          <div className="performance-dashboard-subtitle">岗位</div>
          <DistributionList items={positionItems} />
        </section>
        <section>
          <div className="performance-dashboard-subtitle">规则版本</div>
          <DistributionList items={ruleVersionItems} />
        </section>
      </div>
    </DashboardPanel>
  );
}

export function PerformanceDashboardPage() {
  const [periodMode, setPeriodMode] = useState<PerformanceDashboardPeriodMode>(defaultPerformanceDashboardPeriodMode);
  const [customRange, setCustomRange] = useState<PerformanceDashboardCustomRange>(() => ({
    endDate: defaultPerformanceDashboardPeriodRange.endDate,
    startDate: defaultPerformanceDashboardPeriodRange.startDate
  }));
  const { publishedMonthlyRecords } = usePerformanceResults();
  const { performanceRuleRows } = usePerformanceRuleState();

  const selectedPeriodRange = useMemo(
    () =>
      buildPerformanceDashboardPeriodRange(periodMode, performanceDashboardToday, {
        endDate: customRange.endDate,
        startDate: customRange.startDate
      }),
    [customRange.endDate, customRange.startDate, periodMode]
  );

  const dashboard = useMemo(
    () =>
      buildPerformanceDashboardData({
        monthlyRecords: publishedMonthlyRecords,
        periodRange: selectedPeriodRange,
        ruleRows: performanceRuleRows,
        today: performanceDashboardToday
      }),
    [performanceRuleRows, publishedMonthlyRecords, selectedPeriodRange]
  );

  const riskColumns = useMemo<TableColumnsType<PerformanceDashboardRiskRow>>(
    () => [
      {
        title: '对象',
        dataIndex: 'objectName',
        width: 220,
        render: (_, record) => <CompactCell primary={record.objectName} secondary={record.objectMeta} />
      },
      {
        title: '风险',
        dataIndex: 'riskText',
        align: 'center',
        width: 150,
        render: (_, record) => <StatusTag tone={riskToneMap[record.riskLevel]} value={record.riskText} variant="compact" />
      },
      {
        title: '依据',
        dataIndex: 'basis',
        width: 130,
        render: (value: string) => <CellText>{value}</CellText>
      },
      {
        title: '金额',
        dataIndex: 'amountImpact',
        align: 'right',
        width: 120,
        render: (value: number) => <CellText tone={value > 0 ? 'strong' : 'subtle'}>{value > 0 ? formatMoney(value) : '-'}</CellText>
      }
    ],
    []
  );

  const employeeColumns = useMemo<TableColumnsType<PerformanceDashboardEmployeeRow>>(
    () => [
      {
        title: '员工',
        dataIndex: 'employeeName',
        width: 220,
        render: (_, record) => <CompactCell primary={record.employeeName} secondary={`${record.position} / ${record.categories.join('、')}`} />
      },
      {
        title: '绩效金额',
        dataIndex: 'monthlyAmount',
        align: 'right',
        width: 120,
        render: (value: number) => <CellText>{formatMoney(value)}</CellText>
      },
      {
        title: '预发金额',
        dataIndex: 'prepayAmount',
        align: 'right',
        width: 120,
        render: (value: number) => <CellText>{formatMoney(value)}</CellText>
      },
      {
        title: '来源任务',
        dataIndex: 'sourceTaskCount',
        align: 'center',
        width: 92,
        render: (value: number) => <CellText tone={value > 0 ? 'strong' : 'subtle'}>{value > 0 ? `${value} 条` : '-'}</CellText>
      },
      {
        title: '质量均分',
        dataIndex: 'averageQualityScore',
        align: 'center',
        width: 92,
        render: (value: number | null) => <CellText tone={value !== null && value < 80 ? 'risk' : 'strong'}>{formatScore(value)}</CellText>
      }
    ],
    []
  );

  return (
    <ManagementPageScaffold
      pageId="performance-dashboard"
      metrics={
        <MetricGrid columns={3} density="compact">
          <MetricCard icon={<WalletOutlined />} label="周期绩效" value={formatMoney(dashboard.metrics.periodAmount)} />
          <MetricCard icon={<CheckCircleOutlined />} label="周期预发" value={formatMoney(dashboard.metrics.periodPrepayAmount)} />
          <MetricCard icon={<TeamOutlined />} label="绩效人数" value={dashboard.metrics.employeeCount} />
          <MetricCard icon={<FileProtectOutlined />} label="绩效记录" value={dashboard.metrics.recordCount} />
          <MetricCard icon={<BarChartOutlined />} label="质量均分" value={formatScore(dashboard.metrics.averageQualityScore)} />
          <MetricCard icon={<WarningOutlined />} label="当前异常" value={dashboard.metrics.currentExceptionCount} />
        </MetricGrid>
      }
      overview={
        <div className="performance-dashboard-meta">
          <span>统计周期 {dashboard.period.label}</span>
          <span>截至 {performanceDashboardNow}</span>
          <span>已发布规则 {dashboard.metrics.publishedRules} 个</span>
          <span>来源任务 {dashboard.metrics.sourceTaskCount} 条</span>
        </div>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <DatePeriodRangeFilter
              customRange={customRange}
              mode={periodMode}
              onCustomRangeChange={setCustomRange}
              onModeChange={setPeriodMode}
            />
          </FilterBar>
        </FilterPanel>
      }
    >
      <div className="performance-dashboard-layout">
        <div className="performance-dashboard-main-column">
          <PerformanceTrendPanel trend={dashboard.trend} />
          <ManagementTable<PerformanceDashboardRiskRow>
            columns={riskColumns}
            count={{ value: dashboard.riskRows.length, unit: '项' }}
            dataSource={dashboard.riskRows.slice(0, 6)}
            rowKey="id"
            rowTestIdPrefix="performance-dashboard-risk-row"
            scrollX={false}
            tableTestId="performance-dashboard-risk-table"
            title={
              <>
                <WarningOutlined /> 风险摘要
              </>
            }
          />
        </div>

        <div className="performance-dashboard-side-column">
          <PerformanceDistributionPanel
            categoryItems={dashboard.categoryDistribution}
            positionItems={dashboard.positionDistribution}
            ruleVersionItems={dashboard.ruleVersionDistribution}
          />
        </div>

        <div className="performance-dashboard-wide-row">
          <ManagementTable<PerformanceDashboardEmployeeRow>
            columns={employeeColumns}
            count={{ value: dashboard.employeeRows.length, unit: '人' }}
            dataSource={dashboard.employeeRows}
            rowKey="id"
            rowTestIdPrefix="performance-dashboard-employee-row"
            tableTestId="performance-dashboard-employee-table"
            title={
              <>
                <TeamOutlined /> 员工摘要
              </>
            }
          />
        </div>
      </div>
    </ManagementPageScaffold>
  );
}

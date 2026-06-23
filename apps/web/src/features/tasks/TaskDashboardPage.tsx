import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  LineChartOutlined,
  MessageOutlined,
  PieChartOutlined,
  ReloadOutlined,
  TeamOutlined,
  WarningOutlined
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
import { useCustomerManagementState } from '../customers/CustomerManagementState';
import { useTaskConfigState } from '../system/TaskConfigState';
import { taskManagementNow, taskManagementToday, useTaskManagementState } from './TaskManagementState';
import {
  buildTaskDashboardData,
  buildTaskDashboardPeriodRange,
  type TaskDashboardDistributionItem,
  type TaskDashboardLoadRow,
  type TaskDashboardPeriodMode,
  type TaskDashboardPeriodRange,
  type TaskDashboardRiskLevel,
  type TaskDashboardRiskRow,
  type TaskDashboardTrendPoint
} from './taskDashboardModel';

const riskLevelTone: Record<TaskDashboardRiskLevel, StatusTagTone> = {
  high: 'red',
  low: 'gray',
  medium: 'amber'
};

const defaultTaskDashboardPeriodMode: TaskDashboardPeriodMode = 'month';
const defaultTaskDashboardPeriodRange = buildTaskDashboardPeriodRange(defaultTaskDashboardPeriodMode, taskManagementToday);

type TaskDashboardCustomRange = {
  endDate: string;
  startDate: string;
};

type DashboardBarStyle = CSSProperties & {
  '--task-dashboard-bar-width'?: string;
};

function getColumnStyle(value: number, maxValue: number): DashboardBarStyle {
  const percent = maxValue > 0 ? Math.max((value / maxValue) * 100, value > 0 ? 12 : 0) : 0;

  return { '--task-dashboard-bar-width': `${percent}%` };
}

function getPeakPoint(trend: TaskDashboardTrendPoint[], key: 'completed' | 'created') {
  return trend.reduce(
    (peak, point) => (point[key] > peak[key] ? point : peak),
    trend[0] ?? { completed: 0, created: 0, date: '', label: '-' }
  );
}

function getTrendAxisLabel(label: string, granularity: TaskDashboardPeriodRange['trendGranularity']) {
  if (granularity === 'month') {
    return label;
  }

  return label.split('-')[1] ?? label;
}

function TaskTrendPanel({ period, trend }: { period: TaskDashboardPeriodRange; trend: TaskDashboardTrendPoint[] }) {
  const maxValue = Math.max(1, ...trend.flatMap((point) => [point.created, point.completed]));
  const title = '周期趋势';
  const createdPeak = getPeakPoint(trend, 'created');
  const completedPeak = getPeakPoint(trend, 'completed');
  const activeCount = trend.filter((point) => point.created > 0 || point.completed > 0).length;
  const activeLabel = period.trendGranularity === 'month' ? '活跃月份' : '活跃日期';
  const activeUnit = period.trendGranularity === 'month' ? '个月' : '天';

  return (
    <DashboardPanel icon={<LineChartOutlined />} title={title}>
      <div className="task-dashboard-trend-legend">
        <span data-tone="created">新增</span>
        <span data-tone="completed">完成</span>
      </div>
      <div className="task-dashboard-trend-chart" data-granularity={period.trendGranularity}>
        {trend.map((point, index) => {
          const shouldShowAxisLabel =
            period.trendGranularity === 'month' || index === 0 || index === trend.length - 1 || (index + 1) % 5 === 0;

          return (
            <div className="task-dashboard-trend-column" key={point.date} title={`${point.label} / 新增 ${point.created} / 完成 ${point.completed}`}>
              <div className="task-dashboard-trend-bars">
                <span className="task-dashboard-trend-bar" data-tone="created" style={getColumnStyle(point.created, maxValue)} />
                <span className="task-dashboard-trend-bar" data-tone="completed" style={getColumnStyle(point.completed, maxValue)} />
              </div>
              <span className="task-dashboard-trend-axis-label">{shouldShowAxisLabel ? getTrendAxisLabel(point.label, period.trendGranularity) : ''}</span>
            </div>
          );
        })}
      </div>
      <div className="task-dashboard-trend-summary">
        <span>新增峰值 {createdPeak.label} / {createdPeak.created} 项</span>
        <span>完成峰值 {completedPeak.label} / {completedPeak.completed} 项</span>
        <span>{activeLabel} {activeCount} {activeUnit}</span>
      </div>
    </DashboardPanel>
  );
}

function DistributionList({ items }: { items: TaskDashboardDistributionItem[] }) {
  return (
    <div className="task-dashboard-distribution-list">
      {items.map((item) => (
        <div className="task-dashboard-distribution-row" key={item.key}>
          <span className="task-dashboard-distribution-label">{item.label}</span>
          <span className="task-dashboard-distribution-track">
            <span className="task-dashboard-distribution-fill" style={{ '--task-dashboard-bar-width': `${item.percent}%` } as DashboardBarStyle} />
          </span>
          <span className="task-dashboard-distribution-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function TaskDistributionPanel({
  customerItems,
  statusItems,
  typeItems
}: {
  customerItems: TaskDashboardDistributionItem[];
  statusItems: TaskDashboardDistributionItem[];
  typeItems: TaskDashboardDistributionItem[];
}) {
  return (
    <DashboardPanel icon={<PieChartOutlined />} title="任务分布">
      <div className="task-dashboard-distribution-grid">
        <section>
          <div className="task-dashboard-subtitle">状态</div>
          <DistributionList items={statusItems} />
        </section>
        <section>
          <div className="task-dashboard-subtitle">任务类型</div>
          <DistributionList items={typeItems} />
        </section>
        <section>
          <div className="task-dashboard-subtitle">客户</div>
          <DistributionList items={customerItems} />
        </section>
      </div>
    </DashboardPanel>
  );
}

export function TaskDashboardPage() {
  const { brandRows, customerRows, storeRows } = useCustomerManagementState();
  const { taskConfigRows } = useTaskConfigState();
  const { clientFeedbackRows, storeTaskRows } = useTaskManagementState();
  const [periodMode, setPeriodMode] = useState<TaskDashboardPeriodMode>(defaultTaskDashboardPeriodMode);
  const [customRange, setCustomRange] = useState<TaskDashboardCustomRange>(() => ({
    endDate: defaultTaskDashboardPeriodRange.endDate,
    startDate: defaultTaskDashboardPeriodRange.startDate
  }));

  const selectedPeriodRange = useMemo(
    () =>
      buildTaskDashboardPeriodRange(periodMode, taskManagementToday, {
        endDate: customRange.endDate,
        startDate: customRange.startDate
      }),
    [customRange.endDate, customRange.startDate, periodMode]
  );

  const dashboard = useMemo(
    () =>
      buildTaskDashboardData({
        brandRows,
        clientFeedbackRows,
        customerRows,
        periodRange: selectedPeriodRange,
        storeRows,
        storeTaskRows,
        taskConfigRows
      }),
    [brandRows, clientFeedbackRows, customerRows, selectedPeriodRange, storeRows, storeTaskRows, taskConfigRows]
  );

  const riskColumns = useMemo<TableColumnsType<TaskDashboardRiskRow>>(
    () => [
      {
        title: '任务',
        dataIndex: 'taskName',
        width: 260,
        render: (_, record) => <CompactCell primary={record.taskName} secondary={`${record.taskCode} / ${record.contextLabel}`} />
      },
      {
        title: '风险',
        dataIndex: 'riskText',
        align: 'center',
        width: 108,
        render: (_, record) => <StatusTag tone={riskLevelTone[record.riskLevel]} value={record.riskText} variant="compact" />
      },
      {
        title: '执行人',
        dataIndex: 'executorName',
        align: 'center',
        width: 90
      },
      {
        title: '计划交付',
        dataIndex: 'plannedDeliveryAt',
        align: 'center',
        width: 112
      }
    ],
    []
  );

  const loadColumns = useMemo<TableColumnsType<TaskDashboardLoadRow>>(
    () => [
      {
        title: '执行人',
        dataIndex: 'executorName',
        width: 140
      },
      {
        title: '当前任务',
        dataIndex: 'activeCount',
        align: 'center',
        width: 88,
        render: (value: number) => <CellText>{value} 项</CellText>
      },
      {
        title: '已逾期',
        dataIndex: 'overdueCount',
        align: 'center',
        width: 88,
        render: (value: number) => <CellText tone={value > 0 ? 'risk' : 'subtle'}>{value} 项</CellText>
      }
    ],
    []
  );

  return (
    <ManagementPageScaffold
      pageId="tasks-dashboard"
      metrics={
        <MetricGrid columns={6} density="compact">
          <MetricCard icon={<FileTextOutlined />} label="周期任务" value={dashboard.metrics.total} />
          <MetricCard icon={<CheckCircleOutlined />} label="周期完成" value={dashboard.metrics.completedInPeriod} />
          <MetricCard icon={<ReloadOutlined />} label="当前未闭环" value={dashboard.metrics.active} />
          <MetricCard icon={<ClockCircleOutlined />} label="当前待提交" value={dashboard.metrics.pendingSubmit} />
          <MetricCard icon={<WarningOutlined />} label="当前已逾期" value={dashboard.metrics.overdue} />
          <MetricCard icon={<MessageOutlined />} label="周期甲方反馈" value={dashboard.metrics.clientFeedback} />
        </MetricGrid>
      }
      overview={
        <div className="task-dashboard-meta">
          <span>统计周期 {dashboard.period.label}</span>
          <span>截至 {taskManagementNow}</span>
          <span>当前待验收 {dashboard.metrics.pendingAcceptance} 项</span>
          <span>周期驳回 {dashboard.metrics.reworkCount} 次</span>
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
      <div className="task-dashboard-layout">
        <div className="task-dashboard-main-column">
          <TaskTrendPanel period={dashboard.period} trend={dashboard.trend} />
          <ManagementTable<TaskDashboardRiskRow>
            columns={riskColumns}
            count={{ value: dashboard.riskRows.length, unit: '项' }}
            dataSource={dashboard.riskRows.slice(0, 5)}
            rowKey="id"
            rowTestIdPrefix="task-dashboard-risk-row"
            scrollX={false}
            tableTestId="task-dashboard-risk-table"
            title={
              <>
                <WarningOutlined /> 风险摘要
              </>
            }
          />
        </div>

        <div className="task-dashboard-side-column">
          <TaskDistributionPanel
            customerItems={dashboard.customerDistribution}
            statusItems={dashboard.statusDistribution}
            typeItems={dashboard.taskTypeDistribution}
          />
          <ManagementTable<TaskDashboardLoadRow>
            columns={loadColumns}
            count={{ value: dashboard.loadRows.length, unit: '人' }}
            dataSource={dashboard.loadRows}
            rowKey="id"
            rowTestIdPrefix="task-dashboard-load-row"
            scrollX={false}
            tableTestId="task-dashboard-load-table"
            title={
              <>
                <TeamOutlined /> 人员负载
              </>
            }
          />
        </div>
      </div>
    </ManagementPageScaffold>
  );
}

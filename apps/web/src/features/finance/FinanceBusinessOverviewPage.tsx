import {
  LineChartOutlined,
  ProfileOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Segmented } from 'antd';
import type { TableColumnsType } from 'antd';
import { type CSSProperties, useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import {
  DateScopeFilter,
  getDateScopeMonthRange,
  getDateScopeRange,
  type DateScopeFilterValue
} from '../../components/DateFilterFields';
import { DashboardPanel } from '../../components/DashboardPanel';
import { FilterBar, FilterField, FilterPanel } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { CellText, type CellTextTone } from '../../components/TableCell';
import { usePublicAccountConfigState } from '../system/PublicAccountConfigState';
import { useFinanceManagement } from './FinanceManagementState';
import { useFinanceLedgerInitialization } from './FinanceLedgerInitializationState';
import {
  buildFinanceBusinessOverview,
  financeBusinessOverviewDefaultMonth,
  type FinanceBusinessOverviewBasis,
  type FinanceBusinessOverviewCategoryRow,
  type FinanceBusinessOverviewComparison,
  type FinanceBusinessOverviewMetric,
  type FinanceBusinessOverviewPublicAccountBaseline,
  type FinanceBusinessOverviewStatusItem
} from './financeBusinessOverviewModel';
import { buildPublicAccountOpeningBalances } from './financePublicAccountBalanceModel';
import { formatMoney } from './financeUtils';

type BusinessOverviewDateScope = DateScopeFilterValue;

const defaultBusinessOverviewDateScope: BusinessOverviewDateScope = { mode: 'currentMonth' };
const defaultBusinessOverviewMonthRange = getDateScopeMonthRange(financeBusinessOverviewDefaultMonth);

const businessOverviewBasisOptions: Array<{ label: string; value: FinanceBusinessOverviewBasis }> = [
  { label: '经营确认', value: 'business-confirmation' },
  { label: '现金流水', value: 'cash-flow' }
];

function formatPercent(value: number) {
  return `${(value * 100).toLocaleString('zh-CN', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

function formatMetricValue(metric: FinanceBusinessOverviewMetric) {
  return metric.type === 'rate' ? formatPercent(metric.value) : formatMoney(metric.value);
}

function formatStatusValue(item: FinanceBusinessOverviewStatusItem) {
  return item.valueType === 'count' ? `${item.value} 条` : formatMoney(item.value);
}

function formatComparison(comparison?: FinanceBusinessOverviewComparison) {
  if (!comparison || comparison.value === undefined) {
    return '-';
  }

  if (comparison.mode === 'point') {
    const value = comparison.value * 100;
    const sign = value > 0 ? '+' : '';

    return `${sign}${value.toLocaleString('zh-CN', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} 个点`;
  }

  const value = comparison.value * 100;
  const sign = value > 0 ? '+' : '';

  return `${sign}${value.toLocaleString('zh-CN', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

function getComparisonTone(comparison?: FinanceBusinessOverviewComparison) {
  if (!comparison || comparison.value === undefined || comparison.value === 0) {
    return 'flat';
  }

  return comparison.value > 0 ? 'up' : 'down';
}

function getPeriodLabel(value: BusinessOverviewDateScope) {
  if (value.mode === 'all') {
    return '全部期间';
  }

  if (value.mode === 'currentMonth') {
    return `${financeBusinessOverviewDefaultMonth} 当月`;
  }

  if (value.mode === 'month') {
    return value.month;
  }

  const range = getDateScopeRange(value, financeBusinessOverviewDefaultMonth);

  return range ? `${range.startDate} 至 ${range.endDate}` : '全部期间';
}

function getStatusPanelTitle(basis: FinanceBusinessOverviewBasis, value: BusinessOverviewDateScope) {
  const title = basis === 'business-confirmation' ? '确认状态' : '资金状态';

  return `${title} · ${getPeriodLabel(value)}`;
}

function getMetricCardTone(metric: FinanceBusinessOverviewMetric) {
  if (metric.tone === 'income') return 'income';
  if (metric.tone === 'expense') return 'expense';
  if (metric.tone === 'muted') return 'muted';

  return 'default';
}

function renderAmount(amount: number, tone?: CellTextTone) {
  return <CellText tone={tone ?? (amount > 0 ? 'income' : 'muted')}>{formatMoney(amount)}</CellText>;
}

function renderPercent(value: number) {
  return <CellText tone="subtle">{formatPercent(value)}</CellText>;
}

function createCategoryColumns(amountTitle: string, amountTone: CellTextTone): TableColumnsType<FinanceBusinessOverviewCategoryRow> {
  return [
    {
      dataIndex: 'primaryName',
      fixed: 'left',
      render: (primaryName: string) => <CellText>{primaryName}</CellText>,
      title: '一级类目',
      width: 150
    },
    {
      dataIndex: 'secondaryName',
      render: (secondaryName: string) => <CellText>{secondaryName}</CellText>,
      title: '二级类目',
      width: 150
    },
    {
      dataIndex: 'amount',
      render: (amount: number) => renderAmount(amount, amountTone),
      title: amountTitle,
      width: 136
    },
    {
      dataIndex: 'percent',
      render: (percent: number) => renderPercent(percent),
      title: '占比',
      width: 92
    },
    {
      dataIndex: 'sourceCount',
      render: (sourceCount: number) => <CellText>{sourceCount} 条</CellText>,
      title: '来源',
      width: 92
    }
  ];
}

function BusinessOverviewMetricStrip({ metrics }: { metrics: FinanceBusinessOverviewMetric[] }) {
  const gridStyle = { '--business-overview-stat-count': metrics.length } as CSSProperties;

  return (
    <div className="business-overview-stat-grid" style={gridStyle}>
      {metrics.map((metric) => (
        <div className="business-overview-stat-card" data-tone={getMetricCardTone(metric)} key={metric.key}>
          <span className="business-overview-stat-label">{metric.label}</span>
          <strong className="business-overview-stat-value">{formatMetricValue(metric)}</strong>
          <div className="business-overview-stat-change">
            <span data-tone={getComparisonTone(metric.monthOverMonth)}>环比 {formatComparison(metric.monthOverMonth)}</span>
            <span data-tone={getComparisonTone(metric.yearOverYear)}>同比 {formatComparison(metric.yearOverYear)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BusinessOverviewStatusStrip({ items }: { items: FinanceBusinessOverviewStatusItem[] }) {
  return (
    <div className="business-overview-status-summary">
      {items.map((item) => (
        <div className="business-overview-status-card" data-tone={item.tone} key={item.key}>
          <span className="business-overview-status-label">{item.label}</span>
          <strong className="business-overview-status-value">{formatStatusValue(item)}</strong>
          <span className="business-overview-status-meta">{item.meta}</span>
        </div>
      ))}
    </div>
  );
}

export function FinanceBusinessOverviewPage() {
  const { financeRows, receivablePayableRows } = useFinanceManagement();
  const { enabledOpeningRows, enabledProfile } = useFinanceLedgerInitialization();
  const { publicAccounts } = usePublicAccountConfigState();
  const [basis, setBasis] = useState<FinanceBusinessOverviewBasis>('business-confirmation');
  const [dateScope, setDateScope] = useState<BusinessOverviewDateScope>(defaultBusinessOverviewDateScope);

  const publicAccountBaselines = useMemo<FinanceBusinessOverviewPublicAccountBaseline[]>(
    () => buildPublicAccountOpeningBalances(publicAccounts, enabledOpeningRows, enabledProfile?.effectivePeriod),
    [enabledOpeningRows, enabledProfile?.effectivePeriod, publicAccounts]
  );
  const range = useMemo(() => getDateScopeRange(dateScope, financeBusinessOverviewDefaultMonth), [dateScope]);
  const report = useMemo(
    () =>
      buildFinanceBusinessOverview({
        accrualRecords: receivablePayableRows,
        basis,
        financeRows,
        publicAccountBaselines,
        range
      }),
    [basis, financeRows, publicAccountBaselines, range, receivablePayableRows]
  );
  const incomeColumns = useMemo(
    () => createCategoryColumns(basis === 'business-confirmation' ? '确认金额' : '入账金额', 'income'),
    [basis]
  );
  const costColumns = useMemo(
    () => createCategoryColumns(basis === 'business-confirmation' ? '确认金额' : '出账金额', 'expense'),
    [basis]
  );
  const incomeTitle = basis === 'business-confirmation' ? '收入确认' : '现金收入';
  const costTitle = basis === 'business-confirmation' ? '成本确认' : '现金支出';

  return (
    <ManagementPageScaffold pageId="finance-business-overview">
      <FilterPanel>
        <FilterBar>
          <FilterField as="div" controlWidth="wide-select" label="经营视角">
            <Segmented<FinanceBusinessOverviewBasis>
              data-testid="finance-business-overview-basis"
              options={businessOverviewBasisOptions}
              value={basis}
              onChange={setBasis}
            />
          </FilterField>
          <DateScopeFilter
            defaultMonth={financeBusinessOverviewDefaultMonth}
            defaultRange={defaultBusinessOverviewMonthRange}
            label="经营期间"
            testIdPrefix="finance-business-overview-date"
            value={dateScope}
            onChange={setDateScope}
          />
        </FilterBar>
      </FilterPanel>

      <BusinessOverviewMetricStrip metrics={report.metrics} />

      <DashboardPanel
        className="business-overview-period-panel"
        icon={<WarningOutlined />}
        title={getStatusPanelTitle(basis, dateScope)}
      >
        <BusinessOverviewStatusStrip items={report.statusItems} />
      </DashboardPanel>

      <div className="business-overview-table-grid">
        <DashboardPanel icon={<LineChartOutlined />} title={incomeTitle}>
          <CompactDetailTable<FinanceBusinessOverviewCategoryRow>
            columns={incomeColumns}
            dataSource={report.incomeRows}
            emptyText="暂无收入数据"
            rowKey="id"
            scrollX={520}
          />
        </DashboardPanel>

        <DashboardPanel icon={<ProfileOutlined />} title={costTitle}>
          <CompactDetailTable<FinanceBusinessOverviewCategoryRow>
            columns={costColumns}
            dataSource={report.costRows}
            emptyText="暂无成本数据"
            rowKey="id"
            scrollX={520}
          />
        </DashboardPanel>
      </div>
    </ManagementPageScaffold>
  );
}

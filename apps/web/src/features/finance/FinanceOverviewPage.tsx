import {
  BankOutlined,
  LineChartOutlined,
  ProfileOutlined,
  SwapOutlined,
  WalletOutlined,
  WarningOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useMemo } from 'react';
import { DashboardPanel } from '../../components/DashboardPanel';
import { StatusTag } from '../../components/Detail';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CellText, CompactCell, type CellTextTone } from '../../components/TableCell';
import { getDefaultPublicAccount, usePublicAccountConfigState } from '../system/PublicAccountConfigState';
import { useFinanceManagement } from './FinanceManagementState';
import type { FinanceReportAggregation, FinanceTransactionRecord } from './financeData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import {
  financeReceivablePayableRecords,
  getReceivablePayableOutstandingAmount
} from './financeReceivablesPayablesData';
import {
  collectionStatusTone,
  financeToday,
  formatMoney,
  getFinanceRecordCategorySnapshot,
  getPublicAccountSignedAmount
} from './financeUtils';

type FinanceCategorySummaryRow = {
  count: number;
  expense: number;
  id: FinanceReportAggregation;
  income: number;
  net: number;
};

type FinanceFocusItem = {
  id: string;
  label: string;
  meta: string;
  status: 'normal' | 'warning' | 'success';
  value: string;
};

const currentPeriod = financeToday.slice(0, 7);
const reportAggregationOrder: FinanceReportAggregation[] = ['经营收入', '项目成本', '人员支出', '运营费用', '资金处理', '其他'];
const pendingCollectionStatuses = new Set(['待转入对公', '部分转入对公', '待存入对公', '待报销']);

function isActiveRecord(record: FinanceTransactionRecord) {
  return record.status !== '已作废';
}

function isCurrentPeriod(record: FinanceTransactionRecord) {
  return record.accountingPeriod === currentPeriod;
}

function isReportRecord(record: FinanceTransactionRecord) {
  const category = getFinanceRecordCategorySnapshot(record);
  return category.includeInReport && record.direction !== '内部转入';
}

function isCurrentAccrualRecord(record: FinanceReceivablePayableRecord) {
  return record.accountingPeriod === currentPeriod;
}

function isPublicAccountMovement(record: FinanceTransactionRecord) {
  if (!isActiveRecord(record) || record.settlementAccountType !== '对公账户') {
    return false;
  }

  return record.paymentMethod === '对公账户收款' || record.paymentMethod === '对公账户付款' || record.direction === '内部转入';
}

function getPendingCollectionAmount(record: FinanceTransactionRecord) {
  if (!pendingCollectionStatuses.has(record.collectionStatus)) {
    return 0;
  }

  return Math.max(0, record.amount - (record.collectedAmount ?? 0));
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getAmountToneFromValue(value: number): CellTextTone {
  if (value > 0) {
    return 'income';
  }

  if (value < 0) {
    return 'expense';
  }

  return 'muted';
}

function buildCategoryRows(records: FinanceReceivablePayableRecord[]) {
  const rowMap = new Map<FinanceReportAggregation, FinanceCategorySummaryRow>();

  reportAggregationOrder.forEach((aggregation) => {
    rowMap.set(aggregation, {
      count: 0,
      expense: 0,
      id: aggregation,
      income: 0,
      net: 0
    });
  });

  records.forEach((record) => {
    const current = rowMap.get(record.reportAggregation);

    if (!current) {
      return;
    }

    current.count += 1;

    if (record.direction === '应收') {
      current.income += record.amount;
    }

    if (record.direction === '应付') {
      current.expense += record.amount;
    }

    current.net = current.income - current.expense;
  });

  return Array.from(rowMap.values()).filter((row) => row.count > 0 || row.income > 0 || row.expense > 0);
}

export function FinanceOverviewPage() {
  const { financeRows } = useFinanceManagement();
  const { publicAccounts } = usePublicAccountConfigState();

  const activeRows = useMemo(() => financeRows.filter(isActiveRecord), [financeRows]);
  const publicAccountOpeningBalance = getDefaultPublicAccount(publicAccounts)?.openingBalance ?? 0;
  const currentRows = useMemo(() => activeRows.filter(isCurrentPeriod), [activeRows]);
  const currentAccrualRows = useMemo(() => financeReceivablePayableRecords.filter(isCurrentAccrualRecord), []);
  const enteredCurrentRows = useMemo(() => currentRows.filter((record) => record.status === '已入账'), [currentRows]);
  const enteredCurrentReportRows = useMemo(() => enteredCurrentRows.filter(isReportRecord), [enteredCurrentRows]);

  const cashIncome = enteredCurrentReportRows
    .filter((record) => record.direction === '收入')
    .reduce((total, record) => total + record.amount, 0);
  const cashExpense = enteredCurrentReportRows
    .filter((record) => record.direction === '支出' && record.paymentMethod !== '员工垫付')
    .reduce((total, record) => total + record.amount, 0);
  const cashNet = cashIncome - cashExpense;
  const publicAccountBalance =
    publicAccountOpeningBalance +
    activeRows
      .filter((record) => record.status === '已入账' && isPublicAccountMovement(record))
      .reduce((total, record) => total + getPublicAccountSignedAmount(record), 0);

  const accrualRevenue = currentAccrualRows.filter((record) => record.direction === '应收').reduce((total, record) => total + record.amount, 0);
  const accrualCost = currentAccrualRows.filter((record) => record.direction === '应付').reduce((total, record) => total + record.amount, 0);
  const accrualGrossProfit = accrualRevenue - accrualCost;
  const accrualGrossMargin = accrualRevenue > 0 ? accrualGrossProfit / accrualRevenue : 0;
  const receivableOutstanding = currentAccrualRows
    .filter((record) => record.direction === '应收')
    .reduce((total, record) => total + getReceivablePayableOutstandingAmount(record), 0);
  const payableOutstanding = currentAccrualRows
    .filter((record) => record.direction === '应付')
    .reduce((total, record) => total + getReceivablePayableOutstandingAmount(record), 0);
  const overdueAccrualRows = financeReceivablePayableRecords.filter((record) => record.status === '已逾期');
  const overdueAccrualAmount = overdueAccrualRows.reduce(
    (total, record) => total + getReceivablePayableOutstandingAmount(record),
    0
  );

  const pendingReviewRows = activeRows.filter((record) => record.status === '待复核');
  const pendingCollectionRows = activeRows.filter((record) => getPendingCollectionAmount(record) > 0);
  const pendingTransferAmount = pendingCollectionRows
    .filter((record) => record.collectionStatus === '待转入对公' || record.collectionStatus === '部分转入对公' || record.collectionStatus === '待存入对公')
    .reduce((total, record) => total + getPendingCollectionAmount(record), 0);
  const pendingReimburseAmount = pendingCollectionRows
    .filter((record) => record.collectionStatus === '待报销')
    .reduce((total, record) => total + getPendingCollectionAmount(record), 0);
  const unreconciledPublicRows = activeRows.filter((record) => isPublicAccountMovement(record) && record.reconciliationStatus !== '已对账');
  const categoryRows = useMemo(() => buildCategoryRows(currentAccrualRows), [currentAccrualRows]);

  const focusItems: FinanceFocusItem[] = [
    {
      id: 'accrual-overdue',
      label: '应收应付逾期',
      meta: `${overdueAccrualRows.length} 条`,
      status: overdueAccrualRows.length > 0 ? 'warning' : 'success',
      value: formatMoney(overdueAccrualAmount)
    },
    {
      id: 'review',
      label: '流水待复核',
      meta: `${pendingReviewRows.length} 条`,
      status: pendingReviewRows.length > 0 ? 'warning' : 'success',
      value: formatMoney(pendingReviewRows.reduce((total, record) => total + record.amount, 0))
    },
    {
      id: 'transfer',
      label: '待转入对公',
      meta: `${pendingCollectionRows.filter((record) => record.collectionStatus !== '待报销').length} 条`,
      status: pendingTransferAmount > 0 ? 'warning' : 'success',
      value: formatMoney(pendingTransferAmount)
    },
    {
      id: 'reimburse',
      label: '待报销',
      meta: `${pendingCollectionRows.filter((record) => record.collectionStatus === '待报销').length} 条`,
      status: pendingReimburseAmount > 0 ? 'warning' : 'success',
      value: formatMoney(pendingReimburseAmount)
    },
    {
      id: 'reconciliation',
      label: '银行未对账',
      meta: `${unreconciledPublicRows.length} 条`,
      status: unreconciledPublicRows.length > 0 ? 'warning' : 'success',
      value: `${unreconciledPublicRows.length}`
    }
  ];

  const categoryColumns: TableColumnsType<FinanceCategorySummaryRow> = [
    {
      title: '统计归集',
      dataIndex: 'id',
      width: 128
    },
    {
      title: '记录',
      dataIndex: 'count',
      width: 80,
      render: (count: number) => `${count} 条`
    },
    {
      title: '确认收入',
      dataIndex: 'income',
      width: 128,
      render: (amount: number) => <CellText tone={amount > 0 ? 'income' : 'muted'}>{formatMoney(amount)}</CellText>
    },
    {
      title: '确认成本',
      dataIndex: 'expense',
      width: 128,
      render: (amount: number) => <CellText tone={amount > 0 ? 'expense' : 'muted'}>{formatMoney(amount)}</CellText>
    },
    {
      title: '净额',
      dataIndex: 'net',
      width: 128,
      render: (amount: number) => <CellText tone={getAmountToneFromValue(amount)}>{formatMoney(amount)}</CellText>
    }
  ];

  return (
    <ManagementPageScaffold
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<WalletOutlined />} label="现金收入" value={formatMoney(cashIncome)} />
          <MetricCard icon={<WalletOutlined />} label="现金支出" value={formatMoney(cashExpense)} />
          <MetricCard icon={<LineChartOutlined />} label="净流入" value={formatMoney(cashNet)} />
          <MetricCard icon={<BankOutlined />} label="对公余额" value={formatMoney(publicAccountBalance)} />
        </MetricGrid>
      }
      pageId="finance-overview"
    >
      <div className="finance-overview-flow-grid">
        <div className="finance-overview-main-column">
          <DashboardPanel icon={<WalletOutlined />} title="现金流概览">
            <div className="finance-overview-kpi-grid">
              <div className="finance-overview-kpi">
                <span>本月收款</span>
                <strong>{formatMoney(cashIncome)}</strong>
              </div>
              <div className="finance-overview-kpi">
                <span>本月付款</span>
                <strong>{formatMoney(cashExpense)}</strong>
              </div>
              <div className="finance-overview-kpi">
                <span>净流入</span>
                <strong>{formatMoney(cashNet)}</strong>
              </div>
              <div className="finance-overview-kpi">
                <span>未对账流水</span>
                <strong>{unreconciledPublicRows.length} 条</strong>
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel icon={<LineChartOutlined />} title="经营损益（权责口径）">
            <div className="finance-overview-kpi-grid">
              <div className="finance-overview-kpi">
                <span>本月确认收入</span>
                <strong>{formatMoney(accrualRevenue)}</strong>
              </div>
              <div className="finance-overview-kpi">
                <span>本月确认成本</span>
                <strong>{formatMoney(accrualCost)}</strong>
              </div>
              <div className="finance-overview-kpi">
                <span>本月毛利</span>
                <strong>{formatMoney(accrualGrossProfit)}</strong>
              </div>
              <div className="finance-overview-kpi">
                <span>毛利率</span>
                <strong>{formatPercent(accrualGrossMargin)}</strong>
              </div>
              <div className="finance-overview-kpi">
                <span>应收未收</span>
                <strong>{formatMoney(receivableOutstanding)}</strong>
              </div>
              <div className="finance-overview-kpi">
                <span>应付未付</span>
                <strong>{formatMoney(payableOutstanding)}</strong>
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel icon={<ProfileOutlined />} title="经营类目归集">
            <ManagementTable<FinanceCategorySummaryRow>
              columns={categoryColumns}
              count={{ value: categoryRows.length, unit: '个归集项' }}
              dataSource={categoryRows}
              rowKey="id"
              tableTestId="finance-overview-category-summary-table"
            />
          </DashboardPanel>
        </div>

        <div className="finance-overview-side-column">
          <DashboardPanel icon={<WarningOutlined />} title="待处理事项">
            <div className="finance-overview-focus-list">
              {focusItems.map((item) => (
                <div className="finance-overview-focus-item" data-status={item.status} key={item.id}>
                  <div className="finance-overview-focus-copy">
                    <span>{item.label}</span>
                    <small>{item.meta}</small>
                  </div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel icon={<SwapOutlined />} title="资金处理状态">
            <div className="finance-overview-status-grid">
              {pendingCollectionRows.map((record) => (
                <div className="finance-overview-status-item" key={record.id}>
                  <CompactCell primary={record.counterparty} secondary={record.paymentMethod} />
                  <CompactCell
                    primary={formatMoney(getPendingCollectionAmount(record))}
                    secondarySlot={<StatusTag toneMap={collectionStatusTone} value={record.collectionStatus} />}
                  />
                </div>
              ))}
            </div>
          </DashboardPanel>
        </div>
      </div>
    </ManagementPageScaffold>
  );
}

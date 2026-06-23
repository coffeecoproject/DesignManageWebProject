import dayjs from 'dayjs';
import type { FinanceReportAggregation, FinanceTransactionRecord } from './financeData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import { getReceivablePayableOutstandingAmount } from './financeReceivablesPayablesData';
import { financeToday, getFinanceRecordCategorySnapshot, getPublicAccountSignedAmount } from './financeUtils';

export type FinanceBusinessOverviewBasis = 'business-confirmation' | 'cash-flow';

export type FinanceBusinessOverviewRange = {
  endDate: string;
  startDate: string;
};

export type FinanceBusinessOverviewComparison = {
  mode: 'point' | 'ratio';
  value?: number;
};

export type FinanceBusinessOverviewMetric = {
  key: string;
  label: string;
  tone: 'default' | 'expense' | 'income' | 'muted';
  type: 'amount' | 'rate';
  value: number;
  monthOverMonth?: FinanceBusinessOverviewComparison;
  yearOverYear?: FinanceBusinessOverviewComparison;
};

export type FinanceBusinessOverviewCategoryRow = {
  amount: number;
  id: string;
  percent: number;
  primaryName: string;
  reportAggregation: FinanceReportAggregation;
  secondaryName: string;
  sourceCount: number;
};

export type FinanceBusinessOverviewStatusTone = 'default' | 'success' | 'warning';

export type FinanceBusinessOverviewStatusItem = {
  key: string;
  label: string;
  meta: string;
  tone: FinanceBusinessOverviewStatusTone;
  value: number;
  valueType: 'amount' | 'count';
};

export type FinanceBusinessOverviewSummary = {
  grossMargin: number;
  grossProfit: number;
  income: number;
  netMargin: number;
  netProfit: number;
  payableOutstanding: number;
  pendingReviewAmount: number;
  receivableOutstanding: number;
  totalCost: number;
  unreconciledAmount: number;
};

export type FinanceBusinessOverviewReport = {
  basis: FinanceBusinessOverviewBasis;
  costRows: FinanceBusinessOverviewCategoryRow[];
  incomeRows: FinanceBusinessOverviewCategoryRow[];
  metrics: FinanceBusinessOverviewMetric[];
  statusItems: FinanceBusinessOverviewStatusItem[];
  summary: FinanceBusinessOverviewSummary;
};

type FinanceBusinessOverviewBuildInput = {
  accrualRecords: FinanceReceivablePayableRecord[];
  basis: FinanceBusinessOverviewBasis;
  financeRows: FinanceTransactionRecord[];
  publicAccountOpeningBalance?: number;
  range?: FinanceBusinessOverviewRange;
};

type FinanceBusinessOverviewDataset = {
  costRows: FinanceBusinessOverviewCategoryRow[];
  incomeRows: FinanceBusinessOverviewCategoryRow[];
  summary: FinanceBusinessOverviewSummary;
};

const directCostAggregations = new Set<FinanceReportAggregation>(['项目成本']);
const pendingCollectionStatuses = new Set(['待转入对公', '部分转入对公', '待存入对公', '待报销']);

export const financeBusinessOverviewDefaultMonth = financeToday.slice(0, 7);

function isActiveFinanceRecord(record: FinanceTransactionRecord) {
  return record.status !== '已作废';
}

function createEmptySummary(): FinanceBusinessOverviewSummary {
  return {
    grossMargin: 0,
    grossProfit: 0,
    income: 0,
    netMargin: 0,
    netProfit: 0,
    payableOutstanding: 0,
    pendingReviewAmount: 0,
    receivableOutstanding: 0,
    totalCost: 0,
    unreconciledAmount: 0
  };
}

function isDateInRange(date: string, range?: FinanceBusinessOverviewRange) {
  return !range || (date >= range.startDate && date <= range.endDate);
}

function isReportableAccrualRecord(record: FinanceReceivablePayableRecord, range?: FinanceBusinessOverviewRange) {
  return record.categorySnapshot.includeInReport && isDateInRange(record.confirmDate, range);
}

function isReportableCashRecord(record: FinanceTransactionRecord, range?: FinanceBusinessOverviewRange) {
  const category = getFinanceRecordCategorySnapshot(record);

  return (
    category.includeInReport &&
    record.direction !== '内部转入' &&
    record.settlementAccountType === '对公账户' &&
    record.status === '已入账' &&
    isDateInRange(record.occurredAt, range)
  );
}

function isPendingReviewCashRecord(record: FinanceTransactionRecord, range?: FinanceBusinessOverviewRange) {
  const category = getFinanceRecordCategorySnapshot(record);

  return (
    category.includeInReport &&
    record.direction !== '内部转入' &&
    record.settlementAccountType === '对公账户' &&
    record.status === '待复核' &&
    isDateInRange(record.occurredAt, range)
  );
}

function isPublicAccountMovement(record: FinanceTransactionRecord, range?: FinanceBusinessOverviewRange) {
  if (!isActiveFinanceRecord(record) || record.settlementAccountType !== '对公账户') {
    return false;
  }

  return (
    (record.paymentMethod === '对公账户收款' ||
      record.paymentMethod === '对公账户付款' ||
      record.direction === '内部转入') &&
    isDateInRange(record.occurredAt, range)
  );
}

function getPendingCollectionAmount(record: FinanceTransactionRecord) {
  if (!pendingCollectionStatuses.has(record.collectionStatus)) {
    return 0;
  }

  return Math.max(0, record.amount - (record.collectedAmount ?? 0));
}

function getStatusTone(amount: number): FinanceBusinessOverviewStatusTone {
  return amount > 0 ? 'warning' : 'success';
}

function ensureCategoryRow(
  rowMap: Map<string, FinanceBusinessOverviewCategoryRow>,
  record: Pick<FinanceReceivablePayableRecord, 'categorySnapshot'> | FinanceTransactionRecord
) {
  const snapshot =
    'categorySnapshot' in record && record.categorySnapshot
      ? record.categorySnapshot
      : getFinanceRecordCategorySnapshot(record as FinanceTransactionRecord);
  const existing = rowMap.get(snapshot.secondaryCode);

  if (existing) {
    return existing;
  }

  const row: FinanceBusinessOverviewCategoryRow = {
    amount: 0,
    id: snapshot.secondaryCode,
    percent: 0,
    primaryName: snapshot.primaryName,
    reportAggregation: snapshot.reportAggregation,
    secondaryName: snapshot.secondaryName,
    sourceCount: 0
  };
  rowMap.set(row.id, row);

  return row;
}

function normalizeCategoryRows(rowMap: Map<string, FinanceBusinessOverviewCategoryRow>, total: number) {
  return Array.from(rowMap.values())
    .map((row) => ({
      ...row,
      percent: total > 0 ? row.amount / total : 0
    }))
    .sort(
      (left, right) =>
        right.amount - left.amount ||
        left.primaryName.localeCompare(right.primaryName, 'zh-CN') ||
        left.secondaryName.localeCompare(right.secondaryName, 'zh-CN')
    );
}

function finalizeSummary(summary: FinanceBusinessOverviewSummary) {
  return {
    ...summary,
    grossMargin: summary.income > 0 ? summary.grossProfit / summary.income : 0,
    netMargin: summary.income > 0 ? summary.netProfit / summary.income : 0
  };
}

function buildAccrualDataset(
  accrualRecords: FinanceReceivablePayableRecord[],
  range?: FinanceBusinessOverviewRange
): FinanceBusinessOverviewDataset {
  const summary = createEmptySummary();
  const incomeMap = new Map<string, FinanceBusinessOverviewCategoryRow>();
  const costMap = new Map<string, FinanceBusinessOverviewCategoryRow>();

  accrualRecords.filter((record) => isReportableAccrualRecord(record, range)).forEach((record) => {
    if (record.direction === '应收') {
      const row = ensureCategoryRow(incomeMap, record);
      row.amount += record.amount;
      row.sourceCount += 1;
      summary.income += record.amount;
      summary.receivableOutstanding += getReceivablePayableOutstandingAmount(record);
      return;
    }

    const row = ensureCategoryRow(costMap, record);
    row.amount += record.amount;
    row.sourceCount += 1;
    summary.totalCost += record.amount;
    summary.payableOutstanding += getReceivablePayableOutstandingAmount(record);
  });

  const directCost = Array.from(costMap.values())
    .filter((row) => directCostAggregations.has(row.reportAggregation))
    .reduce((total, row) => total + row.amount, 0);

  summary.grossProfit = summary.income - directCost;
  summary.netProfit = summary.income - summary.totalCost;

  return {
    costRows: normalizeCategoryRows(costMap, summary.totalCost),
    incomeRows: normalizeCategoryRows(incomeMap, summary.income),
    summary: finalizeSummary(summary)
  };
}

function buildCashDataset(
  financeRows: FinanceTransactionRecord[],
  range?: FinanceBusinessOverviewRange
): FinanceBusinessOverviewDataset {
  const summary = createEmptySummary();
  const incomeMap = new Map<string, FinanceBusinessOverviewCategoryRow>();
  const costMap = new Map<string, FinanceBusinessOverviewCategoryRow>();

  financeRows.filter((record) => isReportableCashRecord(record, range)).forEach((record) => {
    if (record.direction === '收入') {
      const row = ensureCategoryRow(incomeMap, record);
      row.amount += record.amount;
      row.sourceCount += 1;
      summary.income += record.amount;
      return;
    }

    const row = ensureCategoryRow(costMap, record);
    row.amount += record.amount;
    row.sourceCount += 1;
    summary.totalCost += record.amount;
  });

  const directCost = Array.from(costMap.values())
    .filter((row) => directCostAggregations.has(row.reportAggregation))
    .reduce((total, row) => total + row.amount, 0);

  summary.grossProfit = summary.income - directCost;
  summary.netProfit = summary.income - summary.totalCost;
  summary.pendingReviewAmount = financeRows
    .filter((record) => isPendingReviewCashRecord(record, range))
    .reduce((total, record) => total + record.amount, 0);
  summary.unreconciledAmount = financeRows
    .filter((record) => isReportableCashRecord(record, range) && record.reconciliationStatus !== '已对账')
    .reduce((total, record) => total + record.amount, 0);

  return {
    costRows: normalizeCategoryRows(costMap, summary.totalCost),
    incomeRows: normalizeCategoryRows(incomeMap, summary.income),
    summary: finalizeSummary(summary)
  };
}

function buildDataset(input: FinanceBusinessOverviewBuildInput) {
  return input.basis === 'business-confirmation'
    ? buildAccrualDataset(input.accrualRecords, input.range)
    : buildCashDataset(input.financeRows, input.range);
}

function buildBusinessConfirmationStatusItems(input: FinanceBusinessOverviewBuildInput): FinanceBusinessOverviewStatusItem[] {
  const confirmationRows = input.accrualRecords.filter((record) => isReportableAccrualRecord(record, input.range));
  const receivableRows = confirmationRows.filter((record) => record.direction === '应收');
  const payableRows = confirmationRows.filter((record) => record.direction === '应付');
  const unsettledReceivableRows = receivableRows.filter((record) => getReceivablePayableOutstandingAmount(record) > 0);
  const unsettledPayableRows = payableRows.filter((record) => getReceivablePayableOutstandingAmount(record) > 0);
  const overdueRows = input.accrualRecords.filter(
    (record) => record.categorySnapshot.includeInReport && record.status === '已逾期' && isDateInRange(record.dueDate, input.range)
  );
  const overdueReceivableRows = overdueRows.filter((record) => record.direction === '应收');
  const overduePayableRows = overdueRows.filter((record) => record.direction === '应付');
  const overdueReceivableAmount = overdueReceivableRows.reduce(
    (total, record) => total + getReceivablePayableOutstandingAmount(record),
    0
  );
  const overduePayableAmount = overduePayableRows.reduce(
    (total, record) => total + getReceivablePayableOutstandingAmount(record),
    0
  );

  return [
    {
      key: 'confirmationItems',
      label: '确认事项',
      meta: `应收 ${receivableRows.length} / 应付 ${payableRows.length}`,
      tone: confirmationRows.length > 0 ? 'default' : 'success',
      value: confirmationRows.length,
      valueType: 'count'
    },
    {
      key: 'overdueReceivable',
      label: '逾期应收',
      meta: `${overdueReceivableRows.length} 条`,
      tone: getStatusTone(overdueReceivableAmount),
      value: overdueReceivableAmount,
      valueType: 'amount'
    },
    {
      key: 'overduePayable',
      label: '逾期应付',
      meta: `${overduePayableRows.length} 条`,
      tone: getStatusTone(overduePayableAmount),
      value: overduePayableAmount,
      valueType: 'amount'
    },
    {
      key: 'unsettledReceivable',
      label: '未结清应收',
      meta: `含逾期 ${overdueReceivableRows.length}`,
      tone: unsettledReceivableRows.length > 0 ? 'default' : 'success',
      value: unsettledReceivableRows.length,
      valueType: 'count'
    },
    {
      key: 'unsettledPayable',
      label: '未结清应付',
      meta: `含逾期 ${overduePayableRows.length}`,
      tone: unsettledPayableRows.length > 0 ? 'default' : 'success',
      value: unsettledPayableRows.length,
      valueType: 'count'
    }
  ];
}

function buildCashFlowStatusItems(input: FinanceBusinessOverviewBuildInput): FinanceBusinessOverviewStatusItem[] {
  const activeRows = input.financeRows.filter(isActiveFinanceRecord);
  const publicAccountBalance =
    (input.publicAccountOpeningBalance ?? 0) +
    activeRows
      .filter((record) => record.status === '已入账' && isPublicAccountMovement(record))
      .reduce((total, record) => total + getPublicAccountSignedAmount(record), 0);
  const pendingReviewRows = activeRows.filter((record) => isPendingReviewCashRecord(record, input.range));
  const pendingReviewAmount = pendingReviewRows.reduce((total, record) => total + record.amount, 0);
  const unreconciledRows = activeRows.filter(
    (record) => isPublicAccountMovement(record, input.range) && record.reconciliationStatus !== '已对账'
  );
  const unreconciledAmount = unreconciledRows.reduce((total, record) => total + record.amount, 0);
  const pendingCollectionRows = activeRows.filter(
    (record) => isDateInRange(record.occurredAt, input.range) && getPendingCollectionAmount(record) > 0
  );
  const pendingTransferRows = pendingCollectionRows.filter((record) => record.collectionStatus !== '待报销');
  const pendingReimburseRows = pendingCollectionRows.filter((record) => record.collectionStatus === '待报销');
  const pendingTransferAmount = pendingTransferRows.reduce((total, record) => total + getPendingCollectionAmount(record), 0);
  const pendingReimburseAmount = pendingReimburseRows.reduce((total, record) => total + getPendingCollectionAmount(record), 0);
  const pendingFundAmount = pendingTransferAmount + pendingReimburseAmount;

  return [
    {
      key: 'publicAccountBalance',
      label: '对公余额',
      meta: '当前账面',
      tone: 'default',
      value: publicAccountBalance,
      valueType: 'amount'
    },
    {
      key: 'pendingReview',
      label: '待复核流水',
      meta: `${pendingReviewRows.length} 条`,
      tone: getStatusTone(pendingReviewAmount),
      value: pendingReviewAmount,
      valueType: 'amount'
    },
    {
      key: 'unreconciled',
      label: '未对账流水',
      meta: `${unreconciledRows.length} 条`,
      tone: getStatusTone(unreconciledAmount),
      value: unreconciledAmount,
      valueType: 'amount'
    },
    {
      key: 'pendingFund',
      label: '待处理资金',
      meta: `转入 ${pendingTransferRows.length} / 报销 ${pendingReimburseRows.length}`,
      tone: getStatusTone(pendingFundAmount),
      value: pendingFundAmount,
      valueType: 'amount'
    }
  ];
}

function buildStatusItems(input: FinanceBusinessOverviewBuildInput): FinanceBusinessOverviewStatusItem[] {
  return input.basis === 'business-confirmation'
    ? buildBusinessConfirmationStatusItems(input)
    : buildCashFlowStatusItems(input);
}

function getPreviousPeriodRange(range?: FinanceBusinessOverviewRange) {
  if (!range) {
    return undefined;
  }

  const start = dayjs(range.startDate);
  const end = dayjs(range.endDate);
  const wholeMonth = start.date() === 1 && end.isSame(start.endOf('month'), 'day');

  if (wholeMonth) {
    const previousMonth = start.subtract(1, 'month');

    return {
      endDate: previousMonth.endOf('month').format('YYYY-MM-DD'),
      startDate: previousMonth.startOf('month').format('YYYY-MM-DD')
    };
  }

  const periodDays = end.diff(start, 'day') + 1;
  const previousEnd = start.subtract(1, 'day');
  const previousStart = previousEnd.subtract(periodDays - 1, 'day');

  return {
    endDate: previousEnd.format('YYYY-MM-DD'),
    startDate: previousStart.format('YYYY-MM-DD')
  };
}

function getPreviousYearRange(range?: FinanceBusinessOverviewRange) {
  if (!range) {
    return undefined;
  }

  return {
    endDate: dayjs(range.endDate).subtract(1, 'year').format('YYYY-MM-DD'),
    startDate: dayjs(range.startDate).subtract(1, 'year').format('YYYY-MM-DD')
  };
}

function compareAmount(current: number, previous: number): FinanceBusinessOverviewComparison {
  if (previous === 0) {
    return { mode: 'ratio', value: current === 0 ? 0 : undefined };
  }

  return {
    mode: 'ratio',
    value: (current - previous) / Math.abs(previous)
  };
}

function compareRate(current: number, previous: number): FinanceBusinessOverviewComparison {
  return {
    mode: 'point',
    value: current - previous
  };
}

function buildMetric(
  metric: Omit<FinanceBusinessOverviewMetric, 'monthOverMonth' | 'yearOverYear'>,
  previousSummary?: FinanceBusinessOverviewSummary,
  previousYearSummary?: FinanceBusinessOverviewSummary
): FinanceBusinessOverviewMetric {
  const previousValue = previousSummary ? getSummaryMetricValue(previousSummary, metric.key) : undefined;
  const previousYearValue = previousYearSummary ? getSummaryMetricValue(previousYearSummary, metric.key) : undefined;
  const compare = metric.type === 'rate' ? compareRate : compareAmount;

  return {
    ...metric,
    monthOverMonth: previousValue === undefined ? undefined : compare(metric.value, previousValue),
    yearOverYear: previousYearValue === undefined ? undefined : compare(metric.value, previousYearValue)
  };
}

function getSummaryMetricValue(summary: FinanceBusinessOverviewSummary, key: string) {
  switch (key) {
    case 'income':
      return summary.income;
    case 'cost':
      return summary.totalCost;
    case 'net':
      return summary.netProfit;
    case 'gross':
      return summary.grossProfit;
    case 'netMargin':
      return summary.netMargin;
    case 'grossMargin':
      return summary.grossMargin;
    case 'receivableOutstanding':
      return summary.receivableOutstanding;
    case 'payableOutstanding':
      return summary.payableOutstanding;
    case 'pendingReview':
      return summary.pendingReviewAmount;
    case 'unreconciled':
      return summary.unreconciledAmount;
    default:
      return undefined;
  }
}

function buildMetrics(
  basis: FinanceBusinessOverviewBasis,
  summary: FinanceBusinessOverviewSummary,
  previousSummary?: FinanceBusinessOverviewSummary,
  previousYearSummary?: FinanceBusinessOverviewSummary
) {
  const baseMetrics: Array<Omit<FinanceBusinessOverviewMetric, 'monthOverMonth' | 'yearOverYear'>> =
    basis === 'business-confirmation'
      ? [
          { key: 'income', label: '确认收入', tone: 'income', type: 'amount', value: summary.income },
          { key: 'cost', label: '确认成本', tone: 'expense', type: 'amount', value: summary.totalCost },
          { key: 'net', label: '净利润', tone: summary.netProfit >= 0 ? 'income' : 'expense', type: 'amount', value: summary.netProfit },
          { key: 'gross', label: '毛利', tone: summary.grossProfit >= 0 ? 'income' : 'expense', type: 'amount', value: summary.grossProfit },
          { key: 'netMargin', label: '净利率', tone: summary.netMargin >= 0 ? 'income' : 'expense', type: 'rate', value: summary.netMargin },
          { key: 'grossMargin', label: '毛利率', tone: summary.grossMargin >= 0 ? 'income' : 'expense', type: 'rate', value: summary.grossMargin },
          { key: 'receivableOutstanding', label: '应收未收', tone: 'muted', type: 'amount', value: summary.receivableOutstanding },
          { key: 'payableOutstanding', label: '应付未付', tone: 'muted', type: 'amount', value: summary.payableOutstanding }
        ]
      : [
          { key: 'income', label: '现金收入', tone: 'income', type: 'amount', value: summary.income },
          { key: 'cost', label: '现金支出', tone: 'expense', type: 'amount', value: summary.totalCost },
          { key: 'net', label: '净流入', tone: summary.netProfit >= 0 ? 'income' : 'expense', type: 'amount', value: summary.netProfit },
          { key: 'gross', label: '现金毛利', tone: summary.grossProfit >= 0 ? 'income' : 'expense', type: 'amount', value: summary.grossProfit },
          { key: 'netMargin', label: '净流入率', tone: summary.netMargin >= 0 ? 'income' : 'expense', type: 'rate', value: summary.netMargin },
          { key: 'grossMargin', label: '毛利率', tone: summary.grossMargin >= 0 ? 'income' : 'expense', type: 'rate', value: summary.grossMargin }
        ];

  return baseMetrics.map((metric) => buildMetric(metric, previousSummary, previousYearSummary));
}

export function buildFinanceBusinessOverview(input: FinanceBusinessOverviewBuildInput): FinanceBusinessOverviewReport {
  const current = buildDataset(input);
  const previousRange = getPreviousPeriodRange(input.range);
  const previousYearRange = getPreviousYearRange(input.range);
  const previousSummary = previousRange ? buildDataset({ ...input, range: previousRange }).summary : undefined;
  const previousYearSummary = previousYearRange ? buildDataset({ ...input, range: previousYearRange }).summary : undefined;

  return {
    basis: input.basis,
    costRows: current.costRows,
    incomeRows: current.incomeRows,
    metrics: buildMetrics(input.basis, current.summary, previousSummary, previousYearSummary),
    statusItems: buildStatusItems(input),
    summary: current.summary
  };
}

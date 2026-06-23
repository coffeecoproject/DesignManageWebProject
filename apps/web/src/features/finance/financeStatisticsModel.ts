import type { FinanceCategorySnapshot, FinanceReportAggregation, FinanceTransactionRecord } from './financeData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import { financeReceivablePayableRecords } from './financeReceivablesPayablesData';
import { financeToday, getFinanceRecordCategorySnapshot } from './financeUtils';

export type FinanceReportTabKey = 'category' | 'expense' | 'income' | 'sources';
export type FinanceStatisticsBasis = '权责口径' | '现金口径';
export type FinanceReportFilterValue = '全部';

export type FinanceReportFilters = {
  aggregation: FinanceReportFilterValue | FinanceReportAggregation;
  basis: FinanceStatisticsBasis;
  keyword: string;
  period: FinanceReportFilterValue | string;
};

export type FinanceReportSource = {
  accrualRecords: FinanceReceivablePayableRecord[];
  transactionRecords: FinanceTransactionRecord[];
};

export type FinanceCategoryStatisticsRow = FinanceReportSource & {
  basis: FinanceStatisticsBasis;
  expense: number;
  id: string;
  includeInReport: boolean;
  income: number;
  net: number;
  primaryName: string;
  reportAggregation: FinanceReportAggregation;
  secondaryName: string;
};

export type FinanceStatisticsSourceRow = FinanceReportSource & {
  aggregation: FinanceReportAggregation;
  amount: number;
  basis: FinanceStatisticsBasis;
  counterparty: string;
  direction: '应付' | '应收' | '收入' | '支出';
  id: string;
  primaryName: string;
  secondaryName: string;
  sourceNo: string;
  sourceTitle: string;
  sourceType: string;
  status: FinanceReceivablePayableRecord['status'] | FinanceTransactionRecord['status'];
};

export type FinanceReportDrawerDetail = FinanceReportSource & {
  aggregation: FinanceReportAggregation;
  basis: FinanceStatisticsBasis;
  expense: number;
  income: number;
  kind: '来源明细' | '类目统计';
  net: number;
  period: string;
  primaryName?: string;
  secondaryName?: string;
  title: string;
};

export type FinanceReportAmountTone = 'expense' | 'income' | 'muted';

export const financeStatisticsCurrentPeriod = financeToday.slice(0, 7);

export const financeStatisticsBasisOptions: FinanceStatisticsBasis[] = ['权责口径', '现金口径'];

export const defaultFinanceReportFilters: FinanceReportFilters = {
  aggregation: '全部',
  basis: '权责口径',
  keyword: '',
  period: financeStatisticsCurrentPeriod
};

export const financeReportKindTone = {
  来源明细: 'purple',
  类目统计: 'blue'
} as const;

export const financeReportAggregationTone = {
  经营收入: 'green',
  项目成本: 'red',
  人员支出: 'red',
  运营费用: 'amber',
  资金处理: 'blue',
  其他: 'gray'
} as const satisfies Record<FinanceReportAggregation, 'amber' | 'blue' | 'gray' | 'green' | 'red'>;

function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase();
}

function isEnteredPublicAccountTransaction(record: FinanceTransactionRecord) {
  return (
    record.status === '已入账' &&
    record.direction !== '内部转入' &&
    record.settlementAccountType === '对公账户'
  );
}

function matchesPeriod(recordPeriod: string, filterPeriod: FinanceReportFilters['period']) {
  return filterPeriod === '全部' || recordPeriod === filterPeriod;
}

function matchesAggregation(aggregation: FinanceReportAggregation, filterAggregation: FinanceReportFilters['aggregation']) {
  return filterAggregation === '全部' || aggregation === filterAggregation;
}

function matchesText(parts: Array<string | number | undefined>, keyword: string) {
  return !keyword || parts.join(' ').toLowerCase().includes(keyword);
}

export function getFinanceReportAmountTone(value: number): FinanceReportAmountTone {
  if (value > 0) return 'income';
  if (value < 0) return 'expense';
  return 'muted';
}

export function getFinanceReportSummaryTone(value: number): FinanceReportAmountTone {
  return getFinanceReportAmountTone(value);
}

export function getFinanceReportSourceRecordCount(source: FinanceReportSource) {
  return source.accrualRecords.length + source.transactionRecords.length;
}

export function getAvailableFinanceReportPeriods(
  financeRows: FinanceTransactionRecord[],
  accrualRecords: FinanceReceivablePayableRecord[] = financeReceivablePayableRecords
) {
  return Array.from(
    new Set([
      financeStatisticsCurrentPeriod,
      ...financeRows.map((record) => record.accountingPeriod),
      ...accrualRecords.map((record) => record.accountingPeriod)
    ])
  ).sort((left, right) => right.localeCompare(left));
}

export function buildCategoryStatisticsRows(
  records: FinanceTransactionRecord[],
  accrualRecords: FinanceReceivablePayableRecord[],
  filters: FinanceReportFilters
) {
  const keyword = normalizeKeyword(filters.keyword);
  const rowMap = new Map<string, FinanceCategoryStatisticsRow>();

  function ensureRow(snapshot: FinanceCategorySnapshot) {
    const existing = rowMap.get(snapshot.secondaryCode);
    if (existing) return existing;

    const row: FinanceCategoryStatisticsRow = {
      accrualRecords: [],
      basis: filters.basis,
      expense: 0,
      id: snapshot.secondaryCode,
      includeInReport: snapshot.includeInReport,
      income: 0,
      net: 0,
      primaryName: snapshot.primaryName,
      reportAggregation: snapshot.reportAggregation,
      secondaryName: snapshot.secondaryName,
      transactionRecords: []
    };
    rowMap.set(row.id, row);
    return row;
  }

  if (filters.basis === '权责口径') {
    accrualRecords.forEach((record) => {
      const snapshot = record.categorySnapshot;
      const matched =
        snapshot.includeInReport &&
        matchesPeriod(record.accountingPeriod, filters.period) &&
        matchesAggregation(snapshot.reportAggregation, filters.aggregation) &&
        matchesText(
          [
            record.documentNo,
            record.counterparty,
            record.category,
            record.sourceNo,
            record.sourceTitle,
            record.sourceType,
            snapshot.primaryName,
            snapshot.secondaryName,
            snapshot.reportAggregation
          ],
          keyword
        );
      if (!matched) return;

      const row = ensureRow(snapshot);
      row.accrualRecords.push(record);
      row.income += record.direction === '应收' ? record.amount : 0;
      row.expense += record.direction === '应付' ? record.amount : 0;
      row.net = row.income - row.expense;
    });
  } else {
    records.forEach((record) => {
      const snapshot = getFinanceRecordCategorySnapshot(record);
      const matched =
        isEnteredPublicAccountTransaction(record) &&
        snapshot.includeInReport &&
        matchesPeriod(record.accountingPeriod, filters.period) &&
        matchesAggregation(snapshot.reportAggregation, filters.aggregation) &&
        matchesText(
          [
            record.transactionNo,
            record.counterparty,
            record.category,
            record.sourceNo,
            record.sourceTitle,
            record.sourceType,
            snapshot.primaryName,
            snapshot.secondaryName,
            snapshot.reportAggregation
          ],
          keyword
        );
      if (!matched) return;

      const row = ensureRow(snapshot);
      row.transactionRecords.push(record);
      row.income += record.direction === '收入' ? record.amount : 0;
      row.expense += record.direction === '支出' ? record.amount : 0;
      row.net = row.income - row.expense;
    });
  }

  return Array.from(rowMap.values())
    .filter((row) => getFinanceReportSourceRecordCount(row) > 0)
    .sort(
      (left, right) =>
        left.primaryName.localeCompare(right.primaryName, 'zh-CN') ||
        left.secondaryName.localeCompare(right.secondaryName, 'zh-CN')
    );
}

export function buildFinanceReportSourceRows(categoryRows: FinanceCategoryStatisticsRow[]): FinanceStatisticsSourceRow[] {
  return categoryRows
    .flatMap((categoryRow) => [
      ...categoryRow.accrualRecords.map((record): FinanceStatisticsSourceRow => ({
        accrualRecords: [record],
        aggregation: categoryRow.reportAggregation,
        amount: record.amount,
        basis: '权责口径',
        counterparty: record.counterparty,
        direction: record.direction,
        id: `accrual-${record.id}`,
        primaryName: categoryRow.primaryName,
        secondaryName: categoryRow.secondaryName,
        sourceNo: record.documentNo,
        sourceTitle: record.sourceTitle,
        sourceType: record.sourceType,
        status: record.status,
        transactionRecords: []
      })),
      ...categoryRow.transactionRecords.map((record): FinanceStatisticsSourceRow => ({
        accrualRecords: [],
        aggregation: categoryRow.reportAggregation,
        amount: record.amount,
        basis: '现金口径',
        counterparty: record.counterparty,
        direction: record.direction === '收入' ? '收入' : '支出',
        id: `transaction-${record.id}`,
        primaryName: categoryRow.primaryName,
        secondaryName: categoryRow.secondaryName,
        sourceNo: record.transactionNo,
        sourceTitle: record.sourceTitle,
        sourceType: record.sourceType,
        status: record.status,
        transactionRecords: [record]
      }))
    ])
    .sort((left, right) => left.sourceNo.localeCompare(right.sourceNo, 'zh-CN'));
}

export function buildFinanceCategoryReportDetail(
  row: FinanceCategoryStatisticsRow,
  period: string
): FinanceReportDrawerDetail {
  return {
    accrualRecords: row.accrualRecords,
    aggregation: row.reportAggregation,
    basis: row.basis,
    expense: row.expense,
    income: row.income,
    kind: '类目统计',
    net: row.net,
    period,
    primaryName: row.primaryName,
    secondaryName: row.secondaryName,
    title: row.secondaryName,
    transactionRecords: row.transactionRecords
  };
}

export function buildFinanceSourceReportDetail(
  row: FinanceStatisticsSourceRow,
  period: string
): FinanceReportDrawerDetail {
  const income = row.direction === '应收' || row.direction === '收入' ? row.amount : 0;
  const expense = row.direction === '应付' || row.direction === '支出' ? row.amount : 0;
  return {
    accrualRecords: row.accrualRecords,
    aggregation: row.aggregation,
    basis: row.basis,
    expense,
    income,
    kind: '来源明细',
    net: income - expense,
    period,
    primaryName: row.primaryName,
    secondaryName: row.secondaryName,
    title: row.sourceNo,
    transactionRecords: row.transactionRecords
  };
}

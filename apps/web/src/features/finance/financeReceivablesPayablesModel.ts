import type {
  FinanceReceivablePayableCounterpartyType,
  FinanceReceivablePayableDirection,
  FinanceReceivablePayableRecord,
  FinanceReceivablePayableSourceType,
  FinanceReceivablePayableStatus
} from './financeReceivablesPayablesData';
import { getReceivablePayableOutstandingAmount } from './financeReceivablesPayablesData';
import { financeToday } from './financeUtils';

export type ReceivablePayableTabKey = 'receivable' | 'payable';
export type FinanceReceivablePayableFilterValue = '全部';

export type FinanceReceivablePayableFilters = {
  accountingPeriod: FinanceReceivablePayableFilterValue | string;
  counterpartyType: FinanceReceivablePayableFilterValue | FinanceReceivablePayableCounterpartyType;
  keyword: string;
  sourceType: FinanceReceivablePayableFilterValue | FinanceReceivablePayableSourceType;
  status: FinanceReceivablePayableFilterValue | FinanceReceivablePayableStatus;
};

export type FinanceReceivablePayableAmountLabels = {
  amount: string;
  outstanding: string;
  settled: string;
};

export type FinanceReceivablePayableFilterOptions = {
  counterpartyTypeOptions: Array<FinanceReceivablePayableFilterValue | FinanceReceivablePayableCounterpartyType>;
  periodOptions: Array<FinanceReceivablePayableFilterValue | string>;
  sourceTypeOptions: Array<FinanceReceivablePayableFilterValue | FinanceReceivablePayableSourceType>;
  statusOptions: Array<FinanceReceivablePayableFilterValue | FinanceReceivablePayableStatus>;
};

export type FinanceReceivablePayableMetrics = {
  currentConfirmedAmount: number;
  overdueRows: FinanceReceivablePayableRecord[];
  payableOutstanding: number;
  payableRows: FinanceReceivablePayableRecord[];
  receivableOutstanding: number;
  receivableRows: FinanceReceivablePayableRecord[];
};

export const financeReceivablePayableCurrentPeriod = financeToday.slice(0, 7);

export const defaultFinanceReceivablePayableFilters: FinanceReceivablePayableFilters = {
  accountingPeriod: financeReceivablePayableCurrentPeriod,
  counterpartyType: '全部',
  keyword: '',
  sourceType: '全部',
  status: '全部'
};

export function getFinanceReceivablePayableAmountLabels(
  direction: FinanceReceivablePayableDirection
): FinanceReceivablePayableAmountLabels {
  if (direction === '应收') {
    return {
      amount: '应收金额',
      outstanding: '未收金额',
      settled: '已收金额'
    };
  }

  return {
    amount: '应付金额',
    outstanding: '未付金额',
    settled: '已付金额'
  };
}

export function getFinanceReceivablePayableDirectionByTab(tabKey: ReceivablePayableTabKey): FinanceReceivablePayableDirection {
  return tabKey === 'receivable' ? '应收' : '应付';
}

export function isFinanceReceivablePayableRecordInTab(
  record: FinanceReceivablePayableRecord,
  tabKey: ReceivablePayableTabKey
) {
  return record.direction === getFinanceReceivablePayableDirectionByTab(tabKey);
}

export function getFinanceReceivablePayableRecordsByTab(
  records: FinanceReceivablePayableRecord[],
  tabKey: ReceivablePayableTabKey
) {
  return records.filter((record) => isFinanceReceivablePayableRecordInTab(record, tabKey));
}

export function uniqueFinanceReceivablePayableOptions<T extends string>(
  records: FinanceReceivablePayableRecord[],
  selector: (record: FinanceReceivablePayableRecord) => T
) {
  return Array.from(new Set(records.map(selector)));
}

export function matchesFinanceReceivablePayableFilters(
  record: FinanceReceivablePayableRecord,
  filters: FinanceReceivablePayableFilters
) {
  const keyword = filters.keyword.trim().toLowerCase();

  if (filters.accountingPeriod !== '全部' && record.accountingPeriod !== filters.accountingPeriod) {
    return false;
  }

  if (filters.status !== '全部' && record.status !== filters.status) {
    return false;
  }

  if (filters.sourceType !== '全部' && record.sourceType !== filters.sourceType) {
    return false;
  }

  if (filters.counterpartyType !== '全部' && record.counterpartyType !== filters.counterpartyType) {
    return false;
  }

  if (!keyword) {
    return true;
  }

  return [record.documentNo, record.counterparty, record.sourceNo, record.sourceTitle, record.category]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

export function getFinanceReceivablePayableSettlementProgress(record: FinanceReceivablePayableRecord) {
  if (record.amount <= 0) {
    return '0%';
  }

  const percent = Math.min(100, Math.round((record.settledAmount / record.amount) * 100));
  return `${percent}%`;
}

export function buildFinanceReceivablePayableFilterOptions(
  records: FinanceReceivablePayableRecord[],
  activeTabRecords: FinanceReceivablePayableRecord[]
): FinanceReceivablePayableFilterOptions {
  return {
    counterpartyTypeOptions: [
      '全部',
      ...uniqueFinanceReceivablePayableOptions(activeTabRecords, (record) => record.counterpartyType)
    ],
    periodOptions: [
      '全部',
      ...uniqueFinanceReceivablePayableOptions(records, (record) => record.accountingPeriod)
    ],
    sourceTypeOptions: [
      '全部',
      ...uniqueFinanceReceivablePayableOptions(activeTabRecords, (record) => record.sourceType)
    ],
    statusOptions: [
      '全部',
      ...uniqueFinanceReceivablePayableOptions(activeTabRecords, (record) => record.status)
    ]
  };
}

export function buildFinanceReceivablePayableMetrics(
  records: FinanceReceivablePayableRecord[]
): FinanceReceivablePayableMetrics {
  const receivableRows = records.filter((record) => record.direction === '应收');
  const payableRows = records.filter((record) => record.direction === '应付');
  const receivableOutstanding = receivableRows.reduce(
    (total, record) => total + getReceivablePayableOutstandingAmount(record),
    0
  );
  const payableOutstanding = payableRows.reduce(
    (total, record) => total + getReceivablePayableOutstandingAmount(record),
    0
  );
  const currentConfirmedAmount = records
    .filter((record) => record.accountingPeriod === financeReceivablePayableCurrentPeriod)
    .reduce((total, record) => total + record.amount, 0);
  const overdueRows = records.filter((record) => record.status === '已逾期');

  return {
    currentConfirmedAmount,
    overdueRows,
    payableOutstanding,
    payableRows,
    receivableOutstanding,
    receivableRows
  };
}

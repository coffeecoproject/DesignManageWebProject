import type { TableColumnsType } from 'antd';
import { StatusTag } from '../../components/Detail';
import { CellText, CompactCell, type CellTextTone } from '../../components/TableCell';
import type { FinanceTransactionRecord } from './financeData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import {
  getReceivablePayableOutstandingAmount,
  receivablePayableDirectionTone,
  receivablePayableStatusTone
} from './financeReceivablesPayablesData';
import {
  directionTone,
  formatMoney,
  reconciliationStatusTone,
  transactionStatusTone
} from './financeUtils';
import {
  financeReportAggregationTone,
  getFinanceReportAmountTone,
  getFinanceReportSourceRecordCount,
  type FinanceCategoryStatisticsRow,
  type FinanceStatisticsSourceRow
} from './financeStatisticsModel';

export function renderFinanceStatisticMoney(amount: number, tone?: CellTextTone) {
  return <CellText tone={tone ?? getFinanceReportAmountTone(amount)}>{formatMoney(amount)}</CellText>;
}

function getOutstandingAmountTone(amount: number): CellTextTone {
  return amount > 0 ? 'expense' : 'muted';
}

export const financeStatisticsTransactionColumns: TableColumnsType<FinanceTransactionRecord> = [
  {
    dataIndex: 'transactionNo',
    fixed: 'left',
    render: (transactionNo: string, record) => (
      <CompactCell primary={transactionNo} secondary={record.accountingPeriod} />
    ),
    title: '流水号',
    width: 150
  },
  {
    dataIndex: 'direction',
    render: (direction: FinanceTransactionRecord['direction']) => (
      <StatusTag toneMap={directionTone} value={direction} />
    ),
    title: '方向',
    width: 92
  },
  { dataIndex: 'counterparty', title: '对象', width: 150 },
  { dataIndex: 'category', title: '财务类目', width: 136 },
  {
    dataIndex: 'amount',
    render: (amount: number, record) => renderFinanceStatisticMoney(amount, record.direction === '支出' ? 'expense' : 'income'),
    title: '金额',
    width: 124
  },
  {
    dataIndex: 'status',
    render: (status: FinanceTransactionRecord['status']) => (
      <StatusTag toneMap={transactionStatusTone} value={status} />
    ),
    title: '流水状态',
    width: 100
  },
  {
    dataIndex: 'reconciliationStatus',
    render: (status: FinanceTransactionRecord['reconciliationStatus']) => (
      <StatusTag toneMap={reconciliationStatusTone} value={status} />
    ),
    title: '对账',
    width: 100
  }
];

export const financeStatisticsAccrualSourceColumns: TableColumnsType<FinanceReceivablePayableRecord> = [
  {
    dataIndex: 'documentNo',
    fixed: 'left',
    render: (documentNo: string, record) => (
      <CompactCell primary={documentNo} secondary={record.accountingPeriod} />
    ),
    title: '确认单',
    width: 148
  },
  {
    dataIndex: 'direction',
    render: (direction: FinanceReceivablePayableRecord['direction']) => (
      <StatusTag toneMap={receivablePayableDirectionTone} value={direction} />
    ),
    title: '方向',
    width: 92
  },
  { dataIndex: 'counterparty', title: '对象', width: 150 },
  { dataIndex: 'category', title: '财务类目', width: 136 },
  {
    dataIndex: 'amount',
    render: (amount: number, record) => renderFinanceStatisticMoney(amount, record.direction === '应付' ? 'expense' : 'income'),
    title: '确认金额',
    width: 124
  },
  {
    key: 'outstanding',
    render: (_, record) => {
      const outstandingAmount = getReceivablePayableOutstandingAmount(record);
      return renderFinanceStatisticMoney(outstandingAmount, getOutstandingAmountTone(outstandingAmount));
    },
    title: '未结清',
    width: 124
  },
  {
    dataIndex: 'status',
    render: (status: FinanceReceivablePayableRecord['status']) => (
      <StatusTag toneMap={receivablePayableStatusTone} value={status} />
    ),
    title: '状态',
    width: 100
  }
];

export const financeStatisticsCategoryColumns: TableColumnsType<FinanceCategoryStatisticsRow> = [
  {
    dataIndex: 'primaryName',
    fixed: 'left',
    render: (primaryName: string, record) => (
      <CompactCell primary={primaryName} secondary={record.reportAggregation} />
    ),
    title: '一级类目',
    width: 170
  },
  {
    dataIndex: 'secondaryName',
    render: (secondaryName: string, record) => <CompactCell primary={secondaryName} secondary={record.id} />,
    title: '二级类目',
    width: 170
  },
  {
    dataIndex: 'reportAggregation',
    render: (aggregation: FinanceCategoryStatisticsRow['reportAggregation']) => (
      <StatusTag toneMap={financeReportAggregationTone} value={aggregation} />
    ),
    title: '统计归集',
    width: 116
  },
  {
    dataIndex: 'income',
    render: (income: number) => renderFinanceStatisticMoney(income, income > 0 ? 'income' : 'muted'),
    title: '收入',
    width: 136
  },
  {
    dataIndex: 'expense',
    render: (expense: number) => renderFinanceStatisticMoney(expense, expense > 0 ? 'expense' : 'muted'),
    title: '支出',
    width: 136
  },
  {
    dataIndex: 'net',
    render: (net: number) => renderFinanceStatisticMoney(net),
    title: '收支差额',
    width: 136
  },
  {
    key: 'sourceCount',
    render: (_, record) => <CellText>{getFinanceReportSourceRecordCount(record)} 条</CellText>,
    title: '来源',
    width: 110
  }
];

export const financeStatisticsIncomeColumns: TableColumnsType<FinanceCategoryStatisticsRow> = [
  {
    dataIndex: 'primaryName',
    fixed: 'left',
    render: (primaryName: string, record) => (
      <CompactCell primary={primaryName} secondary={record.reportAggregation} />
    ),
    title: '一级类目',
    width: 180
  },
  {
    dataIndex: 'secondaryName',
    render: (secondaryName: string, record) => <CompactCell primary={secondaryName} secondary={record.id} />,
    title: '二级类目',
    width: 190
  },
  {
    dataIndex: 'income',
    render: (income: number) => renderFinanceStatisticMoney(income, 'income'),
    title: '收入金额',
    width: 148
  },
  {
    key: 'sourceCount',
    render: (_, record) => <CellText>{getFinanceReportSourceRecordCount(record)} 条</CellText>,
    title: '来源记录',
    width: 124
  }
];

export const financeStatisticsExpenseColumns: TableColumnsType<FinanceCategoryStatisticsRow> = [
  {
    dataIndex: 'primaryName',
    fixed: 'left',
    render: (primaryName: string, record) => (
      <CompactCell primary={primaryName} secondary={record.reportAggregation} />
    ),
    title: '一级类目',
    width: 180
  },
  {
    dataIndex: 'secondaryName',
    render: (secondaryName: string, record) => <CompactCell primary={secondaryName} secondary={record.id} />,
    title: '二级类目',
    width: 190
  },
  {
    dataIndex: 'expense',
    render: (expense: number) => renderFinanceStatisticMoney(expense, 'expense'),
    title: '支出金额',
    width: 148
  },
  {
    key: 'sourceCount',
    render: (_, record) => <CellText>{getFinanceReportSourceRecordCount(record)} 条</CellText>,
    title: '来源记录',
    width: 124
  }
];

export const financeStatisticsSourceColumns: TableColumnsType<FinanceStatisticsSourceRow> = [
  {
    dataIndex: 'sourceNo',
    fixed: 'left',
    render: (sourceNo: string, record) => (
      <CompactCell primary={sourceNo} secondary={`${record.sourceType} / ${record.sourceTitle}`} />
    ),
    title: '来源单号',
    width: 220
  },
  { dataIndex: 'counterparty', title: '对象', width: 150 },
  {
    dataIndex: 'secondaryName',
    render: (secondaryName: string, record) => <CompactCell primary={secondaryName} secondary={record.primaryName} />,
    title: '财务类目',
    width: 180
  },
  {
    dataIndex: 'direction',
    render: (direction: FinanceStatisticsSourceRow['direction']) => (
      <StatusTag tone={direction === '应收' || direction === '收入' ? 'green' : 'red'} value={direction} />
    ),
    title: '方向',
    width: 92
  },
  {
    dataIndex: 'amount',
    render: (amount: number, record) =>
      renderFinanceStatisticMoney(amount, record.direction === '应付' || record.direction === '支出' ? 'expense' : 'income'),
    title: '金额',
    width: 136
  },
  {
    dataIndex: 'status',
    render: (status: FinanceStatisticsSourceRow['status'], record) =>
      record.basis === '权责口径' ? (
        <StatusTag toneMap={receivablePayableStatusTone} value={status} />
      ) : (
        <StatusTag toneMap={transactionStatusTone} value={status} />
      ),
    title: '状态',
    width: 112
  }
];

import type { TableColumnsType } from 'antd';
import { StatusTag } from '../../components/Detail';
import { CellText, CompactCell } from '../../components/TableCell';
import type { FinanceTransactionRecord } from './financeData';
import type { FinanceReceivablePayableRecord, FinanceReceivablePayableStatus } from './financeReceivablesPayablesData';
import {
  getReceivablePayableOutstandingAmount,
  receivablePayableStatusTone
} from './financeReceivablesPayablesData';
import {
  directionTone,
  formatMoney,
  getAmountTone,
  reconciliationStatusTone,
  transactionStatusTone,
  voucherStatusTone
} from './financeUtils';
import type { FinanceReceivablePayableAmountLabels } from './financeReceivablesPayablesModel';

export function buildFinanceReceivablePayableColumns(
  amountLabels: FinanceReceivablePayableAmountLabels
): TableColumnsType<FinanceReceivablePayableRecord> {
  return [
    {
      dataIndex: 'documentNo',
      fixed: 'left',
      render: (_documentNo: string, record) => (
        <CompactCell primary={record.documentNo} secondary={record.sourceType} />
      ),
      title: '确认单',
      width: 148
    },
    {
      dataIndex: 'counterparty',
      render: (_counterparty: string, record) => (
        <CompactCell primary={record.counterparty} secondary={record.counterpartyType} />
      ),
      title: '对象',
      width: 172
    },
    {
      dataIndex: 'sourceTitle',
      render: (_sourceTitle: string, record) => (
        <CompactCell primary={record.sourceTitle} secondary={record.sourceNo} />
      ),
      title: '业务来源',
      width: 220
    },
    {
      dataIndex: 'accountingPeriod',
      render: (_period: string, record) => (
        <CompactCell primary={record.accountingPeriod} secondary={record.confirmDate} />
      ),
      title: '确认期间',
      width: 126
    },
    {
      dataIndex: 'dueDate',
      title: '到期日',
      width: 112
    },
    {
      dataIndex: 'amount',
      render: (amount: number) => <CellText>{formatMoney(amount)}</CellText>,
      title: amountLabels.amount,
      width: 128
    },
    {
      dataIndex: 'settledAmount',
      render: (amount: number) => <CellText tone="income">{formatMoney(amount)}</CellText>,
      title: amountLabels.settled,
      width: 128
    },
    {
      key: 'outstandingAmount',
      render: (_, record) => {
        const outstandingAmount = getReceivablePayableOutstandingAmount(record);
        return (
          <CellText tone={outstandingAmount > 0 ? 'expense' : 'muted'}>
            {formatMoney(outstandingAmount)}
          </CellText>
        );
      },
      title: amountLabels.outstanding,
      width: 128
    },
    {
      dataIndex: 'linkedTransactionNos',
      render: (linkedTransactionNos: string[]) => <CellText>{linkedTransactionNos.length} 条</CellText>,
      title: '关联流水',
      width: 104
    },
    {
      dataIndex: 'status',
      render: (status: FinanceReceivablePayableStatus) => (
        <StatusTag toneMap={receivablePayableStatusTone} value={status} />
      ),
      title: '状态',
      width: 108
    },
    {
      dataIndex: 'updatedAt',
      title: '最近更新',
      width: 142
    }
  ];
}

export const financeReceivablePayableLinkedTransactionColumns: TableColumnsType<FinanceTransactionRecord> = [
  {
    dataIndex: 'transactionNo',
    render: (_transactionNo: string, record) => (
      <CompactCell primary={record.transactionNo} secondary={record.occurredAt} />
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
  {
    dataIndex: 'amount',
    render: (_amount: number, record) => (
      <CellText tone={getAmountTone(record)}>{formatMoney(record.amount)}</CellText>
    ),
    title: '金额',
    width: 132
  },
  {
    dataIndex: 'paymentMethod',
    title: '收付方式',
    width: 132
  },
  {
    dataIndex: 'status',
    render: (status: FinanceTransactionRecord['status']) => (
      <StatusTag toneMap={transactionStatusTone} value={status} />
    ),
    title: '流水状态',
    width: 108
  },
  {
    dataIndex: 'voucherStatus',
    render: (voucherStatus: FinanceTransactionRecord['voucherStatus']) => (
      <StatusTag toneMap={voucherStatusTone} value={voucherStatus} />
    ),
    title: '凭证',
    width: 96
  },
  {
    dataIndex: 'reconciliationStatus',
    render: (status: FinanceTransactionRecord['reconciliationStatus']) => (
      <StatusTag toneMap={reconciliationStatusTone} value={status} />
    ),
    title: '对账',
    width: 96
  }
];

import type { TableColumnsType } from 'antd';
import { Space } from 'antd';
import { StatusTag } from '../../components/Detail';
import { CellText, CompactCell } from '../../components/TableCell';
import type { FinanceTransactionRecord } from './financeData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import {
  getReceivablePayableOutstandingAmount,
  receivablePayableDirectionTone,
  receivablePayableReviewProgressTone,
  receivablePayableSettlementStatusTone
} from './financeReceivablesPayablesData';
import {
  directionTone,
  formatMoney,
  getAmountTone,
  reconciliationStatusTone,
  transactionStatusTone,
  voucherStatusTone
} from './financeUtils';
import {
  financeReceivablePayableLedgerAmountLabels,
  getFinanceReceivablePayableDueDate,
  getFinanceReceivablePayableLinkedTransactionRows,
  getFinanceReceivablePayableReviewProgressStatus,
  isFinanceReceivablePayableOverdue,
  getFinanceReceivablePayableSourceLabel
} from './financeReceivablesPayablesModel';

export function buildFinanceReceivablePayableColumns(
  financeRows: FinanceTransactionRecord[] = []
): TableColumnsType<FinanceReceivablePayableRecord> {
  return [
    {
      dataIndex: 'direction',
      fixed: 'left',
      render: (direction: FinanceReceivablePayableRecord['direction']) => (
        <StatusTag toneMap={receivablePayableDirectionTone} value={direction} />
      ),
      title: '收付方向',
      width: 88
    },
    {
      dataIndex: 'settlementStatus',
      render: (settlementStatus: FinanceReceivablePayableRecord['settlementStatus']) => (
        <StatusTag toneMap={receivablePayableSettlementStatusTone} value={settlementStatus} variant="compact" />
      ),
      title: '结清状态',
      width: 116
    },
    {
      key: 'reviewProgress',
      render: (_, record) => {
        const linkedTransactionRows = getFinanceReceivablePayableLinkedTransactionRows(record, financeRows);
        const reviewProgressStatus = getFinanceReceivablePayableReviewProgressStatus(record, linkedTransactionRows);

        return reviewProgressStatus ? (
          <StatusTag toneMap={receivablePayableReviewProgressTone} value={reviewProgressStatus} variant="compact" />
        ) : (
          <CellText tone="muted">-</CellText>
        );
      },
      title: '流水复核',
      width: 116
    },
    {
      dataIndex: 'documentNo',
      render: (_documentNo: string, record) => (
        <CompactCell primary={record.documentNo} secondary={record.category} />
      ),
      title: '事项单号',
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
        <CompactCell primary={record.sourceTitle} secondary={`${getFinanceReceivablePayableSourceLabel(record.sourceType)} / ${record.sourceNo}`} />
      ),
      title: '业务来源',
      width: 240
    },
    {
      dataIndex: 'accountingPeriod',
      render: (_period: string, record) => (
        <CompactCell primary={record.accountingPeriod} secondary={record.confirmDate} />
      ),
      title: '归属月份',
      width: 126
    },
    {
      key: 'dueDate',
      render: (_, record) => (
        <Space size={6} wrap>
          <span>{getFinanceReceivablePayableDueDate(record)}</span>
          {isFinanceReceivablePayableOverdue(record) ? (
            <StatusTag tone="red" value="逾期" variant="compact" />
          ) : null}
        </Space>
      ),
      title: '到期日',
      width: 138
    },
    {
      dataIndex: 'amount',
      render: (amount: number) => <CellText>{formatMoney(amount)}</CellText>,
      title: financeReceivablePayableLedgerAmountLabels.amount,
      width: 128
    },
    {
      dataIndex: 'settledAmount',
      render: (amount: number) => <CellText tone="income">{formatMoney(amount)}</CellText>,
      title: financeReceivablePayableLedgerAmountLabels.settled,
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
      title: financeReceivablePayableLedgerAmountLabels.outstanding,
      width: 128
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
    title: '收支方向',
    width: 92
  },
  {
    dataIndex: 'amount',
    render: (_amount: number, record) => (
      <CellText tone={getAmountTone(record)}>{formatMoney(record.amount)}</CellText>
    ),
    title: '流水金额',
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
    title: '凭证状态',
    width: 96
  },
  {
    dataIndex: 'reconciliationStatus',
    render: (status: FinanceTransactionRecord['reconciliationStatus']) => (
      <StatusTag toneMap={reconciliationStatusTone} value={status} />
    ),
    title: '对账状态',
    width: 96
  }
];

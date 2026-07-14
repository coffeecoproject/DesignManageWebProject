import type { TableColumnsType } from 'antd';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { StatusTag } from '../../components/Detail';
import { CompactCell } from '../../components/TableCell';
import type { FinanceStampDutySourceRecord } from './financeStampDutyModel';
import { formatMoney } from './financeUtils';

const columns: TableColumnsType<FinanceStampDutySourceRecord> = [
  {
    dataIndex: 'documentName',
    render: (_documentName: string, source) => (
      <CompactCell primary={source.documentName} secondary={`${source.sourceNo} / ${source.sourceType}`} />
    ),
    title: '应税凭证',
    width: 220
  },
  {
    dataIndex: 'counterparty',
    render: (_counterparty: string, source) => (
      <CompactCell primary={source.counterparty} secondary={source.counterpartyTaxId ?? '-'} />
    ),
    title: '对方信息',
    width: 190
  },
  {
    dataIndex: 'taxItem',
    render: (_taxItem: FinanceStampDutySourceRecord['taxItem'], source) =>
      source.taxTreatment === '非应税' ? '非应税' : source.taxItem,
    title: '税目',
    width: 142
  },
  { dataIndex: 'taxableBasis', render: (amount: number) => formatMoney(amount), title: '计税依据', width: 130 },
  {
    dataIndex: 'legalTaxRate',
    render: (rate: number | undefined) => (rate === undefined ? '-' : `${rate * 100}%`),
    title: '税率',
    width: 82
  },
  { dataIndex: 'reductionAmount', render: (amount: number) => formatMoney(amount), title: '减征额', width: 116 },
  { dataIndex: 'estimatedPayableAmount', render: (amount: number) => formatMoney(amount), title: '预计税额', width: 116 },
  {
    dataIndex: 'resolutionStatus',
    render: (status: FinanceStampDutySourceRecord['resolutionStatus']) => (
      <StatusTag
        tone={status === '待确认' ? 'amber' : status === '已完成' ? 'gray' : status === '待后续结算' ? 'blue' : 'green'}
        value={status}
      />
    ),
    title: '处理状态',
    width: 120
  }
];

export function StampDutySourceDetailTable({
  records,
  onRecordClick
}: {
  records: FinanceStampDutySourceRecord[];
  onRecordClick?: (record: FinanceStampDutySourceRecord) => void;
}) {
  return (
    <CompactDetailTable<FinanceStampDutySourceRecord>
      className="detail-section-table"
      columns={columns}
      dataSource={records}
      emptyText="本期无印花税税源"
      onRow={onRecordClick
        ? (record) => ({
            className: 'clickable-row',
            onClick: () => onRecordClick(record)
          })
        : undefined}
      rowKey="id"
      scrollX={1110}
    />
  );
}

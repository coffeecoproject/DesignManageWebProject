import type { TableColumnsType } from 'antd';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { StatusTag } from '../../components/Detail';
import { CompactCell } from '../../components/TableCell';
import {
  buildCorporateIncomeTaxSourceRows,
  corporateIncomeTaxSourceStatusTone,
  type FinanceCorporateIncomeTaxSourceRow,
  type FinanceDeclarationPreparationRecord
} from './financeDeclarationPreparationData';
import { formatMoney } from './financeUtils';

const columns: TableColumnsType<FinanceCorporateIncomeTaxSourceRow> = [
  {
    dataIndex: 'name',
    key: 'name',
    render: (_name: string, record) => <CompactCell primary={record.name} secondary={record.sourceModule} />,
    title: '来源项'
  },
  {
    dataIndex: 'sourcePeriod',
    key: 'sourcePeriod',
    title: '期间',
    width: 120
  },
  {
    align: 'right',
    dataIndex: 'amount',
    key: 'amount',
    render: (amount: number) => formatMoney(amount),
    title: '金额',
    width: 150
  },
  {
    dataIndex: 'status',
    key: 'status',
    render: (status: FinanceCorporateIncomeTaxSourceRow['status']) => (
      <StatusTag toneMap={corporateIncomeTaxSourceStatusTone} value={status} />
    ),
    title: '状态',
    width: 120
  },
  {
    dataIndex: 'result',
    key: 'result',
    title: '来源结果'
  }
];

export function CorporateIncomeTaxSourceTable({ record }: { record: FinanceDeclarationPreparationRecord }) {
  return (
    <CompactDetailTable<FinanceCorporateIncomeTaxSourceRow>
      className="detail-section-table"
      columns={columns}
      dataSource={buildCorporateIncomeTaxSourceRows(record)}
      rowKey="id"
      scrollX={860}
    />
  );
}

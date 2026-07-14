import type { TableColumnsType } from 'antd';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { CompactCell } from '../../components/TableCell';
import { DeclarationCheckResultCell } from './DeclarationCheckResultCell';
import { getCorporateIncomeTaxSourceCheckResult } from './declarationCheckResultModel';
import {
  buildCorporateIncomeTaxSourceRows,
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
    dataIndex: 'value',
    key: 'value',
    render: (value: number, record) =>
      record.displayValue
        ?? (record.valueKind === 'amount' ? formatMoney(value) : `${value.toLocaleString('zh-CN')} ${record.unit ?? '项'}`),
    title: '关键数据',
    width: 150
  },
  {
    dataIndex: 'result',
    key: 'result',
    render: (_result: string, record) => {
      const presentation = getCorporateIncomeTaxSourceCheckResult(record);

      return (
        <DeclarationCheckResultCell
          {...presentation}
          tag={record.status === '已同步' ? undefined : { tone: 'amber', value: '待完成' }}
        />
      );
    },
    title: '核对结果'
  }
];

export function CorporateIncomeTaxSourceTable({ record }: { record: FinanceDeclarationPreparationRecord }) {
  return (
    <CompactDetailTable<FinanceCorporateIncomeTaxSourceRow>
      className="detail-section-table"
      columns={columns}
      dataSource={buildCorporateIncomeTaxSourceRows(record)}
      rowKey="id"
      scrollX={760}
    />
  );
}

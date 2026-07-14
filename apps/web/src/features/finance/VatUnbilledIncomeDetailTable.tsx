import type { TableColumnsType } from 'antd';
import { Checkbox, Select } from 'antd';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { StatusTag } from '../../components/Detail';
import { CompactCell } from '../../components/TableCell';
import {
  financeUnbilledIncomeExclusionReasons,
  type FinanceDeclarationUnbilledIncomeCandidate,
  type FinanceUnbilledIncomeExclusionReason
} from './financeDeclarationPreparationData';
import { formatMoney } from './financeUtils';

const statusTone = {
  系统纳入: 'green',
  待核实: 'amber',
  排除待说明: 'amber',
  已排除: 'gray'
} as const;

export function VatUnbilledIncomeDetailTable({
  editable = false,
  onInclusionChange,
  onReasonChange,
  records
}: {
  editable?: boolean;
  onInclusionChange?: (businessRecordId: string, included: boolean) => void;
  onReasonChange?: (businessRecordId: string, reason: FinanceUnbilledIncomeExclusionReason) => void;
  records: FinanceDeclarationUnbilledIncomeCandidate[];
}) {
  const columns: TableColumnsType<FinanceDeclarationUnbilledIncomeCandidate> = [
    {
      dataIndex: ['businessRecord', 'documentNo'],
      render: (_documentNo: string, candidate) => (
        <CompactCell primary={candidate.businessRecord.documentNo} secondary={candidate.businessRecord.sourceTitle} />
      ),
      title: '应收事项',
      width: 180
    },
    {
      dataIndex: ['businessRecord', 'counterparty'],
      render: (_counterparty: string, candidate) => (
        <CompactCell primary={candidate.businessRecord.counterparty} secondary={candidate.obligationBasis} />
      ),
      title: '业务对象',
      width: 190
    },
    { dataIndex: 'obligationDate', title: '纳税义务日期', width: 132 },
    {
      dataIndex: 'taxIncludedAmount',
      render: (amount: number) => formatMoney(amount),
      title: '价税合计',
      width: 128
    },
    {
      dataIndex: 'netAmount',
      render: (amount: number, candidate) => candidate.taxBasisResolved ? formatMoney(amount) : '-',
      title: '申报金额',
      width: 128
    },
    {
      dataIndex: 'selectedForInclusion',
      render: (selected: boolean, candidate) => (
        <Checkbox
          checked={selected}
          disabled={!editable}
          onChange={(event) => onInclusionChange?.(candidate.businessRecord.id, event.target.checked)}
        />
      ),
      title: '纳入本期',
      width: 96
    },
    {
      dataIndex: 'status',
      render: (status: FinanceDeclarationUnbilledIncomeCandidate['status']) => (
        <StatusTag tone={statusTone[status]} value={status} />
      ),
      title: '核对状态',
      width: 112
    },
    {
      dataIndex: ['exclusion', 'reason'],
      render: (_reason: FinanceUnbilledIncomeExclusionReason | undefined, candidate) => {
        if (candidate.selectedForInclusion) {
          return '-';
        }

        if (!editable) {
          return candidate.exclusion?.reason ?? '待说明';
        }

        return (
          <Select
            aria-label={`${candidate.businessRecord.documentNo}排除原因`}
            options={financeUnbilledIncomeExclusionReasons.map((reason) => ({ label: reason, value: reason }))}
            placeholder="选择原因"
            value={candidate.exclusion?.reason}
            onChange={(reason) => onReasonChange?.(candidate.businessRecord.id, reason)}
          />
        );
      },
      title: '排除原因',
      width: 172
    }
  ];

  return (
    <CompactDetailTable<FinanceDeclarationUnbilledIncomeCandidate>
      className="detail-section-table"
      columns={columns}
      dataSource={records}
      emptyText="本期无未开票应税事项"
      rowKey={(record) => record.businessRecord.id}
      scrollX={1138}
    />
  );
}

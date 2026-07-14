import type { TableColumnsType } from 'antd';
import { useMemo } from 'react';
import { StatusTag, type StatusTagTone } from '../../components/Detail';
import { SummaryTablePanel } from '../../components/SummaryTablePanel';
import { CompactCell } from '../../components/TableCell';
import type {
  PayrollIitDeclarationEmployeeRow,
  PayrollIitDeclarationSummary
} from './financePayrollIitDeclarationModel';
import { formatMoney } from './financeUtils';

const payrollIitPaymentStatusTone = {
  已核验: 'green',
  待核验: 'amber'
} as const satisfies Record<PayrollIitDeclarationEmployeeRow['paymentStatus'], StatusTagTone>;

type PayrollIitEmployeeDetailPanelProps = {
  amountLabel?: string;
  payableAmount: number;
  records: PayrollIitDeclarationEmployeeRow[];
  summary?: PayrollIitDeclarationSummary;
  summaryTitle?: string;
};

export function PayrollIitEmployeeDetailPanel({
  amountLabel = '预计个税',
  payableAmount,
  records,
  summary,
  summaryTitle = '申报汇总'
}: PayrollIitEmployeeDetailPanelProps) {
  const columns = useMemo<TableColumnsType<PayrollIitDeclarationEmployeeRow>>(
    () => [
      {
        className: 'summary-table-left-cell',
        dataIndex: 'employeeName',
        render: (_employeeName: string, record) => (
          <CompactCell primary={record.employeeName} secondary={`${record.employeeNo} / ${record.identityNoMasked}`} />
        ),
        title: '自然人',
        width: 168
      },
      {
        dataIndex: 'paymentStatus',
        render: (status: PayrollIitDeclarationEmployeeRow['paymentStatus']) => (
          <StatusTag toneMap={payrollIitPaymentStatusTone} value={status} />
        ),
        title: '付款核验',
        width: 104
      },
      {
        key: 'paymentPeriod',
        render: (_, record) => <CompactCell primary={record.paidAt.slice(0, 10)} secondary={`${record.incomeType} / ${record.sourceBatchNo}`} />,
        title: '实际发放',
        width: 132
      },
      {
        dataIndex: 'currentIncomeAmount',
        render: (amount: number) => formatMoney(amount),
        title: '当期收入',
        width: 130
      },
      {
        key: 'currentDeductions',
        render: (_, record) => formatMoney(
          record.currentBasicDeductionAmount
          + record.currentSpecialDeductionAmount
          + record.currentAdditionalDeductionAmount
          + record.currentOtherDeductionAmount
        ),
        title: '当期扣除',
        width: 124
      },
      {
        dataIndex: 'cumulativeAdditionalDeductionAmount',
        render: (amount: number) => formatMoney(amount),
        title: '累计专项附加',
        width: 150
      },
      {
        dataIndex: 'cumulativeTaxableIncomeAmount',
        render: (amount: number) => formatMoney(amount),
        title: '计税所得额',
        width: 154
      },
      {
        key: 'rate',
        render: (_, record) => <CompactCell primary={`${(record.taxRate * 100).toFixed(0)}%`} secondary={`速算扣除 ${formatMoney(record.quickDeductionAmount)}`} />,
        title: '税率',
        width: 128
      },
      {
        dataIndex: 'priorWithheldTaxAmount',
        render: (amount: number) => formatMoney(amount),
        title: '前期已扣',
        width: 116
      },
      {
        dataIndex: 'personalIncomeTaxAmount',
        render: (amount: number, record) => (
          <CompactCell primary={formatMoney(amount)} secondary={record.includedInFiling ? '已计入' : '未计入'} />
        ),
        title: '本月个税',
        width: 116
      }
    ],
    []
  );

  return (
    <SummaryTablePanel<PayrollIitDeclarationEmployeeRow>
      columns={columns}
      dataSource={records}
      rowKey="id"
      scrollX={1280}
      summaryItems={[
        { key: 'records', label: '付款记录', value: `${summary?.reportCount ?? records.length} 条` },
        { key: 'confirmed', label: '已计入', tone: 'income', value: `${summary?.confirmedCount ?? 0} 条` },
        { key: 'amount', label: amountLabel, value: formatMoney(payableAmount) }
      ]}
      summaryLayout="amount-trailing"
      summaryMeta={`${summary?.period ?? '-'} / 个税`}
      summaryTitle={summaryTitle}
    />
  );
}

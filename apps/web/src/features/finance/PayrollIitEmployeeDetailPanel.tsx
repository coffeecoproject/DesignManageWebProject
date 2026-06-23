import type { TableColumnsType } from 'antd';
import { useMemo } from 'react';
import { StatusTag, type StatusTagTone } from '../../components/Detail';
import { SummaryTablePanel } from '../../components/SummaryTablePanel';
import { CompactCell } from '../../components/TableCell';
import type { PayrollIitTaxMatterEmployeeRow, PayrollIitTaxMatterSummary } from './financeTaxMatterModel';
import { formatMoney } from './financeUtils';

const payrollIitSalaryStatusTone = {
  结算中: 'amber',
  待确认: 'blue',
  已确认: 'green',
  已结算: 'green'
} as const satisfies Record<PayrollIitTaxMatterEmployeeRow['salaryStatus'], StatusTagTone>;

type PayrollIitEmployeeDetailPanelProps = {
  payableAmount: number;
  records: PayrollIitTaxMatterEmployeeRow[];
  summary?: PayrollIitTaxMatterSummary;
};

export function PayrollIitEmployeeDetailPanel({ payableAmount, records, summary }: PayrollIitEmployeeDetailPanelProps) {
  const columns = useMemo<TableColumnsType<PayrollIitTaxMatterEmployeeRow>>(
    () => [
      {
        className: 'summary-table-left-cell',
        dataIndex: 'employeeName',
        render: (_employeeName: string, record) => (
          <CompactCell primary={record.employeeName} secondary={`${record.employeeNo} / ${record.position}`} />
        ),
        title: '员工',
        width: 168
      },
      {
        dataIndex: 'salaryStatus',
        render: (status: PayrollIitTaxMatterEmployeeRow['salaryStatus']) => (
          <StatusTag toneMap={payrollIitSalaryStatusTone} value={status} />
        ),
        title: '薪酬状态',
        width: 104
      },
      {
        dataIndex: 'grossSalary',
        render: (grossSalary: number) => formatMoney(grossSalary),
        title: '应发工资',
        width: 116
      },
      {
        dataIndex: 'socialInsuranceDeductionAmount',
        render: (amount: number) => formatMoney(amount),
        title: '社保公积金',
        width: 124
      },
      {
        dataIndex: 'currentTaxableIncomeAmount',
        render: (amount: number) => formatMoney(amount),
        title: '计税收入',
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
    <SummaryTablePanel<PayrollIitTaxMatterEmployeeRow>
      columns={columns}
      dataSource={records}
      rowKey="id"
      scrollX={760}
      summaryItems={[
        { key: 'records', label: '薪酬记录', value: `${summary?.reportCount ?? records.length} 人` },
        { key: 'confirmed', label: '已确认', tone: 'income', value: `${summary?.confirmedCount ?? 0} 人` },
        { key: 'pending', label: '待确认', tone: 'muted', value: `${summary?.pendingCount ?? 0} 人` },
        { key: 'amount', label: '应缴金额', value: formatMoney(payableAmount) }
      ]}
      summaryLayout="amount-trailing"
      summaryMeta={`${summary?.period ?? '-'} / 个税`}
      summaryTitle="薪酬概览"
    />
  );
}

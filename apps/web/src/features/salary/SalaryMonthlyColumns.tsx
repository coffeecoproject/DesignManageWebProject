import type { TableColumnsType } from 'antd';
import { StatusTag } from '../../components/Detail';
import { CellText, CompactCell } from '../../components/TableCell';
import {
  salaryMonthlyStatusTone
} from './salaryMonthlyDisplayModel';
import {
  formatSalaryMoney,
  type SalaryMonthlyReport
} from './salaryDomain';

function SalaryMonthlyPersonCell({ report }: { report: SalaryMonthlyReport }) {
  return <CompactCell primary={report.member.name} secondary={report.member.personnelType} />;
}

export const salaryMonthlyColumns: TableColumnsType<SalaryMonthlyReport> = [
  {
    title: '薪酬月份',
    dataIndex: 'month',
    width: 108
  },
  {
    title: '工号',
    dataIndex: ['member', 'id'],
    width: 116
  },
  {
    title: '姓名',
    key: 'person',
    width: 140,
    render: (_, report) => <SalaryMonthlyPersonCell report={report} />
  },
  {
    title: '岗位',
    dataIndex: ['member', 'position'],
    width: 150
  },
  {
    title: '应发工资',
    dataIndex: 'grossSalary',
    width: 116,
    render: (amount: number) => <CellText>{formatSalaryMoney(amount)}</CellText>
  },
  {
    title: '扣减合计',
    dataIndex: 'deductionAmount',
    width: 116,
    render: (amount: number) => <CellText>{formatSalaryMoney(amount)}</CellText>
  },
  {
    title: '实发测算',
    dataIndex: 'netSalary',
    width: 116,
    render: (amount: number) => <CellText>{formatSalaryMoney(amount)}</CellText>
  },
  {
    title: '薪酬状态',
    dataIndex: 'status',
    width: 108,
    render: (status: SalaryMonthlyReport['status']) => (
      <StatusTag toneMap={salaryMonthlyStatusTone} value={status} />
    )
  }
];

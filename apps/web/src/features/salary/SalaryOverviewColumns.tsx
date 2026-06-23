import type { TableColumnsType } from 'antd';
import { StatusTag } from '../../components/Detail';
import { CellText, CompactCell } from '../../components/TableCell';
import { formatSalaryMoney } from './salaryDomain';
import type { SalaryOverviewBoardRow, SalaryOverviewEmployeeRow } from './salaryOverviewModel';

const salaryOverviewBoardTypeTone = {
  应发: 'green',
  扣减: 'amber',
  实发: 'blue'
} as const;

export const salaryOverviewBoardColumns: TableColumnsType<SalaryOverviewBoardRow> = [
  {
    title: '薪酬板块',
    key: 'board',
    width: 170,
    render: (_, row) => <CompactCell primary={row.label} secondary={`${row.employeeCount} 人`} />
  },
  {
    title: '类型',
    dataIndex: 'type',
    width: 96,
    render: (type: SalaryOverviewBoardRow['type']) => <StatusTag toneMap={salaryOverviewBoardTypeTone} value={type} />
  },
  {
    title: '总计',
    dataIndex: 'totalAmount',
    width: 132,
    render: (amount: number) => <CellText>{formatSalaryMoney(amount)}</CellText>
  },
  {
    title: '人均',
    dataIndex: 'averageAmount',
    width: 132,
    render: (amount: number) => <CellText>{formatSalaryMoney(amount)}</CellText>
  }
];

export const salaryOverviewEmployeeColumns: TableColumnsType<SalaryOverviewEmployeeRow> = [
  {
    title: '员工',
    key: 'employee',
    width: 190,
    render: (_, row) => <CompactCell primary={row.memberName} secondary={`${row.memberId} / ${row.personnelType}`} />
  },
  {
    title: '实发合计',
    dataIndex: 'netSalary',
    width: 130,
    render: (amount: number) => <CellText>{formatSalaryMoney(amount)}</CellText>
  },
  {
    title: '月均实发',
    dataIndex: 'averageNetSalary',
    width: 130,
    render: (amount: number) => <CellText>{formatSalaryMoney(amount)}</CellText>
  }
];

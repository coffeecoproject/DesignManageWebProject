import {
  getDateScopeMonthRange,
  getDateScopeRange,
  type DateRangeFilterValue,
  type DateScopeFilterValue
} from '../../components/DateFilterFields';
import { salaryDetailDefaultMonth } from './salaryMonthlyDisplayModel';
import type { SalaryMonthlyReport } from './salaryDomain';

export type SalaryOverviewBoardType = '应发' | '扣减' | '实发';

export type SalaryOverviewFilters = {
  keyword: string;
  salaryTime: DateScopeFilterValue;
};

export type SalaryOverviewBoardRow = {
  averageAmount: number;
  employeeCount: number;
  id: string;
  label: string;
  recordCount: number;
  totalAmount: number;
  type: SalaryOverviewBoardType;
};

export type SalaryOverviewEmployeeRow = {
  averageNetSalary: number;
  deductionAmount: number;
  grossSalary: number;
  id: string;
  memberId: string;
  memberName: string;
  monthCount: number;
  netSalary: number;
  performancePayAmount: number;
  personnelType: string;
  position: string;
  rank: number;
  recordCount: number;
};

export type SalaryOverviewSummary = {
  averageDeductionAmount: number;
  averageGrossSalary: number;
  averageNetSalary: number;
  deductionAmount: number;
  employeeCount: number;
  grossSalary: number;
  netSalary: number;
  recordCount: number;
  settledCount: number;
};

export type SalaryOverviewResult = {
  boardRows: SalaryOverviewBoardRow[];
  employeeRows: SalaryOverviewEmployeeRow[];
  summary: SalaryOverviewSummary;
};

type SalaryOverviewBoardDefinition = {
  id: string;
  label: string;
  type: SalaryOverviewBoardType;
  getAmount: (report: SalaryMonthlyReport) => number;
};

const salaryOverviewBoardDefinitions: SalaryOverviewBoardDefinition[] = [
  {
    id: 'base-salary',
    label: '本月基础薪资',
    type: '应发',
    getAmount: (report) => report.baseSalaryAmount
  },
  {
    id: 'performance-prepay',
    label: '绩效预发',
    type: '应发',
    getAmount: (report) => report.performancePayAmount
  },
  {
    id: 'attendance-increase',
    label: '考勤补发',
    type: '应发',
    getAmount: (report) => report.attendanceIncreaseAmount
  },
  {
    id: 'salary-adjustment-increase',
    label: '薪酬调增',
    type: '应发',
    getAmount: (report) => report.salaryAdjustmentIncreaseAmount
  },
  {
    id: 'attendance-deduction',
    label: '考勤扣减',
    type: '扣减',
    getAmount: (report) => report.attendanceDeductionAmount
  },
  {
    id: 'salary-adjustment-deduction',
    label: '薪酬调减',
    type: '扣减',
    getAmount: (report) => report.salaryAdjustmentDeductionAmount
  },
  {
    id: 'social-insurance',
    label: '社保公积金',
    type: '扣减',
    getAmount: (report) => report.socialInsuranceDeductionAmount
  },
  {
    id: 'personal-income-tax',
    label: '个人所得税',
    type: '扣减',
    getAmount: (report) => report.personalIncomeTaxAmount
  },
  {
    id: 'net-salary',
    label: '实发工资',
    type: '实发',
    getAmount: (report) => report.netSalary
  }
];

export const salaryOverviewDefaultMonth = salaryDetailDefaultMonth;

export const defaultSalaryOverviewFilters: SalaryOverviewFilters = {
  keyword: '',
  salaryTime: { mode: 'currentMonth' }
};

function roundSalaryOverviewAmount(value: number) {
  return Math.round(value * 100) / 100;
}

function averageAmount(total: number, count: number) {
  return count > 0 ? roundSalaryOverviewAmount(total / count) : 0;
}

function isSalaryMonthInRange(month: string, range?: DateRangeFilterValue) {
  if (!range) {
    return true;
  }

  const monthRange = getDateScopeMonthRange(month);

  return monthRange.startDate <= range.endDate && monthRange.endDate >= range.startDate;
}

function getSingleSalaryMonthFromScope(salaryTime: DateScopeFilterValue, defaultMonth = salaryOverviewDefaultMonth) {
  if (salaryTime.mode === 'currentMonth') {
    return defaultMonth;
  }

  if (salaryTime.mode === 'month') {
    return salaryTime.month;
  }

  return undefined;
}

export function getSalaryOverviewReportMonths({
  defaultMonth = salaryOverviewDefaultMonth,
  salaryDetailMonths,
  salaryTime
}: {
  defaultMonth?: string;
  salaryDetailMonths: string[];
  salaryTime: DateScopeFilterValue;
}) {
  const singleMonth = getSingleSalaryMonthFromScope(salaryTime, defaultMonth);

  if (singleMonth) {
    return [singleMonth];
  }

  const salaryRange = getDateScopeRange(salaryTime, defaultMonth);

  return salaryDetailMonths
    .filter((month) => isSalaryMonthInRange(month, salaryRange))
    .sort((left, right) => right.localeCompare(left));
}

export function matchesSalaryOverviewReport(report: SalaryMonthlyReport, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  return [
    report.member.id,
    report.member.name,
    report.member.personnelType,
    report.member.position,
    report.month,
    report.status
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
}

function buildSalaryOverviewBoardRows(reports: SalaryMonthlyReport[]): SalaryOverviewBoardRow[] {
  return salaryOverviewBoardDefinitions.map((definition) => {
    const activeReports = reports.filter((report) => definition.getAmount(report) > 0);
    const totalAmount = roundSalaryOverviewAmount(
      activeReports.reduce((total, report) => total + definition.getAmount(report), 0)
    );
    const employeeCount = new Set(activeReports.map((report) => report.member.id)).size;

    return {
      averageAmount: averageAmount(totalAmount, employeeCount),
      employeeCount,
      id: definition.id,
      label: definition.label,
      recordCount: activeReports.length,
      totalAmount,
      type: definition.type
    };
  });
}

function buildSalaryOverviewEmployeeRows(reports: SalaryMonthlyReport[]): SalaryOverviewEmployeeRow[] {
  const rowsByMemberId = reports.reduce((currentRows, report) => {
    const row = currentRows.get(report.member.id) ?? {
      deductionAmount: 0,
      grossSalary: 0,
      memberId: report.member.id,
      memberName: report.member.name,
      months: new Set<string>(),
      netSalary: 0,
      performancePayAmount: 0,
      personnelType: report.member.personnelType,
      position: report.member.position,
      recordCount: 0
    };

    row.deductionAmount = roundSalaryOverviewAmount(row.deductionAmount + report.deductionAmount);
    row.grossSalary = roundSalaryOverviewAmount(row.grossSalary + report.grossSalary);
    row.months.add(report.month);
    row.netSalary = roundSalaryOverviewAmount(row.netSalary + report.netSalary);
    row.performancePayAmount = roundSalaryOverviewAmount(row.performancePayAmount + report.performancePayAmount);
    row.recordCount += 1;
    currentRows.set(report.member.id, row);

    return currentRows;
  }, new Map<string, {
    deductionAmount: number;
    grossSalary: number;
    memberId: string;
    memberName: string;
    months: Set<string>;
    netSalary: number;
    performancePayAmount: number;
    personnelType: string;
    position: string;
    recordCount: number;
  }>());

  return Array.from(rowsByMemberId.values())
    .map((row) => {
      const monthCount = row.months.size;

      return {
        averageNetSalary: averageAmount(row.netSalary, monthCount),
        deductionAmount: row.deductionAmount,
        grossSalary: row.grossSalary,
        id: row.memberId,
        memberId: row.memberId,
        memberName: row.memberName,
        monthCount,
        netSalary: row.netSalary,
        performancePayAmount: row.performancePayAmount,
        personnelType: row.personnelType,
        position: row.position,
        rank: 0,
        recordCount: row.recordCount
      };
    })
    .sort(
      (left, right) =>
        right.netSalary - left.netSalary ||
        right.averageNetSalary - left.averageNetSalary ||
        left.memberName.localeCompare(right.memberName, 'zh-CN')
    )
    .map((row, index) => ({
      ...row,
      rank: index + 1
    }));
}

export function buildSalaryOverview(reports: SalaryMonthlyReport[]): SalaryOverviewResult {
  const employeeCount = new Set(reports.map((report) => report.member.id)).size;
  const grossSalary = roundSalaryOverviewAmount(reports.reduce((total, report) => total + report.grossSalary, 0));
  const deductionAmount = roundSalaryOverviewAmount(reports.reduce((total, report) => total + report.deductionAmount, 0));
  const netSalary = roundSalaryOverviewAmount(reports.reduce((total, report) => total + report.netSalary, 0));

  return {
    boardRows: buildSalaryOverviewBoardRows(reports),
    employeeRows: buildSalaryOverviewEmployeeRows(reports),
    summary: {
      averageDeductionAmount: averageAmount(deductionAmount, employeeCount),
      averageGrossSalary: averageAmount(grossSalary, employeeCount),
      averageNetSalary: averageAmount(netSalary, employeeCount),
      deductionAmount,
      employeeCount,
      grossSalary,
      netSalary,
      recordCount: reports.length,
      settledCount: reports.filter((report) => report.status === '已结算').length
    }
  };
}

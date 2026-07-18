import type { DateScopeFilterValue } from '../../components/DateFilterFields';
import {
  formatSalaryMoney,
  getSalaryAdjustmentDirection,
  salaryStandardPayrollHours,
  type SalaryAdjustmentRecord,
  type SalaryAdjustmentTaxTreatment,
  type SalaryAdjustmentType,
  type SalaryMonthlyReport
} from './salaryDomain';

export type SalaryMonthlyStatusFilter = '全部' | SalaryMonthlyReport['status'];

export type SalaryMonthlyFilters = {
  keyword: string;
  salaryTime: DateScopeFilterValue;
  status: SalaryMonthlyStatusFilter;
};

export type StatutoryDeductionDisplayRow = {
  baseAmount: number;
  category: string;
  id: string;
  note?: string;
  payrollMonth: string;
  personalAmount: number;
  sourceMonth: string;
};

export type SalaryPayslipStatus = '暂不可查看' | '预览' | '待发放' | '已发放';

export type SalaryPayslipLine = {
  deductionAmount?: number;
  id: string;
  incomeAmount?: number;
  item: string;
  note: string;
};

export type SalaryPerformanceSettlementDisplayRow = {
  amount: number;
  id: string;
  kind: SalaryMonthlyReport['performanceSettlementLines'][number]['kind'];
  note: string;
  performancePeriod: string;
  sourceLabel: string;
};

export type SalaryAdjustmentFormValue = {
  amount: number | null;
  memberId?: string;
  month: string;
  reason: string;
  taxTreatment: SalaryAdjustmentTaxTreatment;
  type: SalaryAdjustmentType;
};

export const salaryDetailDefaultMonth = '2026-06';

export const defaultSalaryMonthlyFilters: SalaryMonthlyFilters = {
  keyword: '',
  salaryTime: { mode: 'currentMonth' },
  status: '全部'
};

export const salaryMonthlyStatusTone = {
  结算中: 'amber',
  待确认: 'blue',
  已确认: 'blue',
  已发放: 'green'
} as const;

export const salaryAdjustmentDirectionTone = {
  增加: 'green',
  减少: 'amber'
} as const;

export const salarySettlementSourceStatusTone = {
  待确认: 'amber',
  已确认: 'green',
  本月不扣: 'gray',
  不适用: 'gray'
} as const;

export const salaryCompositionDirectionTone = {
  应发: 'green',
  扣减: 'amber'
} as const;

export const salaryPayslipStatusTone = {
  暂不可查看: 'gray',
  预览: 'amber',
  待发放: 'blue',
  已发放: 'green'
} as const;

export const salaryAdjustmentTypeOptions: SalaryAdjustmentType[] = ['奖金', '补贴', '补发', '误发追回', '代垫款收回'];
export const salaryAdjustmentTaxTreatmentOptions: SalaryAdjustmentTaxTreatment[] = ['税前计税', '税前免税', '税后调整'];

export function normalizeDateString(dateString: string | string[]) {
  return Array.isArray(dateString) ? dateString[0] ?? '' : dateString;
}

export function formatDays(days: number) {
  if (!Number.isFinite(days)) {
    return '-';
  }

  return `${Number.isInteger(days) ? days : days.toFixed(2).replace(/0$/, '')} 天`;
}

export function formatHours(hours: number) {
  if (!Number.isFinite(hours)) {
    return '-';
  }

  return `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/0$/, '')} 小时`;
}

export function formatSignedMoney(amount: number) {
  if (amount > 0) {
    return `+${formatSalaryMoney(amount)}`;
  }

  if (amount < 0) {
    return `-${formatSalaryMoney(Math.abs(amount))}`;
  }

  return formatSalaryMoney(0);
}

export function getStatutoryDeductionRows(report: SalaryMonthlyReport): StatutoryDeductionDisplayRow[] {
  return [
    ...report.socialInsuranceDeductionRecords.map((record) => ({
      baseAmount: record.contributionBase,
      category: record.category,
      id: record.id,
      note: record.reason,
      payrollMonth: record.payrollMonth,
      personalAmount: record.personalAmount,
      sourceMonth: record.sourceMonth
    })),
    ...report.personalIncomeTaxRecords.map((record) => ({
      baseAmount: record.currentTaxableIncomeAmount,
      category: '个税',
      id: record.id,
      note: record.reason,
      payrollMonth: record.payrollMonth,
      personalAmount: record.amount,
      sourceMonth: record.sourceMonth
    }))
  ];
}

export function getSalaryPerformanceSettlementRows(
  report: SalaryMonthlyReport
): SalaryPerformanceSettlementDisplayRow[] {
  const sourceRecordsById = new Map(
    report.performanceRecords.map((record) => [record.id, record])
  );

  return report.performanceSettlementLines.map((line) => {
    const sourceRecord = sourceRecordsById.get(line.sourceRecordId);
    const performancePeriod = sourceRecord?.quarterlyReviewResult?.reviewPeriod
      ?? line.performanceMonth;

    return {
      amount: line.amount,
      id: line.salarySettlementReference,
      kind: line.kind,
      note: line.deferredFromMonth
        ? `原计划进入 ${line.deferredFromMonth} 薪酬，因原薪酬已确认转入本月`
        : `${sourceRecord?.ruleName ?? '绩效规则'} / 本月直接计入`,
      performancePeriod,
      sourceLabel: sourceRecord?.sourceLabel ?? '正式绩效结果'
    };
  });
}

export function getSalaryPayslipStatus(report: SalaryMonthlyReport): SalaryPayslipStatus {
  if (report.status === '结算中') {
    return '暂不可查看';
  }

  if (report.status === '待确认') {
    return '预览';
  }

  return report.status === '已发放' ? '已发放' : '待发放';
}

export function getSalaryPayslipNo(report: SalaryMonthlyReport) {
  const status = getSalaryPayslipStatus(report);

  if (status === '暂不可查看') {
    return '-';
  }

  if (status === '预览') {
    return '预览未编号';
  }

  return report.workflow?.payrollNo ?? '-';
}

function sumSocialInsuranceDeduction(report: SalaryMonthlyReport, category: '社保' | '公积金') {
  return report.socialInsuranceDeductionRecords
    .filter((record) => record.category === category)
    .reduce((total, record) => total + record.personalAmount, 0);
}

export function getSalaryPayslipLines(report: SalaryMonthlyReport): SalaryPayslipLine[] {
  const attendanceIncomeAmount = Math.max(0, report.attendanceDeltaAmount);
  const attendanceDeductionAmount = Math.abs(Math.min(0, report.attendanceDeltaAmount));
  const adjustmentIncomeAmount = Math.max(0, report.salaryAdjustmentAmount);
  const adjustmentDeductionAmount = Math.abs(Math.min(0, report.salaryAdjustmentAmount));

  return [
    {
      id: 'payslip-base-salary',
      incomeAmount: report.baseSalaryAmount,
      item: '基础薪资',
      note: `${report.baseSalaryText} / 计薪 ${formatHours(report.baseSalaryPayableHours)}`
    },
    {
      deductionAmount: Math.abs(Math.min(0, report.performancePayAmount)),
      id: 'payslip-performance',
      incomeAmount: Math.max(0, report.performancePayAmount),
      item: '绩效计入',
      note: `月度预发 ${formatSalaryMoney(report.performancePrepayAmount)} / 季度差额 ${formatSalaryMoney(report.performanceQuarterlyAdjustmentAmount)}`
    },
    {
      deductionAmount: attendanceDeductionAmount,
      id: 'payslip-attendance',
      incomeAmount: attendanceIncomeAmount,
      item: '考勤影响',
      note: `${formatHours(report.payableAttendanceHours)} 计薪出勤 / ${salaryStandardPayrollHours} 小时基准`
    },
    {
      deductionAmount: adjustmentDeductionAmount,
      id: 'payslip-adjustment',
      incomeAmount: adjustmentIncomeAmount,
      item: '薪酬调整',
      note: report.salaryAdjustmentRecords.length > 0 ? '本月调整' : '无调整'
    },
    {
      deductionAmount: sumSocialInsuranceDeduction(report, '社保'),
      id: 'payslip-social-insurance',
      item: '社保个人承担',
      note: '本月扣减'
    },
    {
      deductionAmount: sumSocialInsuranceDeduction(report, '公积金'),
      id: 'payslip-housing-fund',
      item: '公积金个人承担',
      note: '本月扣减'
    },
    {
      deductionAmount: report.personalIncomeTaxAmount,
      id: 'payslip-personal-tax',
      item: '个人所得税',
      note: '本月扣减'
    }
  ];
}

export function formatPayslipAmount(amount: number | undefined) {
  return amount === undefined ? '-' : formatSalaryMoney(amount);
}

export function createSalaryAdjustmentForm(month: string): SalaryAdjustmentFormValue {
  return {
    amount: 500,
    memberId: undefined,
    month,
    reason: '',
    taxTreatment: '税前计税',
    type: '补贴'
  };
}

export function createSalaryAdjustmentFormFromRecord(record: SalaryAdjustmentRecord): SalaryAdjustmentFormValue {
  return {
    amount: record.amount,
    memberId: record.memberId,
    month: record.month,
    reason: record.reason,
    taxTreatment: record.taxTreatment,
    type: record.type
  };
}

export function setSalaryAdjustmentFormMonth(form: SalaryAdjustmentFormValue, month: string): SalaryAdjustmentFormValue {
  return {
    ...form,
    memberId: undefined,
    month
  };
}

export function getSalaryMonthlyAccountingPeriod(month: string) {
  return month;
}

export function getSalaryAdjustmentMemberOptions(reports: SalaryMonthlyReport[]) {
  return reports
    .filter((report) => report.canAdjust)
    .map((report) => ({
      label: `${report.member.name} / ${report.member.id} / ${report.member.position}`,
      value: report.member.id
    }));
}

export function getSalaryAdjustmentSelectedReport(
  reports: SalaryMonthlyReport[],
  form: SalaryAdjustmentFormValue
) {
  return reports.find((report) => report.member.id === form.memberId);
}

export function isSalaryAdjustmentFormValid(
  form: SalaryAdjustmentFormValue,
  selectedReport: SalaryMonthlyReport | undefined
) {
  return Boolean(
    selectedReport &&
      selectedReport.canAdjust &&
      form.amount &&
      form.amount > 0 &&
      form.reason.trim()
  );
}

export function buildSalaryAdjustmentRecord({
  actor,
  createdAt,
  form,
  selectedReport
}: {
  actor: string;
  createdAt: string;
  form: SalaryAdjustmentFormValue;
  selectedReport: SalaryMonthlyReport;
}): SalaryAdjustmentRecord {
  return {
    amount: Number(form.amount),
    createdAt,
    createdBy: actor,
    id: `salary-adjust-${selectedReport.member.id}-${Date.now()}`,
    memberId: selectedReport.member.id,
    month: selectedReport.month,
    reason: form.reason.trim(),
    source: '薪酬调整',
    status: '已生效',
    taxTreatment: form.taxTreatment,
    type: form.type,
    updatedAt: createdAt
  };
}

export function getSalaryAdjustmentDirectionLabel(type: SalaryAdjustmentType) {
  return getSalaryAdjustmentDirection(type);
}

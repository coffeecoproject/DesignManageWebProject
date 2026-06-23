export const payrollAttendanceMonthlyContractVersion = 'payroll-attendance-monthly-v1' as const;

export type PayrollAttendanceMonthlyContractVersion = typeof payrollAttendanceMonthlyContractVersion;
export type PayrollAttendanceMonthlyReportStatus = '待确认' | '已确认';
export type PayrollAttendanceSalarySettlementStatus = '未结算' | '已结算';
export type PayrollAttendanceDeductionEntryType = '请假' | '调休超额';

export type PayrollAttendanceDeductionEntry = {
  dateText: string;
  hours: number;
  recordId: string;
  type: PayrollAttendanceDeductionEntryType;
};

/**
 * 考勤月报输出给薪酬明细的前端领域契约。
 * 只保留薪酬计算需要的小时、日期、状态和调休覆盖口径，避免薪酬模块穿透考勤月报的页面字段。
 */
export type PayrollAttendanceMonthlyContract = {
  adjustmentHours: number;
  contractVersion: PayrollAttendanceMonthlyContractVersion;
  expectedWorkdayDates: string[];
  expectedWorkHours: number;
  leaveHours: number;
  makeupWorkHours: number;
  memberId: string;
  month: string;
  payableAttendanceHours: number;
  payrollDeductionEntries: PayrollAttendanceDeductionEntry[];
  payrollDeductionHours: number;
  payrollIncreaseHours: number;
  reportId: string;
  reportStatus: PayrollAttendanceMonthlyReportStatus;
  restBalanceHours: number;
  restCoveredHours: number;
  restHours: number;
  restUncoveredHours: number;
  salarySettlementStatus: PayrollAttendanceSalarySettlementStatus;
  sourceModule: '考勤月报';
};

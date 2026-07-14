import { useCallback, useMemo } from 'react';
import { useFinanceSocialInsuranceState } from '../finance/FinanceSocialInsuranceState';
import { buildSocialInsurancePayrollDeductions } from '../finance/financeSocialInsuranceModel';
import { usePerformanceMonthlyRecords } from '../performance/usePerformanceMonthlyRecords';
import { buildAttendanceMonthlyReports } from '../people/peopleAttendanceMonthlyDomain';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { useWorkCalendarState } from '../system/WorkCalendarState';
import {
  buildSalaryMonthlyReports,
  getSalaryPerformanceSettlementMonths
} from './salaryDomain';
import { useSalaryManagementState } from './SalaryManagementState';

export function useSalaryMonthlyReportBuilder() {
  const {
    attendanceMonthlyAdjustments,
    attendanceMonthlyConfirmations,
    attendanceRecords,
    peopleRows
  } = usePeopleOrganizationState();
  const { annualExceptionRows, workCalendarRows } = useWorkCalendarState();
  const salaryState = useSalaryManagementState();
  const { socialInsuranceRecords } = useFinanceSocialInsuranceState();
  const performanceRecords = usePerformanceMonthlyRecords().categoryRecords;
  const salaryReportMonths = useMemo(
    () => [
      ...new Set([
        ...salaryState.salaryDetailMonths,
        ...getSalaryPerformanceSettlementMonths({
          performanceRecords,
          salaryMonthlyWorkflows: salaryState.salaryMonthlyWorkflows
        })
      ])
    ].sort((left, right) => right.localeCompare(left)),
    [performanceRecords, salaryState.salaryDetailMonths, salaryState.salaryMonthlyWorkflows]
  );

  const buildAttendanceReportsForMonth = useCallback(
    (month: string) =>
      buildAttendanceMonthlyReports({
        adjustments: attendanceMonthlyAdjustments,
        annualExceptionRows,
        attendanceRecords,
        confirmations: attendanceMonthlyConfirmations,
        month,
        peopleRows,
        salarySettlements: salaryState.attendanceMonthlySalarySettlements,
        workCalendarRows
      }),
    [
      annualExceptionRows,
      attendanceMonthlyAdjustments,
      attendanceMonthlyConfirmations,
      attendanceRecords,
      peopleRows,
      salaryState.attendanceMonthlySalarySettlements,
      workCalendarRows
    ]
  );

  const buildSalaryReportsWithSnapshots = useCallback(
    (month: string, snapshots: typeof salaryState.personalIncomeTaxCumulativeSnapshots) => {
      return buildSalaryMonthlyReports({
        attendanceReports: buildAttendanceReportsForMonth(month),
        performanceRecords,
        personalIncomeTaxCumulativeSnapshots: snapshots,
        personalIncomeTaxProfiles: salaryState.personalIncomeTaxProfiles,
        salaryAdjustments: salaryState.salaryAdjustments,
        salaryMonthlyWorkflows: salaryState.salaryMonthlyWorkflows,
        salaryPaymentRecords: salaryState.salaryPaymentRecords,
        socialInsuranceDeductions: buildSocialInsurancePayrollDeductions(socialInsuranceRecords, month),
        socialInsuranceSourceRecords: socialInsuranceRecords
      });
    },
    [
      buildAttendanceReportsForMonth,
      performanceRecords,
      salaryState.salaryAdjustments,
      salaryState.personalIncomeTaxProfiles,
      salaryState.salaryMonthlyWorkflows,
      salaryState.salaryPaymentRecords,
      socialInsuranceRecords
    ]
  );

  const getSalaryMonthlyReports = useCallback(
    (month: string) => {
      if (!salaryReportMonths.includes(month)) {
        return [];
      }

      return buildSalaryReportsWithSnapshots(month, salaryState.personalIncomeTaxCumulativeSnapshots);
    },
    [
      buildSalaryReportsWithSnapshots,
      salaryState.personalIncomeTaxCumulativeSnapshots,
      salaryReportMonths
    ]
  );

  return {
    getSalaryMonthlyReports,
    salaryReportMonths,
    salaryState
  };
}

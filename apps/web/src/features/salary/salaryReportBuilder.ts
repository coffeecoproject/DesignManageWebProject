import { useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import { useFinanceSocialInsuranceState } from '../finance/FinanceSocialInsuranceState';
import { buildSocialInsurancePayrollDeductions } from '../finance/financeSocialInsuranceModel';
import { usePerformanceResultState } from '../performance/PerformanceResultState';
import { buildAttendanceMonthlyReports } from '../people/peopleAttendanceMonthlyDomain';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { useWorkCalendarState } from '../system/WorkCalendarState';
import {
  buildSalaryMonthlyReports,
  getSalaryPerformanceSettlementMonths
} from './salaryDomain';
import { useSalaryManagementState } from './SalaryManagementState';
import { buildSalaryPerformanceSourceRecords } from './salaryPerformanceConsumptionModel';

export function useSalaryMonthlyReportBuilder() {
  const {
    attendanceMonthlyAdjustments,
    attendanceMonthlyConfirmations,
    attendanceRecords,
    peopleRows
  } = usePeopleOrganizationState();
  const { annualExceptionRows, workCalendarRows } = useWorkCalendarState();
  const salaryState = useSalaryManagementState();
  const { getSocialInsuranceRecordsForPeriod } = useFinanceSocialInsuranceState();
  const { formalResults } = usePerformanceResultState();
  const performanceRecords = useMemo(
    () => buildSalaryPerformanceSourceRecords({
      asOf: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      formalResults,
      salaryMonthlyWorkflows: salaryState.salaryMonthlyWorkflows
    }),
    [formalResults, salaryState.salaryMonthlyWorkflows]
  );
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
      const socialInsuranceRecords = getSocialInsuranceRecordsForPeriod(month);

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
      getSocialInsuranceRecordsForPeriod,
      performanceRecords,
      salaryState.salaryAdjustments,
      salaryState.personalIncomeTaxProfiles,
      salaryState.salaryMonthlyWorkflows,
      salaryState.salaryPaymentRecords
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

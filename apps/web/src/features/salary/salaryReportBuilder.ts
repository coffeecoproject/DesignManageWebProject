import { useCallback } from 'react';
import { useFinanceSocialInsuranceState } from '../finance/FinanceSocialInsuranceState';
import { buildSocialInsurancePayrollDeductions } from '../finance/financeSocialInsuranceModel';
import {
  performanceDrawingTaskMonthlyRecords,
  performanceMonthlyCategoryRecords,
  performanceRulePresets
} from '../performance/performanceMockData';
import { buildPerformanceMonthlyRecords } from '../performance/performanceMonthlyModel';
import { performanceSignatureEmployees, signatureRuleOptions } from '../performance/performanceSignatureArchiveData';
import { buildAttendanceMonthlyReports } from '../people/peopleAttendanceMonthlyDomain';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { useWorkCalendarState } from '../system/WorkCalendarState';
import { buildPersonalIncomeTaxCumulativeSnapshotsFromReports, buildSalaryMonthlyReports } from './salaryDomain';
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
      const performanceRecords = buildPerformanceMonthlyRecords({
        annualExceptionRows,
        categoryRecords: performanceMonthlyCategoryRecords,
        drawingTaskRecords: performanceDrawingTaskMonthlyRecords,
        peopleRows,
        ruleOptions: signatureRuleOptions,
        ruleRows: performanceRulePresets,
        signatureEmployees: performanceSignatureEmployees,
        workCalendarRows
      }).categoryRecords;

      return buildSalaryMonthlyReports({
        attendanceReports: buildAttendanceReportsForMonth(month),
        performanceRecords,
        personalIncomeTaxCumulativeSnapshots: snapshots,
        salaryAdjustments: salaryState.salaryAdjustments,
        salaryMonthlyWorkflows: salaryState.salaryMonthlyWorkflows,
        socialInsuranceDeductions: buildSocialInsurancePayrollDeductions(socialInsuranceRecords, month),
        socialInsuranceSourceRecords: socialInsuranceRecords
      });
    },
    [
      annualExceptionRows,
      buildAttendanceReportsForMonth,
      peopleRows,
      salaryState.salaryAdjustments,
      salaryState.salaryMonthlyWorkflows,
      socialInsuranceRecords,
      workCalendarRows
    ]
  );

  const buildRollingPersonalIncomeTaxSnapshots = useCallback(
    (month: string) => {
      const priorMonths = salaryState.salaryDetailMonths
        .filter((salaryDetailMonth) => salaryDetailMonth < month)
        .sort();

      return priorMonths.reduce(
        (snapshots, priorMonth) =>
          buildPersonalIncomeTaxCumulativeSnapshotsFromReports(
            snapshots,
            buildSalaryReportsWithSnapshots(priorMonth, snapshots)
          ),
        salaryState.personalIncomeTaxCumulativeSnapshots
      );
    },
    [
      buildSalaryReportsWithSnapshots,
      salaryState.salaryDetailMonths,
      salaryState.personalIncomeTaxCumulativeSnapshots
    ]
  );

  const getSalaryMonthlyReports = useCallback(
    (month: string) => {
      if (!salaryState.salaryDetailMonths.includes(month)) {
        return [];
      }

      return buildSalaryReportsWithSnapshots(month, buildRollingPersonalIncomeTaxSnapshots(month));
    },
    [
      buildRollingPersonalIncomeTaxSnapshots,
      buildSalaryReportsWithSnapshots,
      salaryState.salaryDetailMonths,
    ]
  );

  return {
    getSalaryMonthlyReports,
    salaryState
  };
}

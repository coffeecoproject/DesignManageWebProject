// Cross-module wiring: a module declares what it needs from another module, and these hooks hand it the
// provider's data. Modules never import the provider for these needs themselves.
import { useCallback, useMemo } from 'react';
import type { CustomerContractRecord } from '../modules/customers';
import { deriveCustomerContractReceiptViews, useFinanceManagement } from '../modules/finance';
import { getLatestPublishedPerformanceSummary, usePerformanceResults } from '../modules/performance';
import { useSalaryManagementState } from '../modules/salary';
import { useTaskManagementState } from '../modules/tasks';
import { useFinanceSocialInsuranceState } from '../modules/social-insurance';

/** People archive ← social insurance: each person's enrollment facts. */
export function useSocialInsuranceEnrollmentProfiles() {
  return useFinanceSocialInsuranceState().enrollmentProfiles;
}

/** People organization ← salary: settled attendance months and invalidating affected salary months. */
export function usePeopleSalaryLink() {
  return useSalaryManagementState();
}

/** Customer contracts ← finance: receipts derived from posted collections on confirmed receivables. */
export function useCustomerContractReceiptViews(contracts: readonly CustomerContractRecord[]) {
  const { financeRows, receivablePayableRows } = useFinanceManagement();

  return useMemo(
    () => deriveCustomerContractReceiptViews({ contracts, financeRows, receivablePayableRows }),
    [contracts, financeRows, receivablePayableRows]
  );
}

/** Brand management ← tasks: how much of each contract settled tasks have used. */
export function useTaskContractUsageSummaries() {
  return useTaskManagementState().customerTaskContractUsageSummaries;
}

/** Task assignment and personnel tasks ← performance results: an employee's latest published score. */
export function useTaskPerformanceSummaryLookup() {
  const { publishedMonthlyRecords } = usePerformanceResults();

  return useCallback(
    (employeeId: string) => getLatestPublishedPerformanceSummary(publishedMonthlyRecords, employeeId),
    [publishedMonthlyRecords]
  );
}

/** Social insurance ← finance: posted transactions, to mark contributions and corrections as paid. */
export function useSocialInsurancePaymentPostings() {
  return useFinanceManagement().financeRows;
}

/** Payroll ← finance: posted salary payments and the accounting-period close guard. */
export function useSalaryFinanceLink() {
  return useFinanceManagement();
}

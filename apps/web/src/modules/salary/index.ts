// Entry of the salary module: everything other modules and the app use from it.
export { formatSalaryMoney, getSalaryScheduledPaymentDate } from './salaryDomain';
export type { SalaryAdjustmentRecord, SalaryCompositionLine, SalaryMonthlyReport, SalaryMonthlyWorkflowRecord, SalaryOperationRecord, SalaryPaymentRecord, SalarySettlementSnapshot, SalarySettlementSourceRecord } from './salaryDomain';
export { SalaryManagementProvider, useSalaryManagementState } from './SalaryManagementState';
export { getSalaryPayslipNo } from './salaryMonthlyDisplayModel';
export { maskSalaryIitIdentityNo } from './salaryPersonalIncomeTaxModel';
export { useSalaryMonthlyReportBuilder } from './salaryReportBuilder';

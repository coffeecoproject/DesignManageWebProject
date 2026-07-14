import {
  createConfirmedSalaryMonthlyWorkflow,
  isSalaryMonthlyPaid,
  validateSalaryPerformanceSettlementClaim,
  type SalaryMonthlyReport,
  type SalaryMonthlyWorkflowRecord
} from './salaryDomain';

export type ConfirmSalaryMonthlyReportStateInput = {
  confirmedAt: string;
  confirmedBy: string;
  note: string;
  report: SalaryMonthlyReport;
  salaryDetailMonths: string[];
  salaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[];
};

export type ConfirmSalaryMonthlyReportStateResult =
  | {
      reason: string;
      success: false;
    }
  | {
      salaryDetailMonths: string[];
      salaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[];
      success: true;
    };

function upsertSalaryMonthlyWorkflow(
  workflows: SalaryMonthlyWorkflowRecord[],
  memberId: string,
  month: string,
  updater: (workflow: SalaryMonthlyWorkflowRecord | undefined) => SalaryMonthlyWorkflowRecord
) {
  const existingWorkflow = workflows.find(
    (workflow) => workflow.memberId === memberId && workflow.month === month
  );
  const nextWorkflow = updater(existingWorkflow);

  return existingWorkflow
    ? workflows.map((workflow) => (workflow.id === existingWorkflow.id ? nextWorkflow : workflow))
    : [nextWorkflow, ...workflows];
}

export function confirmSalaryMonthlyReportState({
  confirmedAt,
  confirmedBy,
  note,
  report,
  salaryDetailMonths,
  salaryMonthlyWorkflows
}: ConfirmSalaryMonthlyReportStateInput): ConfirmSalaryMonthlyReportStateResult {
  const { month } = report;
  const memberId = report.member.id;

  if (isSalaryMonthlyPaid(salaryMonthlyWorkflows, memberId, month)) {
    return { reason: '工资已发放，不能再确认', success: false };
  }

  const performanceClaimValidation = validateSalaryPerformanceSettlementClaim({
    memberId,
    month,
    salaryMonthlyWorkflows,
    salarySettlementReferences: report.performanceSettlementLines.map(
      (line) => line.salarySettlementReference
    )
  });

  if (!performanceClaimValidation.allowed) {
    return { reason: performanceClaimValidation.reason, success: false };
  }

  return {
    salaryDetailMonths: salaryDetailMonths.includes(month)
      ? salaryDetailMonths
      : [month, ...salaryDetailMonths],
    salaryMonthlyWorkflows: upsertSalaryMonthlyWorkflow(
      salaryMonthlyWorkflows,
      memberId,
      month,
      (workflow) =>
        createConfirmedSalaryMonthlyWorkflow({
          confirmedAt,
          confirmedBy,
          existingWorkflow: workflow,
          memberId,
          month,
          note,
          salarySettlementReferences: report.performanceSettlementLines.map(
            (line) => line.salarySettlementReference
          ),
          settlementSnapshot: report.settlementSnapshot
        })
    ),
    success: true
  };
}

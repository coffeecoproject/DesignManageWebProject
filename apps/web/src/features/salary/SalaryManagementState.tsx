import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  buildSalaryMonthlyWorkflowId,
  isSalaryMonthlySettled,
  toAttendanceMonthlySalarySettlementRecords,
  type SalaryAdjustmentRecord,
  type SalaryPersonalIncomeTaxCumulativeSnapshot,
  type SalaryMonthlyWorkflowRecord
} from './salaryDomain';

type SalaryManagementStateValue = {
  attendanceMonthlySalarySettlements: ReturnType<typeof toAttendanceMonthlySalarySettlementRecords>;
  personalIncomeTaxCumulativeSnapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[];
  salaryAdjustments: SalaryAdjustmentRecord[];
  salaryDetailMonths: string[];
  salaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[];
  confirmSalaryMonthlyReport: (memberId: string, month: string, note?: string) => void;
  saveSalaryAdjustment: (record: SalaryAdjustmentRecord) => boolean;
  settleSalaryMonthlyReport: (memberId: string, month: string, note?: string) => void;
};

export const salaryToday = '2026-06-18';

const initialSalaryDetailMonths = ['2026-06'];

const initialSalaryAdjustments: SalaryAdjustmentRecord[] = [
  {
    amount: 500,
    createdAt: '2026-06-17 10:20',
    createdBy: '周倩',
    id: 'salary-adjust-20260001-001',
    memberId: '20260001',
    month: '2026-06',
    reason: '试用期项目支持补贴，本月一次性计入薪酬',
    source: '薪酬调整',
    status: '已生效',
    type: '补贴',
    updatedAt: '2026-06-17 10:20'
  }
];

const initialPersonalIncomeTaxCumulativeSnapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[] = [
  {
    cumulativeAdditionalDeductionAmount: 0,
    cumulativeBasicDeductionAmount: 10000,
    cumulativeIncomeAmount: 16000,
    cumulativeOtherDeductionAmount: 0,
    cumulativeSpecialDeductionAmount: 4920,
    cumulativeTaxAmount: 32.4,
    cumulativeTaxableIncomeAmount: 1080,
    cumulativeWithheldTaxAmount: 32.4,
    employeeNo: '20260001',
    period: '2026-05',
    taxYear: '2026',
    updatedAt: '2026-05-31'
  },
  {
    cumulativeAdditionalDeductionAmount: 0,
    cumulativeBasicDeductionAmount: 25000,
    cumulativeIncomeAmount: 60000,
    cumulativeOtherDeductionAmount: 0,
    cumulativeSpecialDeductionAmount: 8405,
    cumulativeTaxAmount: 797.85,
    cumulativeTaxableIncomeAmount: 26595,
    cumulativeWithheldTaxAmount: 797.85,
    employeeNo: '20250018',
    period: '2026-05',
    taxYear: '2026',
    updatedAt: '2026-05-31'
  }
];

const initialSalaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[] = [
  {
    confirmedAt: '2026-06-17 10:40',
    confirmedBy: '李明',
    id: buildSalaryMonthlyWorkflowId('2026-06', '20250018'),
    memberId: '20250018',
    month: '2026-06',
    note: '六月工资已完成结算，考勤月报仅保留查看',
    payrollNo: 'PAY-202606-0002',
    settledAt: '2026-06-17 11:10',
    settledBy: '周倩',
    status: '已结算',
    updatedAt: '2026-06-17 11:10'
  }
];

const SalaryManagementContext = createContext<SalaryManagementStateValue | undefined>(undefined);

function upsertWorkflow(
  workflows: SalaryMonthlyWorkflowRecord[],
  memberId: string,
  month: string,
  updater: (workflow: SalaryMonthlyWorkflowRecord | undefined) => SalaryMonthlyWorkflowRecord
) {
  const existingWorkflow = workflows.find((workflow) => workflow.memberId === memberId && workflow.month === month);
  const nextWorkflow = updater(existingWorkflow);

  return existingWorkflow
    ? workflows.map((workflow) => (workflow.id === existingWorkflow.id ? nextWorkflow : workflow))
    : [nextWorkflow, ...workflows];
}

function createPayrollNo(month: string, workflowCount: number) {
  return `PAY-${month.replace('-', '')}-${String(workflowCount + 1).padStart(4, '0')}`;
}

export function SalaryManagementProvider({ children }: { children: ReactNode }) {
  const [salaryDetailMonths, setSalaryDetailMonths] = useState<string[]>(() => initialSalaryDetailMonths);
  const [salaryAdjustments, setSalaryAdjustments] = useState<SalaryAdjustmentRecord[]>(() => initialSalaryAdjustments);
  const [salaryMonthlyWorkflows, setSalaryMonthlyWorkflows] = useState<SalaryMonthlyWorkflowRecord[]>(
    () => initialSalaryMonthlyWorkflows
  );
  const attendanceMonthlySalarySettlements = useMemo(
    () => toAttendanceMonthlySalarySettlementRecords(salaryMonthlyWorkflows),
    [salaryMonthlyWorkflows]
  );

  const value = useMemo<SalaryManagementStateValue>(
    () => ({
      attendanceMonthlySalarySettlements,
      confirmSalaryMonthlyReport(memberId, month, note = '薪酬明细已确认') {
        setSalaryDetailMonths((months) => (months.includes(month) ? months : [month, ...months]));
        setSalaryMonthlyWorkflows((workflows) => {
          if (isSalaryMonthlySettled(workflows, memberId, month)) {
            return workflows;
          }

          return upsertWorkflow(workflows, memberId, month, (workflow) => ({
            id: workflow?.id ?? buildSalaryMonthlyWorkflowId(month, memberId),
            memberId,
            month,
            note,
            payrollNo: workflow?.payrollNo,
            status: '已确认',
            confirmedAt: `${salaryToday} 10:30`,
            confirmedBy: '李明',
            settledAt: undefined,
            settledBy: undefined,
            updatedAt: `${salaryToday} 10:30`
          }));
        });
      },
      personalIncomeTaxCumulativeSnapshots: initialPersonalIncomeTaxCumulativeSnapshots,
      salaryAdjustments,
      salaryDetailMonths,
      salaryMonthlyWorkflows,
      saveSalaryAdjustment(record) {
        if (isSalaryMonthlySettled(salaryMonthlyWorkflows, record.memberId, record.month)) {
          return false;
        }

        setSalaryDetailMonths((months) => (months.includes(record.month) ? months : [record.month, ...months]));
        setSalaryAdjustments((records) =>
          records.some((currentRecord) => currentRecord.id === record.id)
            ? records.map((currentRecord) => (currentRecord.id === record.id ? record : currentRecord))
            : [record, ...records]
        );
        setSalaryMonthlyWorkflows((workflows) =>
          workflows.map((workflow) =>
            workflow.memberId === record.memberId && workflow.month === record.month && workflow.status === '已确认'
              ? {
                  ...workflow,
                  confirmedAt: undefined,
                  confirmedBy: undefined,
                  note: '薪酬调整后需重新确认',
                  status: '待确认',
                  updatedAt: record.updatedAt
                }
              : workflow
          )
        );

        return true;
      },
      settleSalaryMonthlyReport(memberId, month, note = '薪酬明细已结算') {
        setSalaryDetailMonths((months) => (months.includes(month) ? months : [month, ...months]));
        setSalaryMonthlyWorkflows((workflows) => {
          if (isSalaryMonthlySettled(workflows, memberId, month)) {
            return workflows;
          }

          return upsertWorkflow(workflows, memberId, month, (workflow) => ({
            id: workflow?.id ?? buildSalaryMonthlyWorkflowId(month, memberId),
            memberId,
            month,
            note,
            payrollNo: workflow?.payrollNo ?? createPayrollNo(month, workflows.length),
            status: '已结算',
            confirmedAt: workflow?.confirmedAt ?? `${salaryToday} 10:30`,
            confirmedBy: workflow?.confirmedBy ?? '李明',
            settledAt: `${salaryToday} 11:00`,
            settledBy: '周倩',
            updatedAt: `${salaryToday} 11:00`
          }));
        });
      }
    }),
    [attendanceMonthlySalarySettlements, salaryAdjustments, salaryDetailMonths, salaryMonthlyWorkflows]
  );

  return <SalaryManagementContext.Provider value={value}>{children}</SalaryManagementContext.Provider>;
}

export function useSalaryManagementState() {
  const value = useContext(SalaryManagementContext);

  if (!value) {
    throw new Error('useSalaryManagementState must be used within SalaryManagementProvider');
  }

  return value;
}

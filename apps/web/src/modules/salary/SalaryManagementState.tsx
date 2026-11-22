import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  buildPersonalIncomeTaxCumulativeSnapshotsFromPayments,
  buildSalaryMonthlyWorkflowId,
  createConfirmedSalaryMonthlyWorkflow,
  createPaidSalaryMonthlyWorkflow,
  getSalaryScheduledPaymentDate,
  invalidateSalaryMonthlySources as invalidateSalaryMonthlySourcesDomain,
  isSalaryMonthlyPaid,
  recalculateSalaryMonthlyPayment as recalculateSalaryMonthlyPaymentDomain,
  reverseSalaryPaymentByFinanceTransaction,
  toAttendanceMonthlySalarySettlementRecords,
  validateSalaryPaymentConfirmation,
  type SalaryAdjustmentRecord,
  type SalaryMonthlyReport,
  type SalaryPaymentRecalculationResult,
  type SalaryPaymentEvidenceInput,
  type SalaryPaymentRecord,
  type SalaryPersonalIncomeTaxCumulativeSnapshot,
  type SalaryMonthlyWorkflowRecord
} from './salaryDomain';
import { confirmSalaryMonthlyReportState } from './salaryManagementWorkflow';
import {
  initialSalaryIitProfiles,
  type SalaryIitProfile
} from './salaryPersonalIncomeTaxModel';

type SalaryManagementStateValue = {
  attendanceMonthlySalarySettlements: ReturnType<typeof toAttendanceMonthlySalarySettlementRecords>;
  personalIncomeTaxCumulativeSnapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[];
  personalIncomeTaxProfiles: SalaryIitProfile[];
  salaryAdjustments: SalaryAdjustmentRecord[];
  salaryDetailMonths: string[];
  salaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[];
  salaryPaymentRecords: SalaryPaymentRecord[];
  confirmSalaryMonthlyReport: (
    report: SalaryMonthlyReport,
    note?: string
  ) => { reason?: string; success: boolean };
  markSalaryMonthlyPaid: (
    report: SalaryMonthlyReport,
    evidence: SalaryPaymentEvidenceInput,
    note?: string
  ) => { reason?: string; success: boolean };
  recalculateSalaryMonthlyPayment: (
    report: SalaryMonthlyReport,
    paymentDate: string
  ) => SalaryPaymentRecalculationResult;
  reverseSalaryPayment: (
    financeTransactionNo: string,
    occurredAt: string,
    actor: string
  ) => { reason?: string; success: boolean };
  voidSalaryAdjustment: (
    adjustmentId: string,
    occurredAt: string,
    reason: string
  ) => { reason?: string; success: boolean };
  isSalaryAdjustmentPeriodOpen: (record: SalaryAdjustmentRecord) => boolean;
  invalidateSalaryMonthlySources: (
    memberId: string,
    months: string[],
    reason: string,
    updatedAt: string
  ) => { blockedMonths: string[]; invalidatedMonths: string[]; success: boolean };
  saveSalaryAdjustment: (record: SalaryAdjustmentRecord) => boolean;
  savePersonalIncomeTaxProfile: (profile: SalaryIitProfile) => boolean;
};

export const salaryToday = '2026-06-18';

const initialSalaryDetailMonths = ['2026-06', '2026-05'];

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
    taxTreatment: '税前计税',
    type: '补贴',
    updatedAt: '2026-06-17 10:20'
  }
];

const initialPersonalIncomeTaxCumulativeSnapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[] = [
  {
    cumulativeAdditionalDeductionAmount: 5000,
    cumulativeBasicDeductionAmount: 10000,
    cumulativeIncomeAmount: 16000,
    cumulativeOtherDeductionAmount: 0,
    cumulativeSpecialDeductionAmount: 4920,
    cumulativeTaxAmount: 0,
    cumulativeTaxableIncomeAmount: 0,
    cumulativeWithheldTaxAmount: 0,
    employeeNo: '20260001',
    period: '2026-05',
    taxYear: '2026',
    updatedAt: '2026-05-31'
  },
  {
    cumulativeAdditionalDeductionAmount: 12500,
    cumulativeBasicDeductionAmount: 25000,
    cumulativeIncomeAmount: 60000,
    cumulativeOtherDeductionAmount: 5000,
    cumulativeSpecialDeductionAmount: 8405,
    cumulativeTaxAmount: 272.85,
    cumulativeTaxableIncomeAmount: 9095,
    cumulativeWithheldTaxAmount: 272.85,
    employeeNo: '20250018',
    period: '2026-05',
    taxYear: '2026',
    updatedAt: '2026-05-31'
  }
];

const initialMaySalarySettlementSnapshot = {
  businessDeductionAmount: 0,
  employeeAdvanceRecoveryAmount: 0,
  employeeGrossPayableAmount: 12000,
  employeeHousingFundAmount: 0,
  employeeNetPayableAmount: 11059.83,
  employeeSocialInsuranceAmount: 861,
  employerContributionAmount: 2214,
  employerHousingFundAmount: 0,
  employerSocialInsuranceAmount: 2214,
  grossEarningsAmount: 12000,
  payrollMonth: '2026-05',
  payrollNo: 'PAY-202605-20250018',
  taxableIncomeAmount: 12000,
  totalEmploymentCostAmount: 14214,
  withheldPersonalIncomeTaxAmount: 79.17
};

const initialSalaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[] = [
  {
    confirmedAt: '2026-06-17 10:40',
    confirmedBy: '李明',
    id: buildSalaryMonthlyWorkflowId('2026-06', '20250018'),
    memberId: '20250018',
    month: '2026-06',
    note: '六月薪酬明细已确认，等待实际发放',
    payrollNo: 'PAY-202606-20250018',
    settlementSnapshot: {
      businessDeductionAmount: 0,
      employeeAdvanceRecoveryAmount: 0,
      employeeGrossPayableAmount: 12000,
      employeeHousingFundAmount: 0,
      employeeNetPayableAmount: 11059.83,
      employeeSocialInsuranceAmount: 861,
      employerContributionAmount: 2214,
      employerHousingFundAmount: 0,
      employerSocialInsuranceAmount: 2214,
      grossEarningsAmount: 12000,
      payrollMonth: '2026-06',
      payrollNo: 'PAY-202606-20250018',
      taxableIncomeAmount: 12000,
      totalEmploymentCostAmount: 14214,
      withheldPersonalIncomeTaxAmount: 79.17
    },
    status: '已确认',
    updatedAt: '2026-06-17 10:40'
  },
  {
    confirmedAt: '2026-06-10 10:00',
    confirmedBy: '李明',
    id: buildSalaryMonthlyWorkflowId('2026-05', '20250018'),
    memberId: '20250018',
    month: '2026-05',
    note: '五月薪酬已完成实际发放',
    paidAt: '2026-06-15 10:30',
    paidBy: '周倩',
    paymentLifecycleRecords: [
      {
        action: '关联发放流水',
        actor: '周倩',
        financeTransactionNo: 'FIN-202606-0019',
        occurredAt: '2026-06-15 10:30'
      }
    ],
    payrollNo: 'PAY-202605-20250018',
    personalIncomeTaxPeriod: '2026-06',
    salarySettlementReferences: [],
    settlementSnapshot: initialMaySalarySettlementSnapshot,
    status: '已发放',
    updatedAt: '2026-06-15 10:30'
  }
];

const initialSalaryPaymentRecords: SalaryPaymentRecord[] = [
  {
    employeeName: '陈浩',
    employeeNo: '20250018',
    id: 'salary-payment-2026-05-20250018',
    identityNo: '420102199108062048',
    paymentAccountName: '工商银行备用付款户',
    paymentEvidenceStatus: '已核验',
    financeTransactionNo: 'FIN-202606-0019',
    paidAt: '2026-06-15 10:30',
    paidBy: '周倩',
    payrollMonth: '2026-05',
    payrollNo: 'PAY-202605-20250018',
    personalIncomeTaxRecord: {
      amount: 79.17,
      basicDeductionAmount: 5000,
      cumulativeAdditionalDeductionAmount: 15000,
      cumulativeBasicDeductionAmount: 30000,
      cumulativeIncomeAmount: 72000,
      cumulativeOtherDeductionAmount: 5000,
      cumulativeSpecialDeductionAmount: 9266,
      cumulativeTaxAmount: 352.02,
      cumulativeTaxableIncomeAmount: 12734,
      currentAdditionalDeductionAmount: 2500,
      currentIncomeAmount: 12000,
      currentOtherDeductionAmount: 0,
      currentSpecialDeductionAmount: 861,
      currentTaxableIncomeAmount: 3639,
      employeeName: '陈浩',
      employeeNo: '20250018',
      id: 'personal-tax-2026-06-20250018',
      payrollMonth: '2026-05',
      priorCumulativePeriod: '2026-05',
      priorWithheldTaxAmount: 272.85,
      quickDeductionAmount: 0,
      reason: '按实际发放月份累计预扣',
      sourceMonth: '2026-05',
      sourceModule: '薪酬明细',
      taxRate: 0.03
    },
    position: '财务专员',
    settlementSnapshot: initialMaySalarySettlementSnapshot,
    taxPeriod: '2026-06'
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

export function SalaryManagementProvider({ children }: { children: ReactNode }) {
  const [salaryDetailMonths, setSalaryDetailMonths] = useState<string[]>(() => initialSalaryDetailMonths);
  const [salaryAdjustments, setSalaryAdjustments] = useState<SalaryAdjustmentRecord[]>(() => initialSalaryAdjustments);
  const [personalIncomeTaxProfiles, setPersonalIncomeTaxProfiles] = useState<SalaryIitProfile[]>(() => initialSalaryIitProfiles);
  const [salaryMonthlyWorkflows, setSalaryMonthlyWorkflows] = useState<SalaryMonthlyWorkflowRecord[]>(
    () => initialSalaryMonthlyWorkflows
  );
  const [salaryPaymentRecords, setSalaryPaymentRecords] = useState<SalaryPaymentRecord[]>(() => initialSalaryPaymentRecords);
  const personalIncomeTaxCumulativeSnapshots = useMemo(
    () => buildPersonalIncomeTaxCumulativeSnapshotsFromPayments(
      initialPersonalIncomeTaxCumulativeSnapshots,
      salaryPaymentRecords
    ),
    [salaryPaymentRecords]
  );
  const attendanceMonthlySalarySettlements = useMemo(
    () => toAttendanceMonthlySalarySettlementRecords(salaryMonthlyWorkflows),
    [salaryMonthlyWorkflows]
  );

  function isSalaryAdjustmentPeriodOpen(record: SalaryAdjustmentRecord) {
    return !isSalaryMonthlyPaid(salaryMonthlyWorkflows, record.memberId, record.month)
      && !salaryPaymentRecords.some(
        (payment) => payment.employeeNo === record.memberId && payment.payrollMonth === record.month
      );
  }

  const value = useMemo<SalaryManagementStateValue>(
    () => ({
      attendanceMonthlySalarySettlements,
      isSalaryAdjustmentPeriodOpen,
      invalidateSalaryMonthlySources(memberId, months, reason, updatedAt) {
        const result = invalidateSalaryMonthlySourcesDomain(
          salaryMonthlyWorkflows,
          salaryPaymentRecords,
          memberId,
          months,
          reason,
          updatedAt
        );

        if (result.success && result.invalidatedMonths.length > 0) {
          setSalaryMonthlyWorkflows(result.workflows);
        }

        return {
          blockedMonths: result.blockedMonths,
          invalidatedMonths: result.invalidatedMonths,
          success: result.success
        };
      },
      confirmSalaryMonthlyReport(report, note = '薪酬明细已确认') {
        const result = confirmSalaryMonthlyReportState({
          confirmedAt: `${salaryToday} 10:30`,
          confirmedBy: '李明',
          note,
          report,
          salaryDetailMonths,
          salaryMonthlyWorkflows,
        });

        if (!result.success) {
          return result;
        }

        setSalaryDetailMonths(result.salaryDetailMonths);
        setSalaryMonthlyWorkflows(result.salaryMonthlyWorkflows);

        return { success: true };
      },
      personalIncomeTaxCumulativeSnapshots,
      personalIncomeTaxProfiles,
      salaryAdjustments,
      salaryDetailMonths,
      salaryMonthlyWorkflows,
      saveSalaryAdjustment(record) {
        if (!isSalaryAdjustmentPeriodOpen(record)) {
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
                  personalIncomeTaxPeriod: undefined,
                  settlementSnapshot: undefined,
                  status: '待确认',
                  updatedAt: record.updatedAt
                }
              : workflow
          )
        );

        return true;
      },
      savePersonalIncomeTaxProfile(profile) {
        setPersonalIncomeTaxProfiles((profiles) =>
          profiles.some((currentProfile) => currentProfile.employeeNo === profile.employeeNo && currentProfile.taxYear === profile.taxYear)
            ? profiles.map((currentProfile) =>
                currentProfile.employeeNo === profile.employeeNo && currentProfile.taxYear === profile.taxYear
                  ? profile
                  : currentProfile
              )
            : [profile, ...profiles]
        );
        setSalaryMonthlyWorkflows((workflows) =>
          workflows.map((workflow) =>
            workflow.memberId === profile.employeeNo &&
            (workflow.personalIncomeTaxPeriod ?? getSalaryScheduledPaymentDate(workflow.month)).startsWith(profile.taxYear) &&
            workflow.status === '已确认'
              ? {
                  ...workflow,
                  confirmedAt: undefined,
                  confirmedBy: undefined,
                  note: '个税信息更新后需重新核定',
                  personalIncomeTaxPeriod: undefined,
                  settlementSnapshot: undefined,
                  status: '待确认',
                  updatedAt: profile.updatedAt
                }
              : workflow
          )
        );

        return true;
      },
      recalculateSalaryMonthlyPayment(report, paymentDate) {
        const personalIncomeTaxPeriod = paymentDate.slice(0, 7);
        const personalIncomeTaxProfile = personalIncomeTaxProfiles.find(
          (profile) =>
            profile.employeeNo === report.member.id &&
            profile.taxYear === personalIncomeTaxPeriod.slice(0, 4)
        );
        const recalculation = recalculateSalaryMonthlyPaymentDomain({
          paymentDate,
          personalIncomeTaxCumulativeSnapshots,
          personalIncomeTaxProfile,
          report
        });

        if (!recalculation.success) {
          return recalculation;
        }

        setSalaryMonthlyWorkflows((workflows) =>
          workflows.map((workflow) =>
            workflow.id === report.workflow?.id
              ? recalculation.workflow
              : workflow
          )
        );

        return recalculation;
      },
      markSalaryMonthlyPaid(report, evidence, note = '工资已完成实际发放') {
        if (isSalaryMonthlyPaid(salaryMonthlyWorkflows, report.member.id, report.month)) {
          return { reason: '工资已发放，不能重复确认', success: false };
        }

        const personalIncomeTaxProfile = personalIncomeTaxProfiles.find(
          (profile) => profile.employeeNo === report.member.id && profile.taxYear === evidence.occurredAt.slice(0, 4)
        );
        const validation = validateSalaryPaymentConfirmation({
          evidence,
          personalIncomeTaxCumulativeSnapshots,
          personalIncomeTaxProfile,
          report
        });

        if (!validation.allowed) {
          return { reason: validation.reason, success: false };
        }

        const payment = validation.payment;
        const paidAt = payment.paidAt;

        setSalaryDetailMonths((months) => (months.includes(report.month) ? months : [report.month, ...months]));
        setSalaryPaymentRecords((records) => [payment, ...records.filter((record) => record.id !== payment.id)]);
        setSalaryMonthlyWorkflows((workflows) =>
          upsertWorkflow(workflows, report.member.id, report.month, (workflow) =>
            createPaidSalaryMonthlyWorkflow({
              existingWorkflow: workflow ?? createConfirmedSalaryMonthlyWorkflow({
                confirmedAt: `${salaryToday} 10:30`,
                confirmedBy: '李明',
                memberId: report.member.id,
                month: report.month,
                note,
                salaryCompositionLines: report.salaryCompositionLines,
                salarySettlementReferences: report.performanceSettlementLines.map(
                  (line) => line.salarySettlementReference
                ),
                settlementSnapshot: report.settlementSnapshot,
                settlementSourceRecords: report.settlementSourceRecords
              }),
              financeTransactionNo: evidence.financeTransactionNo,
              memberId: report.member.id,
              month: report.month,
              note,
              paidAt,
              paidBy: '周倩'
            })
          )
        );

        return { success: true };
      },
      reverseSalaryPayment(financeTransactionNo, occurredAt, actor) {
        const reversal = reverseSalaryPaymentByFinanceTransaction({
          actor,
          financeTransactionNo,
          occurredAt,
          salaryMonthlyWorkflows,
          salaryPaymentRecords
        });

        if (!reversal.success) {
          return reversal;
        }

        setSalaryPaymentRecords(reversal.salaryPaymentRecords);
        setSalaryMonthlyWorkflows(reversal.salaryMonthlyWorkflows);
        return { success: true };
      },
      voidSalaryAdjustment(adjustmentId, occurredAt, reason) {
        const adjustment = salaryAdjustments.find((record) => record.id === adjustmentId);

        if (!adjustment || adjustment.status === '已作废') {
          return { reason: '薪酬调整不存在或已经作废', success: false };
        }
        if (!isSalaryAdjustmentPeriodOpen(adjustment)) {
          return { reason: '薪酬已经发放，不能直接撤销原调整', success: false };
        }

        setSalaryAdjustments((records) =>
          records.map((record) =>
            record.id === adjustmentId
              ? {
                  ...record,
                  reason: `${record.reason}；撤销原因：${reason}`,
                  status: '已作废',
                  updatedAt: occurredAt
                }
              : record
          )
        );
        return { success: true };
      },
      salaryPaymentRecords
    }),
    [attendanceMonthlySalarySettlements, personalIncomeTaxCumulativeSnapshots, personalIncomeTaxProfiles, salaryAdjustments, salaryDetailMonths, salaryMonthlyWorkflows, salaryPaymentRecords]
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

import {
  getAttendanceMonthRange,
  toPayrollAttendanceMonthlyContract,
  type AttendanceMonthlyReport,
  type AttendanceMonthlySalarySettlementRecord
} from '../people/peopleAttendanceMonthlyDomain';
import type { PayrollAttendanceMonthlyContract } from '../people/peopleAttendanceSalaryContract';
import {
  getPeopleHousingFundStatus,
  getPeopleSalaryModeText,
  isPeopleHousingFundContributionApplicable
} from '../people/peopleDomain';
import type { PeopleMember } from '../people/peopleTypes';
import type { SocialInsuranceEmployeeRecord, SocialInsurancePayrollDeductionRecord } from '../finance/financeSocialInsuranceData';
import {
  getSocialInsurancePayrollSourceState,
  isSocialInsurancePayrollDeductible
} from '../finance/financeSocialInsuranceModel';
import {
  getSalaryIitCurrentBasicDeductionAmount,
  getSalaryIitCurrentDeductionSummary,
  getSalaryIitDeductionSummary,
  isSalaryIitProfileReady,
  type SalaryIitProfile
} from './salaryPersonalIncomeTaxModel';

export type SalaryMonthlyStatus = '结算中' | '待确认' | '已确认' | '已发放';
export type SalaryAdjustmentDirection = '增加' | '减少';
export type SalaryAdjustmentType = '奖金' | '补贴' | '补发' | '误发追回' | '代垫款收回';
export type SalaryAdjustmentTaxTreatment = '税前计税' | '税前免税' | '税后调整';
export type SalaryAdjustmentStatus = '草稿' | '已生效' | '已作废';
export type SalaryAdjustmentDisplayStatus = SalaryAdjustmentStatus | '已锁定';
export type SalarySettlementSourceStatus = '待确认' | '已确认' | '本月不扣' | '不适用';
export type SalarySettlementSourceKey = 'attendance-monthly' | 'social-insurance' | 'housing-fund' | 'personal-income-tax';

export type SalaryAdjustmentRecord = {
  amount: number;
  createdAt: string;
  createdBy: string;
  id: string;
  memberId: string;
  month: string;
  reason: string;
  salarySettlementReference?: string;
  source: '薪酬调整';
  status: SalaryAdjustmentStatus;
  taxTreatment: SalaryAdjustmentTaxTreatment;
  type: SalaryAdjustmentType;
  updatedAt: string;
};

export type SalaryPerformanceSourceRecord = {
  category: string;
  employeeName: string;
  id: string;
  monthlyAmount: number;
  note: string;
  performanceMonth: string;
  prepayAmount: number;
  qualityScore?: number;
  ruleName: string;
  ruleVersion: string;
  salarySettlementReference: string;
  sourceLabel: string;
  sourceTaskCount: number;
  updatedAt: string;
  workNo: string;
  quarterlyReviewResult?: {
    confirmedAt: string;
    finalAmount: number;
    prepayAmount: number;
    reviewPeriod: string;
    salarySettlementReference: string;
    settlementDate: string;
    sourceMonths: string[];
    sourceRecordIds: string[];
  };
};

export type SalaryPerformanceSettlementLine = {
  amount: number;
  deferredFromMonth?: string;
  employeeNo: string;
  kind: '月度预发' | '季度复核差额';
  performanceMonth: string;
  salaryMonth: string;
  salarySettlementReference: string;
  sourceRecordId: string;
};

export type SalaryCompositionLine = {
  amount: number;
  direction: '应发' | '扣减';
  id: string;
  item: string;
  note: string;
  source: string;
};

export type SalaryPersonalIncomeTaxRecord = {
  amount: number;
  basicDeductionAmount: number;
  cumulativeAdditionalDeductionAmount: number;
  cumulativeBasicDeductionAmount: number;
  cumulativeIncomeAmount: number;
  cumulativeOtherDeductionAmount: number;
  cumulativeSpecialDeductionAmount: number;
  cumulativeTaxAmount: number;
  cumulativeTaxableIncomeAmount: number;
  currentAdditionalDeductionAmount: number;
  currentIncomeAmount: number;
  currentOtherDeductionAmount: number;
  currentSpecialDeductionAmount: number;
  currentTaxableIncomeAmount: number;
  employeeName: string;
  employeeNo: string;
  id: string;
  payrollMonth: string;
  priorCumulativePeriod?: string;
  priorWithheldTaxAmount: number;
  quickDeductionAmount: number;
  reason?: string;
  sourceMonth: string;
  sourceModule: '薪酬明细';
  taxRate: number;
};

export type SalaryPersonalIncomeTaxCumulativeSnapshot = {
  cumulativeAdditionalDeductionAmount: number;
  cumulativeBasicDeductionAmount: number;
  cumulativeIncomeAmount: number;
  cumulativeOtherDeductionAmount: number;
  cumulativeSpecialDeductionAmount: number;
  cumulativeTaxAmount: number;
  cumulativeTaxableIncomeAmount: number;
  cumulativeWithheldTaxAmount: number;
  employeeNo: string;
  period: string;
  taxYear: string;
  updatedAt: string;
};

export type SalarySettlementSnapshot = {
  businessDeductionAmount: number;
  employeeAdvanceRecoveryAmount: number;
  employeeGrossPayableAmount: number;
  employeeHousingFundAmount: number;
  employeeNetPayableAmount: number;
  employeeSocialInsuranceAmount: number;
  employerContributionAmount: number;
  employerHousingFundAmount: number;
  employerSocialInsuranceAmount: number;
  grossEarningsAmount: number;
  payrollMonth: string;
  payrollNo: string;
  taxableIncomeAmount: number;
  totalEmploymentCostAmount: number;
  withheldPersonalIncomeTaxAmount: number;
};

export type SalaryPaymentRecord = {
  employeeName: string;
  employeeNo: string;
  id: string;
  identityNo?: string;
  paymentAccountName?: string;
  paymentEvidenceStatus: '待核验' | '已核验';
  financeTransactionNo?: string;
  paidAt: string;
  paidBy: string;
  payrollMonth: string;
  payrollNo: string;
  personalIncomeTaxRecord?: SalaryPersonalIncomeTaxRecord;
  position: string;
  settlementSnapshot: SalarySettlementSnapshot;
  taxPeriod: string;
};

export type SalaryPaymentEvidenceInput = {
  accountName: string;
  amount: number;
  financeTransactionNo: string;
  occurredAt: string;
  payrollNo: string;
  status: '已入账';
};

export type SalaryPaymentValidationResult =
  | { allowed: true; payment: SalaryPaymentRecord }
  | { allowed: false; reason: string };

export type SalaryPaymentRecalculationResult =
  | {
      personalIncomeTaxPeriod: string;
      settlementSnapshot: SalarySettlementSnapshot;
      success: true;
      workflow: SalaryMonthlyWorkflowRecord;
    }
  | { reason: string; success: false };

export type SalaryPaymentReversalResult =
  | {
      payment: SalaryPaymentRecord;
      salaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[];
      salaryPaymentRecords: SalaryPaymentRecord[];
      success: true;
    }
  | { reason: string; success: false };

export type SalaryPerformanceSettlementValidationResult =
  | { allowed: true }
  | {
      allowed: false;
      conflictingPayrollNo: string;
      conflictingReference: string;
      reason: string;
    };

export type SalarySettlementSourceRecord = {
  amount: number;
  id: string;
  key: SalarySettlementSourceKey;
  label: string;
  note: string;
  payrollMonth: string;
  sourceMonth: string;
  status: SalarySettlementSourceStatus;
};

export type SalaryMonthlyWorkflowRecord = {
  confirmedAt?: string;
  confirmedBy?: string;
  id: string;
  memberId: string;
  month: string;
  note: string;
  payrollNo?: string;
  paidAt?: string;
  paidBy?: string;
  paymentLifecycleRecords?: SalaryPaymentLifecycleRecord[];
  personalIncomeTaxPeriod?: string;
  salaryCompositionLines?: SalaryCompositionLine[];
  salarySettlementReferences?: string[];
  settlementSnapshot?: SalarySettlementSnapshot;
  settlementSourceRecords?: SalarySettlementSourceRecord[];
  status: SalaryMonthlyStatus;
  updatedAt: string;
};

export type SalaryPaymentLifecycleRecord = {
  action: '关联发放流水' | '发放流水冲正';
  actor: string;
  financeTransactionNo: string;
  occurredAt: string;
};

export type SalaryOperationRecord = {
  action: string;
  actor: string;
  id: string;
  object: string;
  summary: string;
  time: string;
};

export type SalaryMonthlyReport = {
  attendanceAdjustmentAmount: number;
  attendanceDeductionAmount: number;
  attendanceDeltaAmount: number;
  attendanceIncreaseAmount: number;
  attendanceReport: AttendanceMonthlyReport;
  baseSalaryAmount: number;
  baseSalaryPayableHours: number;
  baseSalaryText: string;
  canAdjust: boolean;
  canConfirm: boolean;
  canPay: boolean;
  deductionAmount: number;
  expectedWorkHours: number;
  expectedWorkdays: number;
  grossSalary: number;
  id: string;
  member: PeopleMember;
  monthlyBaseSalaryAmount: number;
  month: string;
  netSalary: number;
  operationRecords: SalaryOperationRecord[];
  payableAttendanceDays: number;
  payableAttendanceHours: number;
  personalIncomeTaxAmount: number;
  personalIncomeTaxRecords: SalaryPersonalIncomeTaxRecord[];
  performancePayAmount: number;
  performancePrepayAmount: number;
  performanceQuarterlyAdjustmentAmount: number;
  performanceRecords: SalaryPerformanceSourceRecord[];
  performanceSettlementLines: SalaryPerformanceSettlementLine[];
  performanceTotalAmount: number;
  salaryAdjustmentAmount: number;
  salaryAdjustmentDeductionAmount: number;
  salaryAdjustmentIncreaseAmount: number;
  salaryAdjustmentRecords: SalaryAdjustmentRecord[];
  salaryCompositionLines: SalaryCompositionLine[];
  salaryMode: ReturnType<typeof getPeopleSalaryModeText>;
  settlementPendingSourceLabels: string[];
  settlementSnapshot: SalarySettlementSnapshot;
  settlementSourceRecords: SalarySettlementSourceRecord[];
  socialInsuranceDeductionAmount: number;
  socialInsuranceDeductionRecords: SocialInsurancePayrollDeductionRecord[];
  status: SalaryMonthlyStatus;
  taxableSalaryIncomeAmount: number;
  workflow?: SalaryMonthlyWorkflowRecord;
};

type BuildSalaryMonthlyReportsInput = {
  attendanceReports: AttendanceMonthlyReport[];
  performanceRecords: SalaryPerformanceSourceRecord[];
  salaryAdjustments: SalaryAdjustmentRecord[];
  salaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[];
  salaryPaymentRecords?: SalaryPaymentRecord[];
  personalIncomeTaxCumulativeSnapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[];
  personalIncomeTaxProfiles?: SalaryIitProfile[];
  socialInsuranceDeductions: SocialInsurancePayrollDeductionRecord[];
  socialInsuranceSourceRecords: SocialInsuranceEmployeeRecord[];
};

export const salaryAdjustmentTypeDirectionMap = {
  奖金: '增加',
  补贴: '增加',
  补发: '增加',
  误发追回: '减少',
  代垫款收回: '减少'
} as const satisfies Record<SalaryAdjustmentType, SalaryAdjustmentDirection>;

const moneyFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

export const salaryStandardPayrollDays = 21.75;
export const salaryStandardPayrollDayHours = 8;
export const salaryStandardPayrollHours = salaryStandardPayrollDays * salaryStandardPayrollDayHours;

export function getSalaryScheduledPaymentDate(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return '';
  }

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const paymentYear = monthNumber === 12 ? year + 1 : year;
  const paymentMonth = monthNumber === 12 ? 1 : monthNumber + 1;

  return `${paymentYear}-${String(paymentMonth).padStart(2, '0')}-15`;
}

export function buildSalaryMonthlyReportId(month: string, memberId: string) {
  return `${month}-${memberId}`;
}

export function buildSalaryMonthlyWorkflowId(month: string, memberId: string) {
  return `salary-monthly-${month}-${memberId}`;
}

export function buildSalaryPayrollNo(month: string, memberId: string) {
  return `PAY-${month.replace(/-/g, '')}-${memberId}`;
}

export function createConfirmedSalaryMonthlyWorkflow({
  confirmedAt,
  confirmedBy,
  existingWorkflow,
  memberId,
  month,
  note,
  salaryCompositionLines,
  salarySettlementReferences = [],
  settlementSnapshot,
  settlementSourceRecords
}: {
  confirmedAt: string;
  confirmedBy: string;
  existingWorkflow?: SalaryMonthlyWorkflowRecord;
  memberId: string;
  month: string;
  note: string;
  salaryCompositionLines: SalaryCompositionLine[];
  salarySettlementReferences?: string[];
  settlementSnapshot: SalarySettlementSnapshot;
  settlementSourceRecords: SalarySettlementSourceRecord[];
}): SalaryMonthlyWorkflowRecord {
  return {
    id: existingWorkflow?.id ?? buildSalaryMonthlyWorkflowId(month, memberId),
    memberId,
    month,
    note,
    payrollNo: existingWorkflow?.payrollNo || buildSalaryPayrollNo(month, memberId),
    status: '已确认',
    confirmedAt,
    confirmedBy,
    paidAt: undefined,
    paidBy: undefined,
    salaryCompositionLines: salaryCompositionLines.map((line) => ({ ...line })),
    salarySettlementReferences: [...new Set(salarySettlementReferences)].sort(),
    settlementSnapshot,
    settlementSourceRecords: settlementSourceRecords.map((record) => ({ ...record })),
    updatedAt: confirmedAt
  };
}

export function createPaidSalaryMonthlyWorkflow({
  existingWorkflow,
  financeTransactionNo,
  memberId,
  month,
  note,
  paidAt,
  paidBy
}: {
  existingWorkflow?: SalaryMonthlyWorkflowRecord;
  financeTransactionNo?: string;
  memberId: string;
  month: string;
  note: string;
  paidAt: string;
  paidBy: string;
}): SalaryMonthlyWorkflowRecord {
  const paymentLifecycleRecords = financeTransactionNo
    ? [
        ...(existingWorkflow?.paymentLifecycleRecords ?? []),
        {
          action: '关联发放流水' as const,
          actor: paidBy,
          financeTransactionNo,
          occurredAt: paidAt
        }
      ]
    : existingWorkflow?.paymentLifecycleRecords;

  return {
    id: existingWorkflow?.id ?? buildSalaryMonthlyWorkflowId(month, memberId),
    memberId,
    month,
    note,
    payrollNo: existingWorkflow?.payrollNo || buildSalaryPayrollNo(month, memberId),
    status: '已发放',
    confirmedAt: existingWorkflow?.confirmedAt,
    confirmedBy: existingWorkflow?.confirmedBy,
    paidAt,
    paidBy,
    paymentLifecycleRecords,
    personalIncomeTaxPeriod: existingWorkflow?.personalIncomeTaxPeriod,
    salaryCompositionLines: existingWorkflow?.salaryCompositionLines?.map((line) => ({ ...line })),
    salarySettlementReferences: existingWorkflow?.salarySettlementReferences
      ? [...existingWorkflow.salarySettlementReferences]
      : [],
    settlementSnapshot: existingWorkflow?.settlementSnapshot,
    settlementSourceRecords: existingWorkflow?.settlementSourceRecords?.map((record) => ({ ...record })),
    updatedAt: paidAt
  };
}

export function reverseSalaryPaymentByFinanceTransaction({
  actor,
  financeTransactionNo,
  occurredAt,
  salaryMonthlyWorkflows,
  salaryPaymentRecords
}: {
  actor: string;
  financeTransactionNo: string;
  occurredAt: string;
  salaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[];
  salaryPaymentRecords: SalaryPaymentRecord[];
}): SalaryPaymentReversalResult {
  const payment = salaryPaymentRecords.find(
    (currentPayment) => currentPayment.financeTransactionNo === financeTransactionNo
  );

  if (!payment) {
    return { reason: `工资流水 ${financeTransactionNo} 缺少对应薪酬付款记录`, success: false };
  }

  const existingWorkflow = salaryMonthlyWorkflows.find(
    (workflow) => workflow.memberId === payment.employeeNo && workflow.month === payment.payrollMonth
  );
  const reopenedWorkflow: SalaryMonthlyWorkflowRecord = {
    confirmedAt: existingWorkflow?.confirmedAt ?? payment.paidAt,
    confirmedBy: existingWorkflow?.confirmedBy ?? payment.paidBy,
    id: existingWorkflow?.id ?? buildSalaryMonthlyWorkflowId(payment.payrollMonth, payment.employeeNo),
    memberId: payment.employeeNo,
    month: payment.payrollMonth,
    note: `${financeTransactionNo} 已冲正，原薪酬核定结果保留，等待重新发放`,
    payrollNo: existingWorkflow?.payrollNo ?? payment.payrollNo,
    paidAt: undefined,
    paidBy: undefined,
    paymentLifecycleRecords: [
      ...(existingWorkflow?.paymentLifecycleRecords ?? [
        {
          action: '关联发放流水' as const,
          actor: payment.paidBy,
          financeTransactionNo,
          occurredAt: payment.paidAt
        }
      ]),
      {
        action: '发放流水冲正',
        actor,
        financeTransactionNo,
        occurredAt
      }
    ],
    personalIncomeTaxPeriod: existingWorkflow?.personalIncomeTaxPeriod ?? payment.taxPeriod,
    salaryCompositionLines: existingWorkflow?.salaryCompositionLines?.map((line) => ({ ...line })),
    salarySettlementReferences: existingWorkflow?.salarySettlementReferences
      ? [...existingWorkflow.salarySettlementReferences]
      : [],
    settlementSnapshot: existingWorkflow?.settlementSnapshot ?? payment.settlementSnapshot,
    settlementSourceRecords: existingWorkflow?.settlementSourceRecords?.map((record) => ({ ...record })),
    status: '已确认',
    updatedAt: occurredAt
  };

  return {
    payment,
    salaryMonthlyWorkflows: existingWorkflow
      ? salaryMonthlyWorkflows.map((workflow) =>
          workflow.id === existingWorkflow.id ? reopenedWorkflow : workflow
        )
      : [reopenedWorkflow, ...salaryMonthlyWorkflows],
    salaryPaymentRecords: salaryPaymentRecords.filter((currentPayment) => currentPayment.id !== payment.id),
    success: true
  };
}

function getNextSalaryMonth(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return month;
  }

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonthNumber = monthNumber === 12 ? 1 : monthNumber + 1;

  return `${nextYear}-${String(nextMonthNumber).padStart(2, '0')}`;
}

function resolvePerformanceSalaryMonth({
  employeeNo,
  requestedMonth,
  salaryMonthlyWorkflows,
  salarySettlementReference
}: {
  employeeNo: string;
  requestedMonth: string;
  salaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[];
  salarySettlementReference: string;
}) {
  const claimedWorkflow = salaryMonthlyWorkflows.find(
    (workflow) =>
      workflow.memberId === employeeNo &&
      workflow.salarySettlementReferences?.includes(salarySettlementReference)
  );

  if (claimedWorkflow) {
    return { salaryMonth: claimedWorkflow.month };
  }

  let salaryMonth = requestedMonth;

  while (
    salaryMonthlyWorkflows.some(
      (workflow) =>
        workflow.memberId === employeeNo
        && workflow.month === salaryMonth
        && (workflow.status === '已确认' || workflow.status === '已发放')
    )
  ) {
    const nextMonth = getNextSalaryMonth(salaryMonth);

    if (nextMonth === salaryMonth) {
      break;
    }

    salaryMonth = nextMonth;
  }

  return {
    deferredFromMonth: salaryMonth === requestedMonth ? undefined : requestedMonth,
    salaryMonth
  };
}

export function buildSalaryPerformanceSettlementLines({
  performanceRecords,
  salaryMonthlyWorkflows
}: {
  performanceRecords: SalaryPerformanceSourceRecord[];
  salaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[];
}): SalaryPerformanceSettlementLine[] {
  const seenReferences = new Set<string>();
  const lines: SalaryPerformanceSettlementLine[] = [];

  function addLine(
    record: SalaryPerformanceSourceRecord,
    input: Pick<SalaryPerformanceSettlementLine, 'amount' | 'kind' | 'salarySettlementReference'> & {
      requestedMonth: string;
    }
  ) {
    if (seenReferences.has(input.salarySettlementReference)) {
      return;
    }

    seenReferences.add(input.salarySettlementReference);
    const allocation = resolvePerformanceSalaryMonth({
      employeeNo: record.workNo,
      requestedMonth: input.requestedMonth,
      salaryMonthlyWorkflows,
      salarySettlementReference: input.salarySettlementReference
    });

    lines.push({
      amount: roundSalaryMoney(input.amount),
      deferredFromMonth: allocation.deferredFromMonth,
      employeeNo: record.workNo,
      kind: input.kind,
      performanceMonth: record.performanceMonth,
      salaryMonth: allocation.salaryMonth,
      salarySettlementReference: input.salarySettlementReference,
      sourceRecordId: record.id
    });
  }

  for (const record of performanceRecords) {
    const quarterlyReference = record.quarterlyReviewResult?.salarySettlementReference;

    if (!quarterlyReference || record.salarySettlementReference !== quarterlyReference) {
      addLine(record, {
        amount: record.prepayAmount,
        kind: '月度预发',
        requestedMonth: record.performanceMonth,
        salarySettlementReference: record.salarySettlementReference
      });
    }

    if (record.quarterlyReviewResult) {
      addLine(record, {
        amount: roundSalaryMoney(
          record.quarterlyReviewResult.finalAmount - record.quarterlyReviewResult.prepayAmount
        ),
        kind: '季度复核差额',
        requestedMonth: record.quarterlyReviewResult.settlementDate.slice(0, 7),
        salarySettlementReference: record.quarterlyReviewResult.salarySettlementReference
      });
    }
  }

  return lines.sort(
    (left, right) =>
      left.salaryMonth.localeCompare(right.salaryMonth) ||
      left.employeeNo.localeCompare(right.employeeNo) ||
      left.salarySettlementReference.localeCompare(right.salarySettlementReference)
  );
}

export function getSalaryPerformanceSettlementMonths({
  performanceRecords,
  salaryMonthlyWorkflows
}: {
  performanceRecords: SalaryPerformanceSourceRecord[];
  salaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[];
}) {
  return [...new Set(
    buildSalaryPerformanceSettlementLines({ performanceRecords, salaryMonthlyWorkflows })
      .map((line) => line.salaryMonth)
  )].sort((left, right) => right.localeCompare(left));
}

export function validateSalaryPerformanceSettlementClaim({
  memberId,
  month,
  salaryMonthlyWorkflows,
  salarySettlementReferences
}: {
  memberId: string;
  month: string;
  salaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[];
  salarySettlementReferences: string[];
}): SalaryPerformanceSettlementValidationResult {
  for (const salarySettlementReference of new Set(salarySettlementReferences)) {
    const conflictingWorkflow = salaryMonthlyWorkflows.find(
      (workflow) =>
        (workflow.memberId !== memberId || workflow.month !== month) &&
        workflow.salarySettlementReferences?.includes(salarySettlementReference)
    );

    if (conflictingWorkflow) {
      const conflictingPayrollNo = conflictingWorkflow.payrollNo ?? conflictingWorkflow.id;

      return {
        allowed: false,
        conflictingPayrollNo,
        conflictingReference: salarySettlementReference,
        reason: `绩效结果 ${salarySettlementReference} 已由薪酬批次 ${conflictingPayrollNo} 承接`
      };
    }
  }

  return { allowed: true };
}

export function parseSalaryAmount(salaryText: string | undefined) {
  if (!salaryText) {
    return 0;
  }

  const normalizedText = salaryText.replace(/,/g, '');
  const matched = normalizedText.match(/\d+(?:\.\d+)?/);

  return matched ? Number(matched[0]) : 0;
}

export function formatSalaryMoney(amount: number) {
  if (!Number.isFinite(amount)) {
    return '-';
  }

  return `${moneyFormatter.format(Math.round(amount * 100) / 100)} 元`;
}

export function roundSalaryMoney(amount: number) {
  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.round(amount * 100) / 100;
}

export function getSalaryAdjustmentDirection(type: SalaryAdjustmentType): SalaryAdjustmentDirection {
  return salaryAdjustmentTypeDirectionMap[type];
}

export function getSalaryAdjustmentSignedAmount(record: Pick<SalaryAdjustmentRecord, 'amount' | 'status' | 'type'>) {
  if (record.status === '已作废') {
    return 0;
  }

  return getSalaryAdjustmentDirection(record.type) === '增加' ? record.amount : -record.amount;
}

export function isSalaryMonthlyPaid(
  workflows: SalaryMonthlyWorkflowRecord[],
  memberId: string,
  month: string
) {
  return workflows.some((workflow) => workflow.memberId === memberId && workflow.month === month && workflow.status === '已发放');
}

export type InvalidateSalaryMonthlySourcesResult = {
  blockedMonths: string[];
  invalidatedMonths: string[];
  success: boolean;
  workflows: SalaryMonthlyWorkflowRecord[];
};

export function invalidateSalaryMonthlySources(
  workflows: SalaryMonthlyWorkflowRecord[],
  payments: SalaryPaymentRecord[],
  memberId: string,
  months: string[],
  reason: string,
  updatedAt: string
): InvalidateSalaryMonthlySourcesResult {
  const targetMonths = [...new Set(months)].sort();
  const blockedMonths = targetMonths.filter((month) =>
    isSalaryMonthlyPaid(workflows, memberId, month)
    || payments.some((payment) => payment.employeeNo === memberId && payment.payrollMonth === month)
  );

  if (blockedMonths.length > 0) {
    return { blockedMonths, invalidatedMonths: [], success: false, workflows };
  }

  const invalidatedMonths = targetMonths.filter((month) =>
    workflows.some((workflow) =>
      workflow.memberId === memberId && workflow.month === month && workflow.status === '已确认'
    )
  );

  return {
    blockedMonths: [],
    invalidatedMonths,
    success: true,
    workflows: workflows.map((workflow) =>
      workflow.memberId === memberId
      && invalidatedMonths.includes(workflow.month)
      && workflow.status === '已确认'
        ? {
            ...workflow,
            confirmedAt: undefined,
            confirmedBy: undefined,
            note: reason,
            personalIncomeTaxPeriod: undefined,
            settlementSnapshot: undefined,
            status: '待确认',
            updatedAt
          }
        : workflow
    )
  };
}

export function getSalaryAdjustmentDisplayStatus(
  record: SalaryAdjustmentRecord,
  workflows: SalaryMonthlyWorkflowRecord[]
): SalaryAdjustmentDisplayStatus {
  return isSalaryMonthlyPaid(workflows, record.memberId, record.month) ? '已锁定' : record.status;
}

export function toAttendanceMonthlySalarySettlementRecords(
  workflows: SalaryMonthlyWorkflowRecord[]
): AttendanceMonthlySalarySettlementRecord[] {
  return workflows
    .filter((workflow) => workflow.status === '已发放')
    .map((workflow) => ({
      actor: workflow.paidBy ?? workflow.confirmedBy ?? '薪酬管理',
      memberId: workflow.memberId,
      month: workflow.month,
      note: workflow.note || '工资已发放，考勤月报锁定',
      settledAt: workflow.paidAt ?? workflow.updatedAt,
      settlementNo: workflow.payrollNo ?? buildSalaryMonthlyWorkflowId(workflow.month, workflow.memberId),
      status: '已结算'
    }));
}

function getWorkflow(workflows: SalaryMonthlyWorkflowRecord[], month: string, memberId: string) {
  return workflows.find((workflow) => workflow.month === month && workflow.memberId === memberId);
}

function getPayrollActiveEnd(member: PeopleMember) {
  return member.status === '离职' ? member.contractEndAt ?? member.archiveUpdatedAt : undefined;
}

function isFullMonthPayrollScope(member: PeopleMember, month: string) {
  const { endDateText, startDateText } = getAttendanceMonthRange(month);
  const activeEnd = getPayrollActiveEnd(member);

  return member.joinedAt <= startDateText && (!activeEnd || activeEnd >= endDateText);
}

function getBaseSalaryPayableHours(member: PeopleMember, attendanceContract: PayrollAttendanceMonthlyContract) {
  const { month } = attendanceContract;

  if (isFullMonthPayrollScope(member, month)) {
    return salaryStandardPayrollHours;
  }

  return Math.min(attendanceContract.expectedWorkHours, salaryStandardPayrollHours);
}

function formatSalaryDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + days);

  return formatSalaryDate(date);
}

function getRegularSalaryStartDate(member: PeopleMember) {
  if (!member.probationEndAt || !member.salaryProfile.probationSalary || !member.salaryProfile.regularSalary) {
    return undefined;
  }

  return member.status === '试用期' ? addDays(member.probationEndAt, 1) : member.probationEndAt;
}

function getBaseSalaryTextForDate(member: PeopleMember, dateText: string) {
  const probationSalaryText = member.salaryProfile.probationSalary;
  const regularSalaryText = member.salaryProfile.regularSalary;
  const regularSalaryStartDate = getRegularSalaryStartDate(member);

  if (member.personnelType === '兼职') {
    return member.salaryProfile.taskRateRule ? '按任务规则' : '-';
  }

  if (regularSalaryStartDate) {
    return dateText >= regularSalaryStartDate
      ? regularSalaryText ?? probationSalaryText ?? '-'
      : probationSalaryText ?? regularSalaryText ?? '-';
  }

  if (member.status === '试用期') {
    return probationSalaryText ?? regularSalaryText ?? '-';
  }

  return regularSalaryText ?? probationSalaryText ?? '-';
}

function getBaseSalaryLabelForDate(member: PeopleMember, dateText: string) {
  const regularSalaryStartDate = getRegularSalaryStartDate(member);

  if (!regularSalaryStartDate) {
    return '基础薪资';
  }

  return dateText >= regularSalaryStartDate ? '正式' : '试用';
}

function getBaseSalaryCalculation(member: PeopleMember, attendanceContract: PayrollAttendanceMonthlyContract) {
  const { month } = attendanceContract;
  const { startDateText } = getAttendanceMonthRange(month);
  const baseSalaryPayableHours = getBaseSalaryPayableHours(member, attendanceContract);
  const expectedWorkdayDates = attendanceContract.expectedWorkdayDates.length > 0
    ? attendanceContract.expectedWorkdayDates
    : [startDateText];
  const expectedHoursTotal = expectedWorkdayDates.length * salaryStandardPayrollDayHours;
  const segmentMap = new Map<string, { expectedHours: number; label: string; monthlyAmount: number; salaryText: string }>();

  expectedWorkdayDates.forEach((dateText) => {
    const salaryText = getBaseSalaryTextForDate(member, dateText);
    const monthlyAmount = parseSalaryAmount(salaryText);
    const label = getBaseSalaryLabelForDate(member, dateText);
    const key = `${label}-${monthlyAmount}-${salaryText}`;
    const existing = segmentMap.get(key);

    if (existing) {
      existing.expectedHours += salaryStandardPayrollDayHours;
      return;
    }

    segmentMap.set(key, {
      expectedHours: salaryStandardPayrollDayHours,
      label,
      monthlyAmount,
      salaryText
    });
  });

  const segments = Array.from(segmentMap.values());
  const baseSalaryAmount = roundSalaryMoney(
    segments.reduce((total, segment) => {
      const segmentPayableHours = expectedHoursTotal > 0
        ? baseSalaryPayableHours * (segment.expectedHours / expectedHoursTotal)
        : baseSalaryPayableHours;

      if (segments.length === 1 && baseSalaryPayableHours >= salaryStandardPayrollHours) {
        return total + segment.monthlyAmount;
      }

      return total + segmentPayableHours * (segment.monthlyAmount / salaryStandardPayrollHours);
    }, 0)
  );
  const monthlyBaseSalaryAmount = baseSalaryPayableHours > 0
    ? roundSalaryMoney((baseSalaryAmount / baseSalaryPayableHours) * salaryStandardPayrollHours)
    : parseSalaryAmount(getBaseSalaryTextForDate(member, startDateText));
  const payrollHourlyRate = baseSalaryPayableHours > 0
    ? baseSalaryAmount / baseSalaryPayableHours
    : monthlyBaseSalaryAmount / salaryStandardPayrollHours;
  const baseSalaryText = segments.length > 1
    ? segments.map((segment) => `${segment.label} ${segment.salaryText}`).join(' / ')
    : segments[0]?.salaryText ?? '-';

  return {
    baseSalaryAmount,
    baseSalaryPayableHours,
    baseSalaryText,
    monthlyBaseSalaryAmount,
    payrollHourlyRate
  };
}

function getSalaryHourlyRateForDate(member: PeopleMember, dateText: string) {
  return parseSalaryAmount(getBaseSalaryTextForDate(member, dateText)) / salaryStandardPayrollHours;
}

function getAttendanceDeductionAmount(
  member: PeopleMember,
  attendanceContract: PayrollAttendanceMonthlyContract,
  fallbackHourlyRate: number
) {
  const dateScopedHours = attendanceContract.payrollDeductionEntries.reduce((total, record) => total + record.hours, 0);
  const dateScopedAmount = attendanceContract.payrollDeductionEntries.reduce(
    (total, record) => total + record.hours * getSalaryHourlyRateForDate(member, record.dateText),
    0
  );
  const fallbackHours = Math.max(0, attendanceContract.payrollDeductionHours - dateScopedHours);

  return roundSalaryMoney(dateScopedAmount + fallbackHours * fallbackHourlyRate);
}

function formatSalaryHoursForNote(hours: number) {
  if (!Number.isFinite(hours)) {
    return '-';
  }

  return `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/0$/, '')} 小时`;
}

function getSettlementStatusFromWorkflow(
  workflow: SalaryMonthlyWorkflowRecord | undefined,
  sourceReady: boolean
): SalaryMonthlyStatus {
  if (workflow?.status === '已发放') {
    return workflow.status;
  }

  if (workflow?.status === '已确认' && (workflow.settlementSnapshot || sourceReady)) {
    return workflow.status;
  }

  return sourceReady ? '待确认' : '结算中';
}

function getSocialInsuranceSourceStatus(
  record: SocialInsuranceEmployeeRecord | undefined
): SalarySettlementSourceStatus {
  const payrollState = getSocialInsurancePayrollSourceState(record);

  if (payrollState === '计入扣款') {
    return '已确认';
  }

  if (payrollState === '本月不扣') {
    return '本月不扣';
  }

  return '待确认';
}

function getSocialInsuranceSourceNote(category: string, record: SocialInsuranceEmployeeRecord | undefined) {
  if (!record) {
    return `${category}扣减来源未生成`;
  }

  if (record.handlingStatus === '待缴费' || record.handlingStatus === '已缴费') {
    return record.makeupPeriod ? `补缴 ${record.makeupPeriod}` : '本月来源已确认';
  }

  return record.reason ? `${record.handlingStatus}：${record.reason}` : record.handlingStatus;
}

function getHousingFundNotApplicableNote(member: PeopleMember, month: string) {
  const housingFundStatus = getPeopleHousingFundStatus(member);

  if (housingFundStatus === '不适用') {
    return '人员类型不适用';
  }

  if (member.housingFundEffectiveMonth && member.housingFundEffectiveMonth > month) {
    return `公积金 ${member.housingFundEffectiveMonth} 起生效`;
  }

  return '人员档案暂不缴存';
}

function buildSettlementSourceRecords({
  attendanceContract,
  member,
  personalIncomeTaxPeriod,
  personalIncomeTaxProfile,
  requirePersonalIncomeTaxProfile,
  socialInsuranceSourceRecords
}: {
  attendanceContract: PayrollAttendanceMonthlyContract;
  member: PeopleMember;
  personalIncomeTaxPeriod: string;
  personalIncomeTaxProfile?: SalaryIitProfile;
  requirePersonalIncomeTaxProfile: boolean;
  socialInsuranceSourceRecords: SocialInsuranceEmployeeRecord[];
}): SalarySettlementSourceRecord[] {
  const { month } = attendanceContract;
  const socialInsuranceRecord = socialInsuranceSourceRecords.find(
    (record) => record.employeeNo === member.id && record.period === month && record.category === '社保'
  );
  const housingFundRecord = socialInsuranceSourceRecords.find(
    (record) => record.employeeNo === member.id && record.period === month && record.category === '公积金'
  );
  const isHousingFundApplicable = Boolean(housingFundRecord)
    || isPeopleHousingFundContributionApplicable(member, month);

  return [
    {
      amount: 0,
      id: `source-attendance-${month}-${member.id}`,
      key: 'attendance-monthly',
      label: '考勤月报',
      note: attendanceContract.reportStatus === '已确认' ? '考勤月报已确认' : '考勤月报待确认',
      payrollMonth: month,
      sourceMonth: month,
      status: attendanceContract.reportStatus === '已确认' ? '已确认' : '待确认'
    },
    {
      amount: isSocialInsurancePayrollDeductible(socialInsuranceRecord) ? socialInsuranceRecord.personalAmount : 0,
      id: `source-social-${month}-${member.id}`,
      key: 'social-insurance',
      label: '社保',
      note: getSocialInsuranceSourceNote('社保', socialInsuranceRecord),
      payrollMonth: month,
      sourceMonth: socialInsuranceRecord?.makeupPeriod ?? socialInsuranceRecord?.period ?? month,
      status: getSocialInsuranceSourceStatus(socialInsuranceRecord)
    },
    {
      amount: isHousingFundApplicable && isSocialInsurancePayrollDeductible(housingFundRecord) ? housingFundRecord.personalAmount : 0,
      id: `source-housing-${month}-${member.id}`,
      key: 'housing-fund',
      label: '公积金',
      note: isHousingFundApplicable ? getSocialInsuranceSourceNote('公积金', housingFundRecord) : getHousingFundNotApplicableNote(member, month),
      payrollMonth: month,
      sourceMonth: isHousingFundApplicable ? housingFundRecord?.makeupPeriod ?? housingFundRecord?.period ?? month : month,
      status: isHousingFundApplicable ? getSocialInsuranceSourceStatus(housingFundRecord) : '不适用'
    },
    {
      amount: getSalaryIitDeductionSummary(personalIncomeTaxProfile, personalIncomeTaxPeriod).totalDeductionAmount,
      id: `source-personal-income-tax-${month}-${member.id}`,
      key: 'personal-income-tax',
      label: '个税信息',
      note: !requirePersonalIncomeTaxProfile
        ? '测试口径'
        : personalIncomeTaxProfile
          ? personalIncomeTaxProfile.source
            ? `${personalIncomeTaxProfile.source} / ${personalIncomeTaxProfile.taxYear}`
            : `${personalIncomeTaxProfile.personnelReportingStatus} / ${personalIncomeTaxProfile.acquisitionStatus}`
          : '个税信息未完成',
      payrollMonth: month,
      sourceMonth: personalIncomeTaxProfile?.updatedAt.slice(0, 7) ?? personalIncomeTaxPeriod,
      status:
        !requirePersonalIncomeTaxProfile || isSalaryIitProfileReady(personalIncomeTaxProfile, personalIncomeTaxPeriod)
          ? '已确认'
          : '待确认'
    }
  ];
}

const annualPersonalIncomeTaxBrackets = [
  { maxTaxableIncome: 36000, quickDeductionAmount: 0, taxRate: 0.03 },
  { maxTaxableIncome: 144000, quickDeductionAmount: 2520, taxRate: 0.1 },
  { maxTaxableIncome: 300000, quickDeductionAmount: 16920, taxRate: 0.2 },
  { maxTaxableIncome: 420000, quickDeductionAmount: 31920, taxRate: 0.25 },
  { maxTaxableIncome: 660000, quickDeductionAmount: 52920, taxRate: 0.3 },
  { maxTaxableIncome: 960000, quickDeductionAmount: 85920, taxRate: 0.35 },
  { maxTaxableIncome: Number.POSITIVE_INFINITY, quickDeductionAmount: 181920, taxRate: 0.45 }
] as const;

function getPersonalIncomeTaxYear(month: string) {
  return month.slice(0, 4);
}

function getLatestPersonalIncomeTaxSnapshot(
  snapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[],
  employeeNo: string,
  month: string
) {
  const taxYear = getPersonalIncomeTaxYear(month);

  return snapshots
    .filter((snapshot) => snapshot.employeeNo === employeeNo && snapshot.taxYear === taxYear && snapshot.period <= month)
    .sort(
      (left, right) =>
        right.period.localeCompare(left.period) || right.updatedAt.localeCompare(left.updatedAt)
    )[0];
}

function upsertPersonalIncomeTaxCumulativeSnapshots(
  snapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[],
  nextSnapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[]
) {
  const snapshotMap = new Map<string, SalaryPersonalIncomeTaxCumulativeSnapshot>();

  snapshots.forEach((snapshot) => {
    snapshotMap.set(`${snapshot.employeeNo}-${snapshot.taxYear}-${snapshot.period}`, snapshot);
  });
  nextSnapshots.forEach((snapshot) => {
    snapshotMap.set(`${snapshot.employeeNo}-${snapshot.taxYear}-${snapshot.period}`, snapshot);
  });

  return Array.from(snapshotMap.values()).sort(
    (left, right) =>
      left.employeeNo.localeCompare(right.employeeNo) ||
      left.taxYear.localeCompare(right.taxYear) ||
      left.period.localeCompare(right.period)
  );
}

function createEmptyPersonalIncomeTaxSnapshot(
  employeeNo: string,
  month: string
): SalaryPersonalIncomeTaxCumulativeSnapshot {
  return {
    cumulativeAdditionalDeductionAmount: 0,
    cumulativeBasicDeductionAmount: 0,
    cumulativeIncomeAmount: 0,
    cumulativeOtherDeductionAmount: 0,
    cumulativeSpecialDeductionAmount: 0,
    cumulativeTaxAmount: 0,
    cumulativeTaxableIncomeAmount: 0,
    cumulativeWithheldTaxAmount: 0,
    employeeNo,
    period: `${getPersonalIncomeTaxYear(month)}-00`,
    taxYear: getPersonalIncomeTaxYear(month),
    updatedAt: ''
  };
}

export function calculateCumulativePersonalIncomeTax({
  basicDeductionAmount = 5000,
  currentAdditionalDeductionAmount = 0,
  currentIncomeAmount,
  currentOtherDeductionAmount = 0,
  currentSpecialDeductionAmount,
  priorSnapshot
}: {
  basicDeductionAmount?: number;
  currentAdditionalDeductionAmount?: number;
  currentIncomeAmount: number;
  currentOtherDeductionAmount?: number;
  currentSpecialDeductionAmount: number;
  priorSnapshot: SalaryPersonalIncomeTaxCumulativeSnapshot;
}) {
  const currentTaxableIncomeAmount = roundSalaryMoney(
    Math.max(
      0,
      currentIncomeAmount -
        currentSpecialDeductionAmount -
        basicDeductionAmount -
        currentAdditionalDeductionAmount -
        currentOtherDeductionAmount
    )
  );
  const cumulativeIncomeAmount = roundSalaryMoney(priorSnapshot.cumulativeIncomeAmount + currentIncomeAmount);
  const cumulativeBasicDeductionAmount = roundSalaryMoney(
    priorSnapshot.cumulativeBasicDeductionAmount + basicDeductionAmount
  );
  const cumulativeSpecialDeductionAmount = roundSalaryMoney(
    priorSnapshot.cumulativeSpecialDeductionAmount + currentSpecialDeductionAmount
  );
  const cumulativeAdditionalDeductionAmount = roundSalaryMoney(
    priorSnapshot.cumulativeAdditionalDeductionAmount + currentAdditionalDeductionAmount
  );
  const cumulativeOtherDeductionAmount = roundSalaryMoney(
    priorSnapshot.cumulativeOtherDeductionAmount + currentOtherDeductionAmount
  );
  const cumulativeTaxableIncomeAmount = roundSalaryMoney(
    Math.max(
      0,
      cumulativeIncomeAmount -
        cumulativeBasicDeductionAmount -
        cumulativeSpecialDeductionAmount -
        cumulativeAdditionalDeductionAmount -
        cumulativeOtherDeductionAmount
    )
  );
  const bracket = annualPersonalIncomeTaxBrackets.find(
    (item) => cumulativeTaxableIncomeAmount <= item.maxTaxableIncome
  ) ?? annualPersonalIncomeTaxBrackets[annualPersonalIncomeTaxBrackets.length - 1];
  const cumulativeTaxAmount = roundSalaryMoney(
    Math.max(0, cumulativeTaxableIncomeAmount * bracket.taxRate - bracket.quickDeductionAmount)
  );
  const amount = roundSalaryMoney(Math.max(0, cumulativeTaxAmount - priorSnapshot.cumulativeWithheldTaxAmount));

  return {
    amount,
    basicDeductionAmount,
    cumulativeAdditionalDeductionAmount,
    cumulativeBasicDeductionAmount,
    cumulativeIncomeAmount,
    cumulativeOtherDeductionAmount,
    cumulativeSpecialDeductionAmount,
    cumulativeTaxAmount,
    cumulativeTaxableIncomeAmount,
    currentAdditionalDeductionAmount,
    currentIncomeAmount,
    currentOtherDeductionAmount,
    currentSpecialDeductionAmount,
    currentTaxableIncomeAmount,
    priorCumulativePeriod: priorSnapshot.period === `${priorSnapshot.taxYear}-00` ? undefined : priorSnapshot.period,
    priorWithheldTaxAmount: priorSnapshot.cumulativeWithheldTaxAmount,
    quickDeductionAmount: bracket.quickDeductionAmount,
    taxRate: bracket.taxRate
  };
}

export function buildPersonalIncomeTaxRecord({
  currentIncomeAmount,
  member,
  month,
  personalIncomeTaxCumulativeSnapshots,
  personalIncomeTaxProfile,
  socialInsuranceDeductionAmount
}: {
  currentIncomeAmount: number;
  member: PeopleMember;
  month: string;
  personalIncomeTaxCumulativeSnapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[];
  personalIncomeTaxProfile?: SalaryIitProfile;
  socialInsuranceDeductionAmount: number;
}): SalaryPersonalIncomeTaxRecord | undefined {
  if (currentIncomeAmount <= 0) {
    return undefined;
  }

  const priorSnapshot =
    getLatestPersonalIncomeTaxSnapshot(personalIncomeTaxCumulativeSnapshots, member.id, month) ??
    createEmptyPersonalIncomeTaxSnapshot(member.id, month);
  const deductionSummary = getSalaryIitCurrentDeductionSummary({
    month,
    priorSnapshot,
    profile: personalIncomeTaxProfile
  });
  const basicDeductionAmount = personalIncomeTaxProfile
    ? getSalaryIitCurrentBasicDeductionAmount({
        month,
        priorCumulativeBasicDeductionAmount: priorSnapshot.cumulativeBasicDeductionAmount,
        priorCumulativePeriod: priorSnapshot.period,
        profile: personalIncomeTaxProfile
      })
    : 5000;
  const taxResult = calculateCumulativePersonalIncomeTax({
    basicDeductionAmount,
    currentAdditionalDeductionAmount: deductionSummary.additionalDeductionAmount,
    currentIncomeAmount,
    currentOtherDeductionAmount: deductionSummary.otherDeductionAmount,
    currentSpecialDeductionAmount: socialInsuranceDeductionAmount,
    priorSnapshot
  });

  return {
    ...taxResult,
    employeeName: member.name,
    employeeNo: member.id,
    id: `personal-tax-${month}-${member.id}`,
    payrollMonth: month,
    reason: '薪酬明细累计预扣',
    sourceMonth: month,
    sourceModule: '薪酬明细'
  };
}

export function buildSalarySettlementSnapshot({
  businessDeductionAmount,
  employeeAdvanceRecoveryAmount,
  grossEarningsAmount,
  payrollMonth,
  payrollNo,
  personalIncomeTaxAmount,
  socialInsuranceDeductionRecords,
  taxableIncomeAmount
}: {
  businessDeductionAmount: number;
  employeeAdvanceRecoveryAmount: number;
  grossEarningsAmount: number;
  payrollMonth: string;
  payrollNo: string;
  personalIncomeTaxAmount: number;
  socialInsuranceDeductionRecords: SocialInsurancePayrollDeductionRecord[];
  taxableIncomeAmount: number;
}): SalarySettlementSnapshot {
  const employeeSocialInsuranceAmount = roundSalaryMoney(
    socialInsuranceDeductionRecords
      .filter((record) => record.category === '社保')
      .reduce((total, record) => total + record.personalAmount, 0)
  );
  const employeeHousingFundAmount = roundSalaryMoney(
    socialInsuranceDeductionRecords
      .filter((record) => record.category === '公积金')
      .reduce((total, record) => total + record.personalAmount, 0)
  );
  const employerSocialInsuranceAmount = roundSalaryMoney(
    socialInsuranceDeductionRecords
      .filter((record) => record.category === '社保')
      .reduce((total, record) => total + record.companyAmount, 0)
  );
  const employerHousingFundAmount = roundSalaryMoney(
    socialInsuranceDeductionRecords
      .filter((record) => record.category === '公积金')
      .reduce((total, record) => total + record.companyAmount, 0)
  );
  const employeeGrossPayableAmount = roundSalaryMoney(
    Math.max(0, grossEarningsAmount - businessDeductionAmount)
  );
  const employerContributionAmount = roundSalaryMoney(
    employerSocialInsuranceAmount + employerHousingFundAmount
  );
  const employeeNetPayableAmount = roundSalaryMoney(
    Math.max(
      0,
      employeeGrossPayableAmount
        - employeeSocialInsuranceAmount
        - employeeHousingFundAmount
        - personalIncomeTaxAmount
        - employeeAdvanceRecoveryAmount
    )
  );

  return {
    businessDeductionAmount: roundSalaryMoney(businessDeductionAmount),
    employeeAdvanceRecoveryAmount: roundSalaryMoney(employeeAdvanceRecoveryAmount),
    employeeGrossPayableAmount,
    employeeHousingFundAmount,
    employeeNetPayableAmount,
    employeeSocialInsuranceAmount,
    employerContributionAmount,
    employerHousingFundAmount,
    employerSocialInsuranceAmount,
    grossEarningsAmount: roundSalaryMoney(grossEarningsAmount),
    payrollMonth,
    payrollNo,
    taxableIncomeAmount: roundSalaryMoney(taxableIncomeAmount),
    totalEmploymentCostAmount: roundSalaryMoney(employeeGrossPayableAmount + employerContributionAmount),
    withheldPersonalIncomeTaxAmount: roundSalaryMoney(personalIncomeTaxAmount)
  };
}

export function createSalaryPaymentRecord({
  paymentEvidence,
  paidAt,
  paidBy,
  personalIncomeTaxCumulativeSnapshots,
  personalIncomeTaxProfile,
  report
}: {
  paymentEvidence?: {
    accountName: string;
    financeTransactionNo: string;
    status: '已核验';
  };
  paidAt: string;
  paidBy: string;
  personalIncomeTaxCumulativeSnapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[];
  personalIncomeTaxProfile?: SalaryIitProfile;
  report: SalaryMonthlyReport;
}): SalaryPaymentRecord {
  const taxPeriod = paidAt.slice(0, 7);
  const personalIncomeTaxRecord = buildPersonalIncomeTaxRecord({
    currentIncomeAmount: report.taxableSalaryIncomeAmount,
    member: report.member,
    month: taxPeriod,
    personalIncomeTaxCumulativeSnapshots,
    personalIncomeTaxProfile,
    socialInsuranceDeductionAmount: report.socialInsuranceDeductionAmount
  });
  const personalIncomeTaxAmount = personalIncomeTaxRecord?.amount ?? 0;
  const payrollNo = report.workflow?.payrollNo || buildSalaryPayrollNo(report.month, report.member.id);
  const settlementSnapshot = buildSalarySettlementSnapshot({
    businessDeductionAmount: report.settlementSnapshot.businessDeductionAmount,
    employeeAdvanceRecoveryAmount: report.settlementSnapshot.employeeAdvanceRecoveryAmount,
    grossEarningsAmount: report.settlementSnapshot.grossEarningsAmount,
    payrollMonth: report.month,
    payrollNo,
    personalIncomeTaxAmount,
    socialInsuranceDeductionRecords: report.socialInsuranceDeductionRecords,
    taxableIncomeAmount: report.taxableSalaryIncomeAmount
  });

  return {
    employeeName: report.member.name,
    employeeNo: report.member.id,
    id: `salary-payment-${report.month}-${report.member.id}`,
    identityNo: report.member.identityNo,
    paymentAccountName: paymentEvidence?.accountName,
    paymentEvidenceStatus: paymentEvidence?.status ?? '待核验',
    financeTransactionNo: paymentEvidence?.financeTransactionNo,
    paidAt,
    paidBy,
    payrollMonth: report.month,
    payrollNo,
    personalIncomeTaxRecord: personalIncomeTaxRecord
      ? {
          ...personalIncomeTaxRecord,
          id: `personal-tax-${taxPeriod}-${report.month}-${report.member.id}`,
          payrollMonth: report.month,
          reason: '按实际发放月份累计预扣',
          sourceMonth: report.month
        }
      : undefined,
    position: report.member.position,
    settlementSnapshot,
    taxPeriod
  };
}

export function recalculateSalaryMonthlyPayment({
  paymentDate,
  personalIncomeTaxCumulativeSnapshots,
  personalIncomeTaxProfile,
  report
}: {
  paymentDate: string;
  personalIncomeTaxCumulativeSnapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[];
  personalIncomeTaxProfile: SalaryIitProfile | undefined;
  report: SalaryMonthlyReport;
}): SalaryPaymentRecalculationResult {
  if (report.status !== '已确认' || !report.workflow) {
    return { reason: '薪酬明细尚未确认或已经发放，不能重新核定', success: false };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    return { reason: '请选择有效的实际发放日期', success: false };
  }

  if (!report.member.identityNo) {
    return { reason: '人员证件号码缺失，不能重新核定', success: false };
  }

  const personalIncomeTaxPeriod = paymentDate.slice(0, 7);

  if (!isSalaryIitProfileReady(personalIncomeTaxProfile, personalIncomeTaxPeriod)) {
    return {
      reason: `${personalIncomeTaxPeriod.slice(0, 4)} 年个税报送及扣除信息尚未完成`,
      success: false
    };
  }

  const recalculatedPayment = createSalaryPaymentRecord({
    paidAt: `${paymentDate} 09:00`,
    paidBy: '薪酬核定',
    personalIncomeTaxCumulativeSnapshots,
    personalIncomeTaxProfile,
    report
  });
  const workflow: SalaryMonthlyWorkflowRecord = {
    ...report.workflow,
    note: `按 ${personalIncomeTaxPeriod} 实际发放月份重新核定`,
    personalIncomeTaxPeriod,
    settlementSnapshot: recalculatedPayment.settlementSnapshot,
    updatedAt: `${paymentDate} 09:00`
  };

  return {
    personalIncomeTaxPeriod,
    settlementSnapshot: recalculatedPayment.settlementSnapshot,
    success: true,
    workflow
  };
}

export function validateSalaryPaymentConfirmation({
  evidence,
  personalIncomeTaxCumulativeSnapshots,
  personalIncomeTaxProfile,
  report
}: {
  evidence: SalaryPaymentEvidenceInput | undefined;
  personalIncomeTaxCumulativeSnapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[];
  personalIncomeTaxProfile: SalaryIitProfile | undefined;
  report: SalaryMonthlyReport;
}): SalaryPaymentValidationResult {
  if (!evidence) {
    return { allowed: false, reason: '请选择已复核入账的工资付款流水' };
  }

  if (!report.workflow?.payrollNo || evidence.payrollNo !== report.workflow.payrollNo) {
    return { allowed: false, reason: '付款流水与当前工资单不匹配' };
  }

  const taxPeriod = evidence.occurredAt.slice(0, 7);
  const calculatedTaxPeriod = report.workflow?.personalIncomeTaxPeriod
    ?? (getSalaryScheduledPaymentDate(report.month).slice(0, 7) || report.month);

  if (calculatedTaxPeriod && calculatedTaxPeriod !== taxPeriod) {
    return { allowed: false, reason: '实际付款月份与当前核定月份不一致，请先重新核定' };
  }

  if (!isSalaryIitProfileReady(personalIncomeTaxProfile, taxPeriod)) {
    return { allowed: false, reason: `${taxPeriod.slice(0, 4)} 年个税报送及扣除信息尚未完成` };
  }

  if (!report.member.identityNo) {
    return { allowed: false, reason: '人员证件号码缺失，不能确认工资发放' };
  }

  const payment = createSalaryPaymentRecord({
    paymentEvidence: {
      accountName: evidence.accountName,
      financeTransactionNo: evidence.financeTransactionNo,
      status: '已核验'
    },
    paidAt: `${evidence.occurredAt} 11:00`,
    paidBy: '周倩',
    personalIncomeTaxCumulativeSnapshots,
    personalIncomeTaxProfile,
    report
  });

  if (
    Math.abs(
      payment.settlementSnapshot.employeeNetPayableAmount -
        report.settlementSnapshot.employeeNetPayableAmount
    ) > 0.01 ||
    Math.abs(
      payment.settlementSnapshot.withheldPersonalIncomeTaxAmount -
        report.settlementSnapshot.withheldPersonalIncomeTaxAmount
    ) > 0.01
  ) {
    return { allowed: false, reason: '当前薪酬核定金额与实际付款月份不一致，请先重新核定' };
  }

  if (Math.abs(evidence.amount - payment.settlementSnapshot.employeeNetPayableAmount) > 0.01) {
    return { allowed: false, reason: '付款流水金额与重新核定后的实发工资不一致' };
  }

  return { allowed: true, payment };
}

export function buildPersonalIncomeTaxCumulativeSnapshotsFromPayments(
  existingSnapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[],
  payments: SalaryPaymentRecord[]
) {
  const nextSnapshots = [...payments]
    .sort((left, right) => left.paidAt.localeCompare(right.paidAt) || left.id.localeCompare(right.id))
    .flatMap((payment) => {
    const record = payment.personalIncomeTaxRecord;

    if (!record) {
      return [];
    }

    return [{
      cumulativeAdditionalDeductionAmount: record.cumulativeAdditionalDeductionAmount,
      cumulativeBasicDeductionAmount: record.cumulativeBasicDeductionAmount,
      cumulativeIncomeAmount: record.cumulativeIncomeAmount,
      cumulativeOtherDeductionAmount: record.cumulativeOtherDeductionAmount,
      cumulativeSpecialDeductionAmount: record.cumulativeSpecialDeductionAmount,
      cumulativeTaxAmount: record.cumulativeTaxAmount,
      cumulativeTaxableIncomeAmount: record.cumulativeTaxableIncomeAmount,
      cumulativeWithheldTaxAmount: roundSalaryMoney(record.priorWithheldTaxAmount + record.amount),
      employeeNo: record.employeeNo,
      period: payment.taxPeriod,
      taxYear: payment.taxPeriod.slice(0, 4),
      updatedAt: payment.paidAt
    }];
    });

  return upsertPersonalIncomeTaxCumulativeSnapshots(existingSnapshots, nextSnapshots);
}

function getMonthlySalaryOperationRecords({
  adjustments,
  memberName,
  month,
  payrollNo,
  performanceSettlementLines,
  personalIncomeTaxAmount,
  settlementPendingSourceLabels,
  socialInsuranceDeductions,
  workflow
}: {
  adjustments: SalaryAdjustmentRecord[];
  memberName: string;
  month: string;
  payrollNo?: string;
  performanceSettlementLines: SalaryPerformanceSettlementLine[];
  personalIncomeTaxAmount: number;
  settlementPendingSourceLabels: string[];
  socialInsuranceDeductions: SocialInsurancePayrollDeductionRecord[];
  workflow?: SalaryMonthlyWorkflowRecord;
}): SalaryOperationRecord[] {
  const object = `${memberName} / ${month}`;
  const rows: SalaryOperationRecord[] = [
    {
      action: '归集薪酬明细',
      actor: '系统',
      id: `salary-op-collected-${month}-${memberName}`,
      object,
      summary: '根据人员档案、绩效明细、考勤月报、薪酬调整、法定扣减来源归集薪酬明细',
      time: `${month}-17 09:00`
    }
  ];

  if (settlementPendingSourceLabels.length > 0) {
    rows.push({
      action: '等待源项确认',
      actor: '系统',
      id: `salary-op-waiting-source-${month}-${memberName}`,
      object,
      summary: `${settlementPendingSourceLabels.join('、')}源项待确认，薪酬明细处于结算中`,
      time: `${month}-17 09:01`
    });
  }

  if (performanceSettlementLines.length > 0) {
    const referenceSummary = performanceSettlementLines
      .map((line) => `${line.kind} ${formatSalaryMoney(line.amount)}`)
      .join('、');

    rows.push({
      action: '承接绩效结果',
      actor: '系统',
      id: `salary-op-performance-${month}-${memberName}`,
      object,
      summary: `${referenceSummary} 已通过稳定结果引用计入薪酬`,
      time: `${month}-17 09:03`
    });
  }

  rows.push(
    ...adjustments.map((adjustment) => ({
      action: '记录薪酬调整',
      actor: adjustment.createdBy,
      id: `salary-op-adjust-${adjustment.id}`,
      object,
      summary: `${getSalaryAdjustmentDirection(adjustment.type)}${formatSalaryMoney(adjustment.amount)}：${adjustment.reason}`,
      time: adjustment.updatedAt
    }))
  );

  if (socialInsuranceDeductions.length > 0) {
    const socialInsuranceDeductionAmount = socialInsuranceDeductions.reduce(
      (total, record) => total + record.personalAmount,
      0
    );

    rows.push({
      action: '读取社保公积金',
      actor: '系统',
      id: `salary-op-social-insurance-${month}-${memberName}`,
      object,
      summary: `社保公积金个人承担/补缴 ${formatSalaryMoney(socialInsuranceDeductionAmount)} 已计入扣减`,
      time: `${month}-17 09:05`
    });
  }

  if (personalIncomeTaxAmount > 0) {
    rows.push({
      action: '计算个税扣减',
      actor: '系统',
      id: `salary-op-tax-${month}-${memberName}`,
      object,
      summary: `根据薪酬明细计算个人所得税 ${formatSalaryMoney(personalIncomeTaxAmount)}`,
      time: `${month}-17 09:06`
    });
  }

  if (workflow?.confirmedAt) {
    rows.push({
      action: '确认薪酬明细',
      actor: workflow.confirmedBy ?? '李明',
      id: `salary-op-confirm-${workflow.id}`,
      object,
      summary: workflow.note || '薪酬明细已确认',
      time: workflow.confirmedAt
    });
  }

  if (workflow?.paidAt) {
    if (!workflow.paymentLifecycleRecords?.some((record) => record.action === '关联发放流水')) {
      rows.push({
        action: '关联发放流水',
        actor: workflow.paidBy ?? '周倩',
        id: `salary-op-paid-${workflow.id}`,
        object,
        summary: payrollNo ? `${payrollNo} 已关联工资发放流水` : '工资发放流水已关联',
        time: workflow.paidAt
      });
    }
  }

  rows.push(
    ...(workflow?.paymentLifecycleRecords ?? []).map((record, index) => ({
      action: record.action,
      actor: record.actor,
      id: `salary-op-payment-${workflow?.id ?? `${month}-${memberName}`}-${index}-${record.occurredAt}`,
      object,
      summary: record.action === '发放流水冲正'
        ? `${record.financeTransactionNo} 已冲正，薪酬恢复待发`
        : `${record.financeTransactionNo} 已关联工资发放流水`,
      time: record.occurredAt
    }))
  );

  return rows.sort((left, right) => right.time.localeCompare(left.time));
}

function buildSalaryCompositionLines({
  attendanceDeductionAmount,
  attendanceDeductionHours,
  attendanceIncreaseAmount,
  attendanceIncreaseHours,
  baseSalaryAmount,
  baseSalaryPayableHours,
  baseSalaryText,
  personalIncomeTaxAmount,
  performanceSettlementLines,
  salaryAdjustmentAmount,
  socialInsuranceDeductionAmount
}: {
  attendanceDeductionAmount: number;
  attendanceDeductionHours: number;
  attendanceIncreaseAmount: number;
  attendanceIncreaseHours: number;
  baseSalaryAmount: number;
  baseSalaryPayableHours: number;
  baseSalaryText: string;
  personalIncomeTaxAmount: number;
  performanceSettlementLines: SalaryPerformanceSettlementLine[];
  salaryAdjustmentAmount: number;
  socialInsuranceDeductionAmount: number;
}): SalaryCompositionLine[] {
  const lines: SalaryCompositionLine[] = [
    {
      amount: baseSalaryAmount,
      direction: '应发',
      id: 'base-salary',
      item: '基础薪资',
      note:
        baseSalaryPayableHours >= salaryStandardPayrollHours
          ? `人员档案 ${baseSalaryText}`
          : `人员档案 ${baseSalaryText}，按 ${formatSalaryHoursForNote(baseSalaryPayableHours)} 折算`,
      source: '人员档案'
    }
  ];

  const performancePrepayAmount = roundSalaryMoney(
    performanceSettlementLines
      .filter((line) => line.kind === '月度预发' && !line.deferredFromMonth)
      .reduce((total, line) => total + line.amount, 0)
  );
  const performanceQuarterlyAdjustmentAmount = roundSalaryMoney(
    performanceSettlementLines
      .filter((line) => line.kind === '季度复核差额' && !line.deferredFromMonth)
      .reduce((total, line) => total + line.amount, 0)
  );

  if (performancePrepayAmount > 0) {
    lines.push({
      amount: performancePrepayAmount,
      direction: '应发',
      id: 'performance-prepay',
      item: '绩效预发',
      note: '月度绩效预发金额',
      source: '月度绩效'
    });
  }

  if (performanceQuarterlyAdjustmentAmount !== 0) {
    lines.push({
      amount: Math.abs(performanceQuarterlyAdjustmentAmount),
      direction: performanceQuarterlyAdjustmentAmount > 0 ? '应发' : '扣减',
      id: 'performance-quarterly-adjustment',
      item: performanceQuarterlyAdjustmentAmount > 0 ? '季度绩效补发' : '季度绩效追回',
      note: '季度复核差额按季度结算日进入本月薪酬',
      source: '季度绩效复核'
    });
  }

  if (attendanceIncreaseAmount > 0) {
    lines.push({
      amount: attendanceIncreaseAmount,
      direction: '应发',
      id: 'attendance-increase',
      item: '考勤补发',
      note: `${formatSalaryHoursForNote(attendanceIncreaseHours)} 按 ${salaryStandardPayrollHours} 小时月计薪基准折算`,
      source: '考勤月报'
    });
  }

  if (attendanceDeductionAmount > 0) {
    lines.push({
      amount: attendanceDeductionAmount,
      direction: '扣减',
      id: 'attendance-deduction',
      item: '考勤扣减',
      note: `${formatSalaryHoursForNote(attendanceDeductionHours)} 按 ${salaryStandardPayrollHours} 小时月计薪基准折算`,
      source: '考勤月报'
    });
  }

  if (salaryAdjustmentAmount !== 0) {
    lines.push({
      amount: Math.abs(salaryAdjustmentAmount),
      direction: salaryAdjustmentAmount > 0 ? '应发' : '扣减',
      id: 'salary-adjustment',
      item: '薪酬调整',
      note: '本月一次性薪酬调整',
      source: '薪酬明细'
    });
  }

  if (socialInsuranceDeductionAmount > 0) {
    lines.push({
      amount: socialInsuranceDeductionAmount,
      direction: '扣减',
      id: 'social-insurance',
      item: '社保公积金',
      note: '个人承担及补缴来源扣减',
      source: '社保公积金'
    });
  }

  if (personalIncomeTaxAmount > 0) {
    lines.push({
      amount: personalIncomeTaxAmount,
      direction: '扣减',
      id: 'personal-income-tax',
      item: '个人所得税',
      note: '工资薪金累计预扣',
      source: '薪酬明细'
    });
  }

  return lines;
}

export function buildSalaryMonthlyReports({
  attendanceReports,
  performanceRecords,
  personalIncomeTaxCumulativeSnapshots,
  personalIncomeTaxProfiles,
  salaryAdjustments,
  salaryMonthlyWorkflows,
  salaryPaymentRecords = [],
  socialInsuranceDeductions,
  socialInsuranceSourceRecords
}: BuildSalaryMonthlyReportsInput): SalaryMonthlyReport[] {
  const allPerformanceSettlementLines = buildSalaryPerformanceSettlementLines({
    performanceRecords,
    salaryMonthlyWorkflows
  });

  return attendanceReports.map((attendanceReport) => {
    const attendanceContract = toPayrollAttendanceMonthlyContract(attendanceReport);
    const { member } = attendanceReport;
    const { month } = attendanceContract;
    const {
      baseSalaryAmount,
      baseSalaryPayableHours,
      baseSalaryText,
      monthlyBaseSalaryAmount,
      payrollHourlyRate
    } = getBaseSalaryCalculation(member, attendanceContract);
    const workflow = getWorkflow(salaryMonthlyWorkflows, month, member.id);
    const performanceSettlementLines = allPerformanceSettlementLines.filter(
      (line) => line.employeeNo === member.id && line.salaryMonth === month
    );
    const directPerformanceSettlementLines = performanceSettlementLines.filter((line) => !line.deferredFromMonth);
    const deferredPerformanceSettlementLines = performanceSettlementLines.filter((line) => line.deferredFromMonth);
    const generatedPerformanceAdjustments = deferredPerformanceSettlementLines.map<SalaryAdjustmentRecord>((line) => {
      const sourceRecord = performanceRecords.find((record) => record.id === line.sourceRecordId);
      const isIncrease = line.amount > 0;

      return {
        amount: Math.abs(line.amount),
        createdAt: sourceRecord?.quarterlyReviewResult?.confirmedAt ?? sourceRecord?.updatedAt ?? `${month}-01 00:00`,
        createdBy: '绩效结算',
        id: `salary-performance-adjustment:${line.salarySettlementReference}`,
        memberId: member.id,
        month,
        reason: `${line.kind}原计划进入 ${line.deferredFromMonth} 薪酬；原薪酬已确认，转入本月${isIncrease ? '绩效补发' : '绩效追回'}`,
        salarySettlementReference: line.salarySettlementReference,
        source: '薪酬调整',
        status: '已生效',
        taxTreatment: '税前计税',
        type: isIncrease ? '补发' : '误发追回',
        updatedAt: sourceRecord?.quarterlyReviewResult?.confirmedAt ?? sourceRecord?.updatedAt ?? `${month}-01 00:00`
      };
    });
    const salaryAdjustmentRecords = [
      ...salaryAdjustments.filter(
        (record) => record.memberId === member.id && record.month === month && record.status !== '已作废'
      ),
      ...generatedPerformanceAdjustments
    ]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const salaryAdjustmentIncreaseAmount = roundSalaryMoney(
      salaryAdjustmentRecords
        .filter((record) => getSalaryAdjustmentDirection(record.type) === '增加')
        .reduce((total, record) => total + record.amount, 0)
    );
    const salaryAdjustmentDeductionAmount = roundSalaryMoney(
      salaryAdjustmentRecords
        .filter((record) => getSalaryAdjustmentDirection(record.type) === '减少')
        .reduce((total, record) => total + record.amount, 0)
    );
    const employeeAdvanceRecoveryAmount = roundSalaryMoney(
      salaryAdjustmentRecords
        .filter((record) => record.type === '代垫款收回' && record.taxTreatment === '税后调整')
        .reduce((total, record) => total + record.amount, 0)
    );
    const salaryAdjustmentAmount = roundSalaryMoney(salaryAdjustmentIncreaseAmount - salaryAdjustmentDeductionAmount);
    const taxableSalaryAdjustmentAmount = roundSalaryMoney(
      salaryAdjustmentRecords
        .filter((record) => record.taxTreatment === '税前计税')
        .reduce((total, record) => total + getSalaryAdjustmentSignedAmount(record), 0)
    );
    const performanceSourceRecordIds = new Set(performanceSettlementLines.map((line) => line.sourceRecordId));
    const monthlyPerformanceRecords = performanceRecords
      .filter((record) => record.workNo === member.id && performanceSourceRecordIds.has(record.id))
      .sort(
        (left, right) =>
          left.category.localeCompare(right.category) ||
          left.ruleVersion.localeCompare(right.ruleVersion) ||
          left.id.localeCompare(right.id)
      );
    const performanceTotalAmount = roundSalaryMoney(
      monthlyPerformanceRecords.reduce((total, record) => total + record.monthlyAmount, 0)
    );
    const performancePrepayAmount = roundSalaryMoney(
      directPerformanceSettlementLines
        .filter((line) => line.kind === '月度预发')
        .reduce((total, line) => total + line.amount, 0)
    );
    const performanceQuarterlyAdjustmentAmount = roundSalaryMoney(
      directPerformanceSettlementLines
        .filter((line) => line.kind === '季度复核差额')
        .reduce((total, line) => total + line.amount, 0)
    );
    const performancePayAmount = roundSalaryMoney(
      performancePrepayAmount + performanceQuarterlyAdjustmentAmount
    );
    const performanceIncreaseAmount = roundSalaryMoney(
      directPerformanceSettlementLines.reduce((total, line) => total + Math.max(0, line.amount), 0)
    );
    const performanceDeductionAmount = roundSalaryMoney(
      directPerformanceSettlementLines.reduce((total, line) => total + Math.abs(Math.min(0, line.amount)), 0)
    );
    const deductibleSourceCategories = new Set(
      socialInsuranceSourceRecords
        .filter(
          (record) =>
            record.employeeNo === member.id &&
            record.period === month &&
            isSocialInsurancePayrollDeductible(record)
        )
        .map((record) => record.category)
    );
    const socialInsuranceDeductionRecords = socialInsuranceDeductions
      .filter(
        (record) =>
          record.employeeNo === member.id &&
          record.payrollMonth === month &&
          deductibleSourceCategories.has(record.category)
      )
      .sort(
        (left, right) =>
          left.category.localeCompare(right.category) ||
          left.sourceMonth.localeCompare(right.sourceMonth) ||
          left.id.localeCompare(right.id)
      );
    const socialInsuranceDeductionAmount = roundSalaryMoney(
      socialInsuranceDeductionRecords.reduce((total, record) => total + record.personalAmount, 0)
    );
    const plannedPersonalIncomeTaxPeriod = workflow?.personalIncomeTaxPeriod
      ?? (getSalaryScheduledPaymentDate(month).slice(0, 7) || month);
    const personalIncomeTaxProfile = personalIncomeTaxProfiles?.find(
      (profile) => profile.employeeNo === member.id && profile.taxYear === plannedPersonalIncomeTaxPeriod.slice(0, 4)
    );
    const currentSettlementSourceRecords = buildSettlementSourceRecords({
      attendanceContract,
      member,
      personalIncomeTaxPeriod: plannedPersonalIncomeTaxPeriod,
      personalIncomeTaxProfile,
      requirePersonalIncomeTaxProfile: Boolean(personalIncomeTaxProfiles),
      socialInsuranceSourceRecords
    });
    const performanceClaimValidation = validateSalaryPerformanceSettlementClaim({
      memberId: member.id,
      month,
      salaryMonthlyWorkflows,
      salarySettlementReferences: performanceSettlementLines.map((line) => line.salarySettlementReference)
    });
    const hasFrozenSettlement = Boolean(
      workflow?.settlementSnapshot && (workflow.status === '已确认' || workflow.status === '已发放')
    );
    const settlementSourceRecords = hasFrozenSettlement && workflow?.settlementSourceRecords
      ? workflow.settlementSourceRecords.map((record) => ({ ...record }))
      : currentSettlementSourceRecords;
    const settlementPendingSourceLabels = hasFrozenSettlement ? [] : [
      ...settlementSourceRecords
      .filter((record) => record.status === '待确认')
      .map((record) => record.label),
      ...(performanceClaimValidation.allowed ? [] : ['绩效结果唯一承接'])
    ];
    const sourceReady = settlementPendingSourceLabels.length === 0;
    const attendanceDeductionAmount = getAttendanceDeductionAmount(member, attendanceContract, payrollHourlyRate);
    const attendanceIncreaseAmount = roundSalaryMoney(attendanceContract.payrollIncreaseHours * payrollHourlyRate);
    const attendanceAdjustmentAmount = roundSalaryMoney(attendanceContract.adjustmentHours * payrollHourlyRate);
    const attendanceDeltaHours = roundSalaryMoney(
      attendanceContract.payrollIncreaseHours - attendanceContract.payrollDeductionHours + attendanceContract.adjustmentHours
    );
    const attendanceDeltaAmount = roundSalaryMoney(
      attendanceIncreaseAmount - attendanceDeductionAmount + attendanceAdjustmentAmount
    );
    const grossSalary = roundSalaryMoney(
      baseSalaryAmount + performanceIncreaseAmount + Math.max(0, attendanceDeltaAmount) + salaryAdjustmentIncreaseAmount
    );
    const taxableSalaryIncomeAmount = roundSalaryMoney(
      Math.max(
        0,
        baseSalaryAmount + performancePayAmount + attendanceDeltaAmount + taxableSalaryAdjustmentAmount
      )
    );
    const calculatedPersonalIncomeTaxRecords = sourceReady
      ? [
          buildPersonalIncomeTaxRecord({
            currentIncomeAmount: taxableSalaryIncomeAmount,
            member,
            month: plannedPersonalIncomeTaxPeriod,
            personalIncomeTaxCumulativeSnapshots,
            personalIncomeTaxProfile,
            socialInsuranceDeductionAmount
          })
        ].filter((record): record is SalaryPersonalIncomeTaxRecord => Boolean(record))
      : [];
    const frozenPayment = salaryPaymentRecords.find(
      (payment) => payment.employeeNo === member.id && payment.payrollMonth === month
    );
    const personalIncomeTaxRecordsForMember = frozenPayment?.personalIncomeTaxRecord
      ? [frozenPayment.personalIncomeTaxRecord]
      : calculatedPersonalIncomeTaxRecords;
    const personalIncomeTaxAmount = roundSalaryMoney(
      frozenPayment?.settlementSnapshot.withheldPersonalIncomeTaxAmount ??
        personalIncomeTaxRecordsForMember.reduce((total, record) => total + record.amount, 0)
    );
    const businessDeductionAmount = roundSalaryMoney(
      Math.abs(Math.min(0, attendanceDeltaAmount))
        + performanceDeductionAmount
        + Math.max(0, salaryAdjustmentDeductionAmount - employeeAdvanceRecoveryAmount)
    );
    const calculatedSettlementSnapshot = buildSalarySettlementSnapshot({
      businessDeductionAmount,
      employeeAdvanceRecoveryAmount,
      grossEarningsAmount: grossSalary,
      payrollMonth: month,
      payrollNo: workflow?.payrollNo || buildSalaryPayrollNo(month, member.id),
      personalIncomeTaxAmount,
      socialInsuranceDeductionRecords,
      taxableIncomeAmount: taxableSalaryIncomeAmount
    });
    const settlementSnapshot = frozenPayment?.settlementSnapshot
      ?? workflow?.settlementSnapshot
      ?? calculatedSettlementSnapshot;
    const deductionAmount = roundSalaryMoney(
      settlementSnapshot.businessDeductionAmount
        + settlementSnapshot.employeeSocialInsuranceAmount
        + settlementSnapshot.employeeHousingFundAmount
        + settlementSnapshot.withheldPersonalIncomeTaxAmount
        + settlementSnapshot.employeeAdvanceRecoveryAmount
    );
    const netSalary = settlementSnapshot.employeeNetPayableAmount;
    const currentSalaryCompositionLines = buildSalaryCompositionLines({
      attendanceDeductionAmount: Math.abs(Math.min(0, attendanceDeltaAmount)),
      attendanceDeductionHours: Math.abs(Math.min(0, attendanceDeltaHours)),
      attendanceIncreaseAmount: Math.max(0, attendanceDeltaAmount),
      attendanceIncreaseHours: Math.max(0, attendanceDeltaHours),
      baseSalaryAmount,
      baseSalaryPayableHours,
      baseSalaryText,
      personalIncomeTaxAmount,
      performanceSettlementLines,
      salaryAdjustmentAmount,
      socialInsuranceDeductionAmount
    });
    const salaryCompositionLines = hasFrozenSettlement && workflow?.salaryCompositionLines
      ? workflow.salaryCompositionLines.map((line) => ({ ...line }))
      : currentSalaryCompositionLines;
    const status = getSettlementStatusFromWorkflow(workflow, sourceReady);
    const payrollNo = workflow?.payrollNo;

    return {
      attendanceAdjustmentAmount,
      attendanceDeductionAmount,
      attendanceDeltaAmount,
      attendanceIncreaseAmount,
      attendanceReport,
      baseSalaryAmount,
      baseSalaryPayableHours,
      baseSalaryText,
      canAdjust: status !== '已发放',
      canConfirm: status === '待确认',
      canPay: status === '已确认',
      deductionAmount,
      expectedWorkHours: attendanceContract.expectedWorkHours,
      expectedWorkdays: attendanceReport.expectedWorkdays,
      grossSalary: settlementSnapshot.grossEarningsAmount,
      id: buildSalaryMonthlyReportId(month, member.id),
      member,
      monthlyBaseSalaryAmount,
      month,
      netSalary,
      operationRecords: getMonthlySalaryOperationRecords({
        adjustments: salaryAdjustmentRecords,
        memberName: member.name,
        month,
        payrollNo,
        performanceSettlementLines,
        personalIncomeTaxAmount,
        settlementPendingSourceLabels,
        socialInsuranceDeductions: socialInsuranceDeductionRecords,
        workflow
      }),
      payableAttendanceDays: attendanceReport.payableAttendanceDays,
      payableAttendanceHours: attendanceContract.payableAttendanceHours,
      personalIncomeTaxAmount: settlementSnapshot.withheldPersonalIncomeTaxAmount,
      personalIncomeTaxRecords: personalIncomeTaxRecordsForMember,
      performancePayAmount,
      performancePrepayAmount,
      performanceQuarterlyAdjustmentAmount,
      performanceRecords: monthlyPerformanceRecords,
      performanceSettlementLines,
      performanceTotalAmount,
      salaryAdjustmentAmount,
      salaryAdjustmentDeductionAmount,
      salaryAdjustmentIncreaseAmount,
      salaryAdjustmentRecords,
      salaryCompositionLines,
      salaryMode: getPeopleSalaryModeText(member),
      settlementPendingSourceLabels,
      settlementSnapshot,
      settlementSourceRecords,
      socialInsuranceDeductionAmount: roundSalaryMoney(
        settlementSnapshot.employeeSocialInsuranceAmount + settlementSnapshot.employeeHousingFundAmount
      ),
      socialInsuranceDeductionRecords,
      status,
      taxableSalaryIncomeAmount: settlementSnapshot.taxableIncomeAmount,
      workflow
    };
  });
}

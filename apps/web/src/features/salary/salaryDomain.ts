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

export type SalaryMonthlyStatus = '结算中' | '待确认' | '已确认' | '已结算';
export type SalaryAdjustmentDirection = '增加' | '减少';
export type SalaryAdjustmentType = '奖金' | '补贴' | '补发' | '误发追回' | '代垫款收回';
export type SalaryAdjustmentStatus = '草稿' | '已生效' | '已作废';
export type SalaryAdjustmentDisplayStatus = SalaryAdjustmentStatus | '已锁定';
export type SalarySettlementSourceStatus = '待确认' | '已确认' | '本月不扣' | '不适用';
export type SalarySettlementSourceKey = 'attendance-monthly' | 'social-insurance' | 'housing-fund';

export type SalaryAdjustmentRecord = {
  amount: number;
  createdAt: string;
  createdBy: string;
  id: string;
  memberId: string;
  month: string;
  reason: string;
  source: '薪酬调整';
  status: SalaryAdjustmentStatus;
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
  sourceLabel: string;
  sourceTaskCount: number;
  updatedAt: string;
  workNo: string;
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
  settledAt?: string;
  settledBy?: string;
  status: SalaryMonthlyStatus;
  updatedAt: string;
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
  canSettle: boolean;
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
  performanceRecords: SalaryPerformanceSourceRecord[];
  performanceTotalAmount: number;
  salaryAdjustmentAmount: number;
  salaryAdjustmentDeductionAmount: number;
  salaryAdjustmentIncreaseAmount: number;
  salaryAdjustmentRecords: SalaryAdjustmentRecord[];
  salaryCompositionLines: SalaryCompositionLine[];
  salaryMode: ReturnType<typeof getPeopleSalaryModeText>;
  settlementPendingSourceLabels: string[];
  settlementSourceRecords: SalarySettlementSourceRecord[];
  socialInsuranceDeductionAmount: number;
  socialInsuranceDeductionRecords: SocialInsurancePayrollDeductionRecord[];
  status: SalaryMonthlyStatus;
  workflow?: SalaryMonthlyWorkflowRecord;
};

type BuildSalaryMonthlyReportsInput = {
  attendanceReports: AttendanceMonthlyReport[];
  performanceRecords: SalaryPerformanceSourceRecord[];
  salaryAdjustments: SalaryAdjustmentRecord[];
  salaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[];
  personalIncomeTaxCumulativeSnapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[];
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

export function buildSalaryMonthlyReportId(month: string, memberId: string) {
  return `${month}-${memberId}`;
}

export function buildSalaryMonthlyWorkflowId(month: string, memberId: string) {
  return `salary-monthly-${month}-${memberId}`;
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

export function isSalaryMonthlySettled(
  workflows: SalaryMonthlyWorkflowRecord[],
  memberId: string,
  month: string
) {
  return workflows.some((workflow) => workflow.memberId === memberId && workflow.month === month && workflow.status === '已结算');
}

export function getSalaryAdjustmentDisplayStatus(
  record: SalaryAdjustmentRecord,
  workflows: SalaryMonthlyWorkflowRecord[]
): SalaryAdjustmentDisplayStatus {
  return isSalaryMonthlySettled(workflows, record.memberId, record.month) ? '已锁定' : record.status;
}

export function toAttendanceMonthlySalarySettlementRecords(
  workflows: SalaryMonthlyWorkflowRecord[]
): AttendanceMonthlySalarySettlementRecord[] {
  return workflows
    .filter((workflow) => workflow.status === '已结算')
    .map((workflow) => ({
      actor: workflow.settledBy ?? workflow.confirmedBy ?? '薪酬管理',
      memberId: workflow.memberId,
      month: workflow.month,
      note: workflow.note || '薪酬明细已结算，考勤月报锁定',
      settledAt: workflow.settledAt ?? workflow.updatedAt,
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
  if (workflow?.status === '已结算') {
    return workflow.status;
  }

  if (workflow?.status === '已确认' && sourceReady) {
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

  if (record.handlingStatus === '已确认') {
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
  socialInsuranceSourceRecords
}: {
  attendanceContract: PayrollAttendanceMonthlyContract;
  member: PeopleMember;
  socialInsuranceSourceRecords: SocialInsuranceEmployeeRecord[];
}): SalarySettlementSourceRecord[] {
  const { month } = attendanceContract;
  const socialInsuranceRecord = socialInsuranceSourceRecords.find(
    (record) => record.employeeNo === member.id && record.period === month && record.category === '社保'
  );
  const housingFundRecord = socialInsuranceSourceRecords.find(
    (record) => record.employeeNo === member.id && record.period === month && record.category === '公积金'
  );
  const isHousingFundApplicable = isPeopleHousingFundContributionApplicable(member, month);

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
    .filter((snapshot) => snapshot.employeeNo === employeeNo && snapshot.taxYear === taxYear && snapshot.period < month)
    .sort((left, right) => right.period.localeCompare(left.period))[0];
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

export function buildPersonalIncomeTaxCumulativeSnapshotsFromReports(
  existingSnapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[],
  reports: SalaryMonthlyReport[]
) {
  const nextSnapshots = reports
    .filter((report) => report.status === '已确认' || report.status === '已结算')
    .flatMap((report) =>
      report.personalIncomeTaxRecords.map((record) => ({
        cumulativeAdditionalDeductionAmount: record.cumulativeAdditionalDeductionAmount,
        cumulativeBasicDeductionAmount: record.cumulativeBasicDeductionAmount,
        cumulativeIncomeAmount: record.cumulativeIncomeAmount,
        cumulativeOtherDeductionAmount: record.cumulativeOtherDeductionAmount,
        cumulativeSpecialDeductionAmount: record.cumulativeSpecialDeductionAmount,
        cumulativeTaxAmount: record.cumulativeTaxAmount,
        cumulativeTaxableIncomeAmount: record.cumulativeTaxableIncomeAmount,
        cumulativeWithheldTaxAmount: record.cumulativeTaxAmount,
        employeeNo: record.employeeNo,
        period: record.payrollMonth,
        taxYear: getPersonalIncomeTaxYear(record.payrollMonth),
        updatedAt: report.workflow?.confirmedAt ?? report.workflow?.settledAt ?? record.payrollMonth
      }))
    );

  return upsertPersonalIncomeTaxCumulativeSnapshots(existingSnapshots, nextSnapshots);
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

function buildPersonalIncomeTaxRecord({
  grossSalary,
  member,
  month,
  personalIncomeTaxCumulativeSnapshots,
  socialInsuranceDeductionAmount
}: {
  grossSalary: number;
  member: PeopleMember;
  month: string;
  personalIncomeTaxCumulativeSnapshots: SalaryPersonalIncomeTaxCumulativeSnapshot[];
  socialInsuranceDeductionAmount: number;
}): SalaryPersonalIncomeTaxRecord | undefined {
  if (grossSalary <= 0) {
    return undefined;
  }

  const priorSnapshot =
    getLatestPersonalIncomeTaxSnapshot(personalIncomeTaxCumulativeSnapshots, member.id, month) ??
    createEmptyPersonalIncomeTaxSnapshot(member.id, month);
  const taxResult = calculateCumulativePersonalIncomeTax({
    currentIncomeAmount: grossSalary,
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

function getMonthlySalaryOperationRecords({
  adjustments,
  memberName,
  month,
  payrollNo,
  performancePayAmount,
  performanceRecords,
  personalIncomeTaxAmount,
  settlementPendingSourceLabels,
  socialInsuranceDeductions,
  workflow
}: {
  adjustments: SalaryAdjustmentRecord[];
  memberName: string;
  month: string;
  payrollNo?: string;
  performancePayAmount: number;
  performanceRecords: SalaryPerformanceSourceRecord[];
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

  if (performanceRecords.length > 0) {
    rows.push({
      action: '读取绩效明细',
      actor: '系统',
      id: `salary-op-performance-${month}-${memberName}`,
      object,
      summary: `绩效预发 ${formatSalaryMoney(performancePayAmount)} 已计入应发`,
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

  if (workflow?.settledAt) {
    rows.push({
      action: '结算薪酬明细',
      actor: workflow.settledBy ?? '周倩',
      id: `salary-op-settle-${workflow.id}`,
      object,
      summary: payrollNo ? `生成薪酬结算号 ${payrollNo}` : '薪酬明细已结算',
      time: workflow.settledAt
    });
  }

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
  performancePayAmount,
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
  performancePayAmount: number;
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

  if (performancePayAmount > 0) {
    lines.push({
      amount: performancePayAmount,
      direction: '应发',
      id: 'performance-prepay',
      item: '绩效预发',
      note: '月度绩效预发金额',
      source: '月度绩效'
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
  salaryAdjustments,
  salaryMonthlyWorkflows,
  socialInsuranceDeductions,
  socialInsuranceSourceRecords
}: BuildSalaryMonthlyReportsInput): SalaryMonthlyReport[] {
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
    const salaryAdjustmentRecords = salaryAdjustments
      .filter((record) => record.memberId === member.id && record.month === month && record.status !== '已作废')
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
    const salaryAdjustmentAmount = roundSalaryMoney(salaryAdjustmentIncreaseAmount - salaryAdjustmentDeductionAmount);
    const monthlyPerformanceRecords = performanceRecords
      .filter((record) => record.workNo === member.id && record.performanceMonth === month)
      .sort(
        (left, right) =>
          left.category.localeCompare(right.category) ||
          left.ruleVersion.localeCompare(right.ruleVersion) ||
          left.id.localeCompare(right.id)
      );
    const performanceTotalAmount = roundSalaryMoney(
      monthlyPerformanceRecords.reduce((total, record) => total + record.monthlyAmount, 0)
    );
    const performancePayAmount = roundSalaryMoney(
      monthlyPerformanceRecords.reduce((total, record) => total + record.prepayAmount, 0)
    );
    const socialInsuranceDeductionRecords = socialInsuranceDeductions
      .filter(
        (record) =>
          record.employeeNo === member.id &&
          record.payrollMonth === month &&
          (record.category !== '公积金' || isPeopleHousingFundContributionApplicable(member, month))
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
    const settlementSourceRecords = buildSettlementSourceRecords({
      attendanceContract,
      member,
      socialInsuranceSourceRecords
    });
    const settlementPendingSourceLabels = settlementSourceRecords
      .filter((record) => record.status === '待确认')
      .map((record) => record.label);
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
      baseSalaryAmount + performancePayAmount + Math.max(0, attendanceDeltaAmount) + Math.max(0, salaryAdjustmentAmount)
    );
    const personalIncomeTaxRecordsForMember = sourceReady
      ? [
          buildPersonalIncomeTaxRecord({
            grossSalary,
            member,
            month,
            personalIncomeTaxCumulativeSnapshots,
            socialInsuranceDeductionAmount
          })
        ].filter((record): record is SalaryPersonalIncomeTaxRecord => Boolean(record))
      : [];
    const personalIncomeTaxAmount = roundSalaryMoney(
      personalIncomeTaxRecordsForMember.reduce((total, record) => total + record.amount, 0)
    );
    const deductionAmount = roundSalaryMoney(
      Math.abs(Math.min(0, attendanceDeltaAmount)) +
        Math.abs(Math.min(0, salaryAdjustmentAmount)) +
        socialInsuranceDeductionAmount +
        personalIncomeTaxAmount
    );
    const netSalary = roundSalaryMoney(Math.max(0, grossSalary - deductionAmount));
    const salaryCompositionLines = buildSalaryCompositionLines({
      attendanceDeductionAmount: Math.abs(Math.min(0, attendanceDeltaAmount)),
      attendanceDeductionHours: Math.abs(Math.min(0, attendanceDeltaHours)),
      attendanceIncreaseAmount: Math.max(0, attendanceDeltaAmount),
      attendanceIncreaseHours: Math.max(0, attendanceDeltaHours),
      baseSalaryAmount,
      baseSalaryPayableHours,
      baseSalaryText,
      personalIncomeTaxAmount,
      performancePayAmount,
      salaryAdjustmentAmount,
      socialInsuranceDeductionAmount
    });
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
      canAdjust: status !== '已结算',
      canConfirm: status === '待确认',
      canSettle: status === '已确认',
      deductionAmount,
      expectedWorkHours: attendanceContract.expectedWorkHours,
      expectedWorkdays: attendanceReport.expectedWorkdays,
      grossSalary,
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
        performancePayAmount,
        performanceRecords: monthlyPerformanceRecords,
        personalIncomeTaxAmount,
        settlementPendingSourceLabels,
        socialInsuranceDeductions: socialInsuranceDeductionRecords,
        workflow
      }),
      payableAttendanceDays: attendanceReport.payableAttendanceDays,
      payableAttendanceHours: attendanceContract.payableAttendanceHours,
      personalIncomeTaxAmount,
      personalIncomeTaxRecords: personalIncomeTaxRecordsForMember,
      performancePayAmount,
      performanceRecords: monthlyPerformanceRecords,
      performanceTotalAmount,
      salaryAdjustmentAmount,
      salaryAdjustmentDeductionAmount,
      salaryAdjustmentIncreaseAmount,
      salaryAdjustmentRecords,
      salaryCompositionLines,
      salaryMode: getPeopleSalaryModeText(member),
      settlementPendingSourceLabels,
      settlementSourceRecords,
      socialInsuranceDeductionAmount,
      socialInsuranceDeductionRecords,
      status,
      workflow
    };
  });
}

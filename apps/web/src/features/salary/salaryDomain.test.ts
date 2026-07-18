import type { AttendanceMonthlyReport } from '../people/peopleAttendanceMonthlyDomain';
import type { PeopleMember } from '../people/peopleTypes';
import type { SocialInsuranceEmployeeRecord, SocialInsurancePayrollDeductionRecord } from '../finance/financeSocialInsuranceData';
import { performanceRulePresets } from '../performance/performanceMockData';
import { buildPerformanceSalarySettlementReference } from '../performance/performanceMonthlyModel';
import { buildTaskPerformanceMonthlySourceRecords } from '../performance/taskPerformanceMonthlySourceModel';
import type { AcceptanceScoringDraft } from '../tasks/taskAcceptanceModel';
import { applyTaskAcceptanceCommit } from '../tasks/taskAcceptanceCommitModel';
import { prepareTaskAcceptanceCommit } from '../tasks/taskAcceptanceWorkflow';
import type { StoreTaskRecord, TaskPerformanceScoringRecord } from '../tasks/TaskManagementState';
import {
  buildPersonalIncomeTaxCumulativeSnapshotsFromPayments,
  buildSalaryMonthlyReports,
  buildSalaryPayrollNo,
  calculateCumulativePersonalIncomeTax,
  createConfirmedSalaryMonthlyWorkflow,
  createPaidSalaryMonthlyWorkflow,
  createSalaryPaymentRecord,
  getSalaryAdjustmentDirection,
  getSalaryAdjustmentDisplayStatus,
  getSalaryAdjustmentSignedAmount,
  getSalaryScheduledPaymentDate,
  parseSalaryAmount,
  recalculateSalaryMonthlyPayment,
  toAttendanceMonthlySalarySettlementRecords,
  validateSalaryPaymentConfirmation,
  validateSalaryPerformanceSettlementClaim,
  type SalaryAdjustmentRecord,
  type SalaryPerformanceSourceRecord,
  type SalaryPersonalIncomeTaxCumulativeSnapshot,
  type SalaryMonthlyWorkflowRecord,
  type SalarySettlementSnapshot
} from './salaryDomain';
import {
  getSalaryIitCurrentDeductionSummary,
  getSalaryIitCurrentBasicDeductionAmount,
  isSalaryIitProfileReady,
  type SalaryIitProfile
} from './salaryPersonalIncomeTaxModel';
import {
  getSalaryMonthlyAccountingPeriod,
  getSalaryPayslipNo,
  getSalaryPayslipStatus,
  getSalaryPerformanceSettlementRows
} from './salaryMonthlyDisplayModel';
import {
  buildSalaryOverview,
  getSalaryOverviewReportMonths
} from './salaryOverviewModel';

function attachQuarterlySalaryConsumerFixture({
  confirmedAt,
  finalAmount,
  records,
  resultKey
}: {
  confirmedAt: string;
  finalAmount: number;
  records: SalaryPerformanceSourceRecord[];
  resultKey: string;
}): SalaryPerformanceSourceRecord[] {
  const sourceMonths = [...new Set(records.map((record) => record.performanceMonth))].sort();
  const prepayAmount = Math.round(records.reduce((total, record) => total + record.prepayAmount, 0) * 100) / 100;
  const salarySettlementReference = buildPerformanceSalarySettlementReference(
    resultKey,
    'quarterly-difference',
    'v1'
  );
  const settlementMonth = sourceMonths.at(-1) ?? '';

  return records.map((record, index) =>
    index === 0
      ? {
          ...record,
          quarterlyReviewResult: {
            confirmedAt,
            finalAmount,
            prepayAmount,
            reviewPeriod: resultKey.split(':')[2] ?? '',
            salarySettlementReference,
            settlementDate: `${settlementMonth}-01`,
            sourceMonths,
            sourceRecordIds: records.map((sourceRecord) => sourceRecord.id)
          }
        }
      : record
  );
}

type UnitTest = {
  name: string;
  run: () => void;
};

type UnitTestResult = {
  executedTestNames: string[];
  failures: string[];
  passed: number;
  passedTestNames: string[];
  total: number;
};

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (!Object.is(actual, expected)) {
    fail(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function createSalarySettlementSnapshot(
  overrides: Partial<SalarySettlementSnapshot> = {}
): SalarySettlementSnapshot {
  return {
    businessDeductionAmount: 0,
    employeeGrossPayableAmount: 12000,
    employeeHousingFundAmount: 0,
    employeeNetPayableAmount: 11000,
    employeeSocialInsuranceAmount: 800,
    employerContributionAmount: 800,
    employerHousingFundAmount: 0,
    employerSocialInsuranceAmount: 800,
    grossEarningsAmount: 12000,
    payrollMonth: '2026-06',
    payrollNo: 'PAY-202606-20260001',
    taxableIncomeAmount: 11200,
    totalEmploymentCostAmount: 12800,
    withheldPersonalIncomeTaxAmount: 200,
    ...overrides
  };
}

function createMember(overrides: Partial<PeopleMember> = {}): PeopleMember {
  return {
    address: '武汉市洪山区',
    archiveFiles: [],
    archiveStatus: '资料完整',
    archiveUpdatedAt: '2026-06-01',
    auditRecords: [],
    birthDate: '1992-01-01',
    city: '武汉',
    contractNo: 'HT-TEST-001',
    contractStartAt: '2026-01-01',
    contractStatus: '正式合同',
    contractType: '劳动合同',
    education: '本科',
    educationMajor: '设计',
    email: 'test@example.com',
    emergencyContact: '测试联系人',
    emergencyContactPhone: '13800000000',
    emergencyContactRelation: '家属',
    gender: '女',
    graduatedAt: '2014-06-30',
    graduationSchool: '武汉大学',
    housingFundEffectiveMonth: '2026-01',
    housingFundStatus: '缴存',
    hukouAddress: '湖北武汉',
    id: '20260001',
    idDocumentType: '身份证',
    idValidUntil: '2036-01-01',
    identityNo: '420000199201010000',
    joinedAt: '2026-01-01',
    mobile: '13800000001',
    name: '测试人员',
    nationality: '中国',
    paymentProfile: {
      accountName: '测试人员',
      bankAccount: '6222000000000000000',
      bankName: '招商银行',
      mode: '工资发放',
      payCycle: '月度'
    },
    personnelType: '全职',
    position: '设计师',
    salaryProfile: {
      effectiveAt: '2026-01-01',
      note: '',
      payCycle: '月度',
      regularSalary: '11000 元/月',
      status: '已配置',
      structure: '固定月薪'
    },
    source: '社招',
    status: '在职',
    taskAccessStatus: '可参与任务',
    taskCapabilityIds: [],
    taskRecords: [],
    wechat: 'test-wechat',
    ...overrides
  };
}

function createWorkdayDates(month: string) {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const dates: string[] = [];

  for (let cursor = new Date(year, monthIndex, 1); cursor.getMonth() === monthIndex; cursor.setDate(cursor.getDate() + 1)) {
    const day = cursor.getDay();

    if (day !== 0 && day !== 6) {
      const date = String(cursor.getDate()).padStart(2, '0');
      dates.push(`${month}-${date}`);
    }
  }

  return dates;
}

function createAttendanceExceptionRecord(
  overrides: Partial<AttendanceMonthlyReport['relatedExceptions'][number]> = {}
): AttendanceMonthlyReport['relatedExceptions'][number] {
  return {
    durationHours: 8,
    effect: '不可用',
    endAt: '2026-06-10 18:00',
    id: 'attendance-leave-001',
    memberId: '20260001',
    mode: '日常记录',
    reason: '请假',
    recordedAt: '2026-06-10',
    recorder: '测试人',
    startAt: '2026-06-10 10:00',
    status: '已结束',
    type: '请假',
    updatedAt: '2026-06-10',
    ...overrides
  };
}

function createAttendanceReport(overrides: Partial<AttendanceMonthlyReport> = {}): AttendanceMonthlyReport {
  const member = createMember();
  const month = overrides.month ?? '2026-06';

  return {
    adjustmentDays: 0,
    adjustmentHours: 0,
    canAdjust: true,
    expectedWorkdayDates: createWorkdayDates(month),
    expectedWorkHours: 176,
    expectedWorkdays: 22,
    id: '2026-06-20260001',
    leaveDays: 1,
    leaveHours: 8,
    makeupWorkDays: 0,
    makeupWorkHours: 0,
    member,
    month,
    payableAttendanceDays: 21,
    payableAttendanceHours: 168,
    payrollDeductionEntries: [],
    payrollDeductionDays: 1,
    payrollDeductionHours: 8,
    payrollIncreaseDays: 0,
    payrollIncreaseHours: 0,
    restBalanceDays: 0,
    restBalanceHours: 0,
    restCoveredDays: 0,
    restCoveredHours: 0,
    relatedAdjustments: [],
    relatedExceptions: [],
    restDays: 0,
    restHours: 0,
    restUncoveredDays: 0,
    restUncoveredHours: 0,
    salarySettlementStatus: '未结算',
    status: '已确认',
    temporaryUnavailableDays: 0,
    temporaryUnavailableHours: 0,
    workCalendarName: '测试双休 / 双休',
    ...overrides
  };
}

function createAdjustment(overrides: Partial<SalaryAdjustmentRecord> = {}): SalaryAdjustmentRecord {
  return {
    amount: 500,
    createdAt: '2026-06-18 10:00',
    createdBy: '测试人',
    id: 'salary-adjust-001',
    memberId: '20260001',
    month: '2026-06',
    reason: '测试调整',
    source: '薪酬调整',
    status: '已生效',
    taxTreatment: '税前计税',
    type: '补贴',
    updatedAt: '2026-06-18 10:00',
    ...overrides
  };
}

function createSocialInsuranceDeduction(
  overrides: Partial<SocialInsurancePayrollDeductionRecord> = {}
): SocialInsurancePayrollDeductionRecord {
  return {
    accrualPeriod: '2026-06',
    category: '社保',
    companyAmount: 1000,
    contributionBase: 8000,
    employeeName: '测试人员',
    employeeNo: '20260001',
    handlingStatus: '已确认',
    id: 'social-insurance-deduction-001',
    payrollMonth: '2026-06',
    personalAmount: 800,
    reason: '测试社保',
    sourceMonth: '2026-06',
    ...overrides
  };
}

function createSocialInsuranceSource(
  overrides: Partial<SocialInsuranceEmployeeRecord> = {}
): SocialInsuranceEmployeeRecord {
  return {
    category: '社保',
    companyAmount: 1000,
    contributionBase: 8000,
    department: '设计部',
    employeeName: '测试人员',
    employeeNo: '20260001',
    handlingStatus: '已确认',
    id: 'social-insurance-source-001',
    operationRecords: [],
    period: '2026-06',
    personalAmount: 800,
    position: '设计师',
    salaryBase: 8000,
    updatedAt: '2026-06-18',
    ...overrides
  };
}

function createPersonalIncomeTaxSnapshot(
  overrides: Partial<SalaryPersonalIncomeTaxCumulativeSnapshot> = {}
): SalaryPersonalIncomeTaxCumulativeSnapshot {
  return {
    cumulativeAdditionalDeductionAmount: 0,
    cumulativeBasicDeductionAmount: 25000,
    cumulativeIncomeAmount: 60500,
    cumulativeOtherDeductionAmount: 0,
    cumulativeSpecialDeductionAmount: 4000,
    cumulativeTaxAmount: 945,
    cumulativeTaxableIncomeAmount: 31500,
    cumulativeWithheldTaxAmount: 945,
    employeeNo: '20260001',
    period: '2026-05',
    taxYear: '2026',
    updatedAt: '2026-05-31',
    ...overrides
  };
}

function createPersonalIncomeTaxProfile(overrides: Partial<SalaryIitProfile> = {}): SalaryIitProfile {
  return {
    acquiredAt: '2026-06-18',
    acquisitionStatus: '已获取',
    basicDeductionMethod: '按月累计',
    deductionItems: [],
    employeeNo: '20260001',
    employmentScenario: '普通任职',
    evidenceFiles: [],
    firstEmploymentEvidenceFiles: [],
    personnelReportedAt: '2026-06-01',
    personnelReportingStatus: '已报送',
    residentType: '居民个人',
    source: '自然人电子税务局',
    taxYear: '2026',
    updatedAt: '2026-06-18',
    ...overrides
  };
}

function createPerformanceRecord(overrides: Partial<SalaryPerformanceSourceRecord> = {}): SalaryPerformanceSourceRecord {
  return {
    category: '绘图任务制',
    employeeName: '测试人员',
    id: 'performance-001',
    monthlyAmount: 1200,
    note: '测试绩效',
    performanceMonth: '2026-06',
    prepayAmount: 600,
    qualityScore: 88,
    ruleName: '绘图任务制V1',
    ruleVersion: 'V1',
    salarySettlementReference: 'performance-result:performance-001:monthly-prepay:v1',
    sourceLabel: '月度绩效',
    sourceTaskCount: 10,
    updatedAt: '2026-06-18 09:00',
    workNo: '20260001',
    ...overrides
  };
}

function createAcceptedPerformanceTask(overrides: Partial<StoreTaskRecord> = {}): StoreTaskRecord {
  const taskId = overrides.id ?? 'task-performance-001';

  return {
    acceptedAt: '2026-06-13 18:00',
    acceptorId: '20260002',
    acceptorName: '验收人',
    brandId: 'brand-test',
    code: 'TASK-PERFORMANCE-001',
    createdAt: '2026-06-10 09:00',
    customerId: 'customer-test',
    executorId: '20260001',
    executorName: '测试人员',
    files: [],
    customerBillingSnapshot: {
      billable: true,
      brandId: 'brand-test',
      brandName: '测试品牌',
      capturedAt: '2026-06-10 09:00',
      contractAmount: null,
      contractAmountMode: '无固定金额',
      currency: 'CNY',
      customerId: 'customer-test',
      customerName: '测试客户',
      id: `task-billing-snapshot-${taskId}`,
      priceVersion: 1,
      priceVersionId: 'brand-price-test-v1',
      settlementPolicy: { mode: '按任务结算', perTaskDueDays: 30 },
      settlementPolicyVersion: 1,
      settlementPolicyVersionId: 'brand-settlement-test-v1',
      taskConfigId: 'task-type-floor-plan',
      taskId,
      unitPrice: 1000
    },
    id: taskId,
    name: '测试平面方案',
    note: '',
    operationRecords: [],
    plannedDeliveryAt: '2026-06-13 18:00',
    plannedDurationHours: 24,
    reworkCount: 0,
    status: '已完成',
    storeId: 'store-test',
    submittedAt: '2026-06-13 17:00',
    taskConfigId: 'task-type-floor-plan',
    updatedAt: '2026-06-13 18:00',
    ...overrides
  };
}

function createAcceptedPerformanceScoring(
  overrides: Partial<TaskPerformanceScoringRecord> = {}
): TaskPerformanceScoringRecord {
  return {
    adjustmentReason: '',
    confirmedAt: '2026-06-13 18:00',
    confirmedBy: '验收人',
    id: 'score-task-performance-001',
    operationRecords: [
      {
        action: '验收计分',
        actor: '验收人',
        id: 'op-score-task-performance-001',
        object: '测试平面方案',
        summary: '验收完成并计入绩效',
        time: '2026-06-13 18:00'
      }
    ],
    performanceCategory: '绘图任务制',
    qualityBand: '80-89分',
    qualityDimensionScores: [
      { id: 'quality', maxScore: 40, name: '成果有效性与质量', score: 35 },
      { id: 'timeliness', maxScore: 25, name: '交付时效', score: 22 },
      { id: 'workflow', maxScore: 25, name: '流程闭环', score: 22 },
      { id: 'collaboration', maxScore: 10, name: '项目配合与沟通归档', score: 9 }
    ],
    qualityScore: 88,
    ruleId: 'perf-rule-space-design-2026-final',
    ruleName: '绘图任务制V1',
    ruleVersion: 'V1',
    scoreItemId: 'space-plan',
    scoreItemName: '平面方案',
    scoreValue: 3.4,
    sourceMonth: '2026-06',
    status: '已计入',
    taskId: 'task-performance-001',
    updatedAt: '2026-06-13 18:00',
    ...overrides
  };
}

function createWorkflow(overrides: Partial<SalaryMonthlyWorkflowRecord> = {}): SalaryMonthlyWorkflowRecord {
  return {
    confirmedAt: '2026-06-18 10:30',
    confirmedBy: '测试确认人',
    id: 'salary-monthly-2026-06-20260001',
    memberId: '20260001',
    month: '2026-06',
    note: '测试结算',
    payrollNo: 'PAY-TEST-001',
    paidAt: '2026-06-18 11:00',
    paidBy: '测试发放人',
    status: '已发放',
    updatedAt: '2026-06-18 11:00',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'uses salary month as the accounting period guard source',
    run: () => {
      assertEqual(
        getSalaryMonthlyAccountingPeriod('2026-06'),
        '2026-06',
        'salary monthly source writes should be guarded by payroll result month'
      );
    }
  },
  {
    name: 'calculates monthly withholding with additional and other deductions',
    run: () => {
      const result = calculateCumulativePersonalIncomeTax({
        currentAdditionalDeductionAmount: 2500,
        currentIncomeAmount: 12000,
        currentOtherDeductionAmount: 1000,
        currentSpecialDeductionAmount: 800,
        priorSnapshot: createPersonalIncomeTaxSnapshot({
          cumulativeBasicDeductionAmount: 0,
          cumulativeIncomeAmount: 0,
          cumulativeSpecialDeductionAmount: 0,
          cumulativeTaxAmount: 0,
          cumulativeTaxableIncomeAmount: 0,
          cumulativeWithheldTaxAmount: 0,
          period: '2026-00'
        })
      });

      assertEqual(result.currentTaxableIncomeAmount, 2700, 'current taxable income should deduct basic, special, additional and other deductions');
      assertEqual(result.amount, 81, 'current withholding should use the cumulative withholding bracket');
    }
  },
  {
    name: 'applies year-to-date basic deduction for first employment in the tax year',
    run: () => {
      const amount = getSalaryIitCurrentBasicDeductionAmount({
        month: '2026-06',
        priorCumulativeBasicDeductionAmount: 0,
        profile: createPersonalIncomeTaxProfile({
          employmentScenario: '本年首次就业',
          firstEmploymentMonth: '2026-06'
        })
      });

      assertEqual(amount, 30000, 'first employment should apply 5000 times the current calendar month number');
    }
  },
  {
    name: 'uses the actual payment month for first-employment cumulative basic deduction',
    run: () => {
      const amount = getSalaryIitCurrentBasicDeductionAmount({
        month: '2026-07',
        priorCumulativeBasicDeductionAmount: 0,
        profile: createPersonalIncomeTaxProfile({
          employmentScenario: '本年首次就业',
          firstEmploymentMonth: '2026-06'
        })
      });

      assertEqual(amount, 35000, 'June first employment paid in July should use the July year-to-date basic deduction');
    }
  },
  {
    name: 'applies the 60000 annual basic deduction only after low-income eligibility is confirmed',
    run: () => {
      const eligibleProfile = createPersonalIncomeTaxProfile({
        basicDeductionMethod: '全年6万元直接扣除',
        lowIncomeEligibility: {
          confirmedAt: '2026-01-05',
          currentYearContinuedEmployment: true,
          priorYearEveryMonthEmployment: true,
          priorYearGrossIncomeAmount: 48000
        }
      });
      const firstPaymentAmount = getSalaryIitCurrentBasicDeductionAmount({
        month: '2026-01',
        priorCumulativeBasicDeductionAmount: 0,
        profile: eligibleProfile
      });
      const repeatedPaymentAmount = getSalaryIitCurrentBasicDeductionAmount({
        month: '2026-01',
        priorCumulativeBasicDeductionAmount: 60000,
        priorCumulativePeriod: '2026-01',
        profile: eligibleProfile
      });

      assertEqual(firstPaymentAmount, 60000, 'eligible low-income employees should apply the annual 60000 deduction directly');
      assertEqual(repeatedPaymentAmount, 0, 'the annual deduction must not be repeated for a second payment');
      assertEqual(isSalaryIitProfileReady(eligibleProfile, '2026-01'), true, 'complete low-income eligibility should be payroll-ready');
      assertEqual(
        isSalaryIitProfileReady({ ...eligibleProfile, employmentScenario: '本年首次就业' }, '2026-01'),
        false,
        'first employment and prior-year full employment must not be combined'
      );
      assertEqual(
        isSalaryIitProfileReady(
          createPersonalIncomeTaxProfile({
            basicDeductionMethod: '全年6万元直接扣除',
            lowIncomeEligibility: {
              confirmedAt: '2026-01-05',
              currentYearContinuedEmployment: true,
              priorYearEveryMonthEmployment: true,
              priorYearGrossIncomeAmount: 60000.01
            }
          }),
          '2026-01'
        ),
        false,
        'employees above the prior-year 60000 threshold must not use the simplified method'
      );
    }
  },
  {
    name: 'requires retained evidence before first-employment cumulative deduction enters payroll',
    run: () => {
      const incompleteProfile = createPersonalIncomeTaxProfile({
        employmentScenario: '本年首次就业',
        firstEmploymentMonth: '2026-06'
      });
      const completeProfile = createPersonalIncomeTaxProfile({
        employmentScenario: '本年首次就业',
        firstEmploymentEvidenceFiles: [
          {
            id: 'first-employment-evidence-001',
            name: '首次就业承诺及佐证.pdf',
            status: '已上传',
            type: '首次就业佐证',
            updatedAt: '2026-06-01'
          }
        ],
        firstEmploymentMonth: '2026-06'
      });
      const wrongEvidenceProfile = createPersonalIncomeTaxProfile({
        employmentScenario: '本年首次就业',
        firstEmploymentEvidenceFiles: [
          {
            id: 'first-employment-wrong-evidence-001',
            name: '专项附加扣除信息表.pdf',
            status: '已上传',
            type: '扣除信息表',
            updatedAt: '2026-06-01'
          }
        ],
        firstEmploymentMonth: '2026-06'
      });

      assertEqual(isSalaryIitProfileReady(incompleteProfile, '2026-06'), false, 'first employment without retained evidence must block payroll');
      assertEqual(isSalaryIitProfileReady(wrongEvidenceProfile, '2026-06'), false, 'a deduction form must not stand in for first-employment evidence');
      assertEqual(isSalaryIitProfileReady(completeProfile, '2026-06'), true, 'first employment with month and evidence should be payroll-ready');
    }
  },
  {
    name: 'catches up late-acquired special deductions without double deducting a second payment',
    run: () => {
      const profile = createPersonalIncomeTaxProfile({
        deductionItems: [
          {
            category: '住房租金',
            effectiveFrom: '2026-01',
            id: 'deduction-rent-001',
            monthlyAmount: 1000
          }
        ]
      });
      const catchUp = getSalaryIitCurrentDeductionSummary({
        month: '2026-06',
        priorSnapshot: {
          cumulativeAdditionalDeductionAmount: 0,
          cumulativeOtherDeductionAmount: 0
        },
        profile
      });
      const secondPayment = getSalaryIitCurrentDeductionSummary({
        month: '2026-06',
        priorSnapshot: {
          cumulativeAdditionalDeductionAmount: 6000,
          cumulativeOtherDeductionAmount: 0
        },
        profile
      });

      assertEqual(catchUp.additionalDeductionAmount, 6000, 'late-acquired January deduction should catch up through June');
      assertEqual(secondPayment.additionalDeductionAmount, 0, 'a second June payment must not deduct the same cumulative amount again');
    }
  },
  {
    name: 'blocks salary payment when the current tax year profile or finance evidence is missing',
    run: () => {
      const report = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport()],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [],
        personalIncomeTaxProfiles: [createPersonalIncomeTaxProfile()],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [createWorkflow({ paidAt: undefined, paidBy: undefined, status: '已确认' })],
        socialInsuranceDeductions: [],
        socialInsuranceSourceRecords: []
      })[0];
      const missingProfile = validateSalaryPaymentConfirmation({
        evidence: {
          accountName: '测试账户',
          amount: report.netSalary,
          financeTransactionNo: 'FIN-202701-0001',
          occurredAt: '2027-01-15',
          payrollNo: report.workflow?.payrollNo ?? '',
          status: '已入账'
        },
        personalIncomeTaxCumulativeSnapshots: [],
        personalIncomeTaxProfile: undefined,
        report
      });

      assertEqual(missingProfile.allowed, false, 'a December salary paid in January must wait for the new tax-year profile');
      assertEqual(
        validateSalaryPaymentConfirmation({
          evidence: undefined,
          personalIncomeTaxCumulativeSnapshots: [],
          personalIncomeTaxProfile: createPersonalIncomeTaxProfile(),
          report
        }).allowed,
        false,
        'salary payment must not be confirmed without an actual finance transaction'
      );
    }
  },
  {
    name: 'recalculates delayed salary by the actual payment month before confirmation',
    run: () => {
      const personalIncomeTaxProfile = createPersonalIncomeTaxProfile({
        deductionItems: [
          {
            category: '住房贷款利息',
            effectiveFrom: '2026-01',
            id: 'iit-deduction-delayed-payment',
            monthlyAmount: 1000
          }
        ]
      });
      const personalIncomeTaxCumulativeSnapshots = [
        createPersonalIncomeTaxSnapshot({
          cumulativeAdditionalDeductionAmount: 5000,
          period: '2026-05'
        })
      ];
      const confirmedWorkflow = createWorkflow({
        paidAt: undefined,
        paidBy: undefined,
        status: '已确认'
      });
      const reportInput = {
        attendanceReports: [createAttendanceReport()],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots,
        personalIncomeTaxProfiles: [personalIncomeTaxProfile],
        salaryAdjustments: [] as SalaryAdjustmentRecord[],
        salaryPaymentRecords: [],
        socialInsuranceDeductions: [createSocialInsuranceDeduction({ personalAmount: 800 })],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource({ category: '社保', personalAmount: 800 }),
          createSocialInsuranceSource({ category: '公积金', id: 'housing-source-delayed', personalAmount: 0 })
        ]
      };
      const report = buildSalaryMonthlyReports({
        ...reportInput,
        salaryMonthlyWorkflows: [confirmedWorkflow]
      })[0];
      const delayedEvidence = {
        accountName: '测试账户',
        amount: report.netSalary,
        financeTransactionNo: 'FIN-SALARY-DELAYED-001',
        occurredAt: '2026-08-15',
        payrollNo: report.workflow?.payrollNo ?? '',
        status: '已入账' as const
      };
      const blockedBeforeRecalculation = validateSalaryPaymentConfirmation({
        evidence: delayedEvidence,
        personalIncomeTaxCumulativeSnapshots,
        personalIncomeTaxProfile,
        report
      });
      const recalculation = recalculateSalaryMonthlyPayment({
        paymentDate: delayedEvidence.occurredAt,
        personalIncomeTaxCumulativeSnapshots,
        personalIncomeTaxProfile,
        report
      });

      assertEqual(blockedBeforeRecalculation.allowed, false, 'a delayed salary must not use the original planned tax month');
      assertEqual(recalculation.success, true, 'a confirmed salary should support recalculation by actual payment date');

      if (!recalculation.success) {
        return;
      }

      const recalculatedReport = buildSalaryMonthlyReports({
        ...reportInput,
        salaryMonthlyWorkflows: [recalculation.workflow],
      })[0];
      const validationAfterRecalculation = validateSalaryPaymentConfirmation({
        evidence: {
          ...delayedEvidence,
          amount: recalculation.settlementSnapshot.employeeNetPayableAmount
        },
        personalIncomeTaxCumulativeSnapshots,
        personalIncomeTaxProfile,
        report: recalculatedReport
      });

      assertEqual(recalculation.personalIncomeTaxPeriod, '2026-08', 'actual August payment must belong to August IIT');
      assertEqual(
        recalculatedReport.settlementSnapshot.employeeNetPayableAmount,
        recalculation.settlementSnapshot.employeeNetPayableAmount,
        'recalculated settlement must become the frozen payable amount'
      );
      assertEqual(validationAfterRecalculation.allowed, true, 'the recalculated actual payment should be confirmable');
    }
  },
  {
    name: 'requires both personnel reporting and deduction acquisition before salary calculation',
    run: () => {
      assertEqual(
        isSalaryIitProfileReady(createPersonalIncomeTaxProfile({ personnelReportingStatus: '待报送' }), '2026-06'),
        false,
        'unreported employees must not enter payroll withholding'
      );
      assertEqual(
        isSalaryIitProfileReady(createPersonalIncomeTaxProfile({ acquisitionStatus: '待获取' }), '2026-06'),
        false,
        'missing deduction acquisition must block payroll withholding even when the amount may be zero'
      );
      assertEqual(
        isSalaryIitProfileReady(createPersonalIncomeTaxProfile({ deductionItems: [] }), '2026-06'),
        true,
        'a successfully acquired zero-deduction result must be salary-ready'
      );
    }
  },
  {
    name: 'deducts attendance reduction before calculating taxable salary income',
    run: () => {
      const report = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport({ payrollDeductionHours: 8 })],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        personalIncomeTaxProfiles: [createPersonalIncomeTaxProfile()],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [createSocialInsuranceDeduction()],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource(),
          createSocialInsuranceSource({ category: '公积金', id: 'housing-source-001', personalAmount: 0 })
        ]
      })[0];

      assertEqual(
        report.taxableSalaryIncomeAmount,
        report.grossSalary - report.attendanceDeductionAmount,
        'attendance deduction should reduce taxable salary before IIT calculation'
      );
      assertEqual(report.personalIncomeTaxRecords[0]?.currentIncomeAmount, report.taxableSalaryIncomeAmount, 'IIT should consume taxable salary income');
    }
  },
  {
    name: 'preserves actual cumulative withheld tax when recalculated tax decreases',
    run: () => {
      const priorSnapshot = createPersonalIncomeTaxSnapshot({ cumulativeWithheldTaxAmount: 2000 });
      const reports = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport()],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [priorSnapshot],
        personalIncomeTaxProfiles: [
          createPersonalIncomeTaxProfile({
            deductionItems: [
              {
                category: '赡养老人',
                effectiveFrom: '2026-01',
                id: 'deduction-high-001',
                monthlyAmount: 5000
              }
            ]
          })
        ],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [createWorkflow({ paidAt: undefined, paidBy: undefined, status: '已确认' })],
        socialInsuranceDeductions: [createSocialInsuranceDeduction()],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource(),
          createSocialInsuranceSource({ category: '公积金', id: 'housing-source-001', personalAmount: 0 })
        ]
      });
      const payment = createSalaryPaymentRecord({
        paidAt: '2026-06-18 11:00',
        paidBy: '测试出纳',
        personalIncomeTaxCumulativeSnapshots: [priorSnapshot],
        personalIncomeTaxProfile: createPersonalIncomeTaxProfile({
          deductionItems: [
            {
              category: '赡养老人',
              effectiveFrom: '2026-01',
              id: 'deduction-high-001',
              monthlyAmount: 5000
            }
          ]
        }),
        report: reports[0]
      });
      const snapshots = buildPersonalIncomeTaxCumulativeSnapshotsFromPayments([priorSnapshot], [payment]);
      const juneSnapshot = snapshots.find((snapshot) => snapshot.period === '2026-06');

      assertEqual(reports[0].personalIncomeTaxAmount, 0, 'current withholding should not become negative');
      assertEqual(payment.settlementSnapshot.withheldPersonalIncomeTaxAmount, 0, 'actual payment withholding should not become negative');
      assertEqual(juneSnapshot?.cumulativeWithheldTaxAmount, 2000, 'actual prior withholding should not be overwritten by a lower recalculated tax');
    }
  },
  {
    name: 'parses salary text and derives signed adjustment amounts from type',
    run: () => {
      assertEqual(parseSalaryAmount('11,000 元/月'), 11000, 'salary parser should read formatted monthly salary');
      assertEqual(parseSalaryAmount('按任务规则'), 0, 'non-fixed salary text should parse to zero');
      assertEqual(getSalaryAdjustmentDirection('补贴'), '增加', 'subsidy should increase monthly salary');
      assertEqual(getSalaryAdjustmentDirection('误发追回'), '减少', 'overpayment recovery should reduce monthly salary');
      assertEqual(getSalaryAdjustmentSignedAmount(createAdjustment({ amount: 300, type: '补贴' })), 300, 'increase adjustment should be positive');
      assertEqual(getSalaryScheduledPaymentDate('2026-06'), '2026-07-15', 'monthly salary should default to the next-month payment date');
      assertEqual(getSalaryScheduledPaymentDate('2026-12'), '2027-01-15', 'December salary payment date should roll into the next year');
      assertEqual(getSalaryAdjustmentSignedAmount(createAdjustment({ amount: 200, type: '误发追回' })), -200, 'deduction adjustment should be negative');
      assertEqual(getSalaryAdjustmentSignedAmount(createAdjustment({ status: '已作废', amount: 200 })), 0, 'void adjustment should not affect salary');
    }
  },
  {
    name: 'builds monthly salary from performance, attendance and salary adjustments',
    run: () => {
      const report = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport()],
        performanceRecords: [
          createPerformanceRecord({ employeeName: '绩效源姓名与档案不同' }),
          createPerformanceRecord({
            employeeName: '测试人员',
            id: 'performance-wrong-work-no',
            prepayAmount: 900,
            workNo: '20269999'
          })
        ],
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        salaryAdjustments: [createAdjustment({ amount: 500 })],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [createSocialInsuranceDeduction({ personalAmount: 800 })],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource({ category: '社保', personalAmount: 800 }),
          createSocialInsuranceSource({
            category: '公积金',
            id: 'housing-source-001',
            personalAmount: 0
          })
        ]
      })[0];

      assertEqual(report.monthlyBaseSalaryAmount, 11000, 'monthly base salary should come from personnel salary profile');
      assertEqual(report.baseSalaryAmount, 11000, 'full-month active member should keep full monthly base salary');
      assertEqual(report.baseSalaryPayableHours, 174, 'full-month base salary should use statutory monthly payroll hours');
      assertEqual(report.attendanceDeductionAmount, 505.75, 'eight leave hours should deduct by monthly salary divided by 174 hours');
      assertEqual(report.performanceRecords.length, 1, 'salary should associate performance only by the personnel work number');
      assertEqual(report.performancePayAmount, 600, 'performance prepay should be included in monthly salary');
      assertEqual(report.performanceTotalAmount, 1200, 'performance total should remain visible as source amount');
      assertEqual(report.salaryAdjustmentAmount, 500, 'salary adjustment should be included in monthly salary');
      assertEqual(report.salaryAdjustmentIncreaseAmount, 500, 'salary adjustment increases should be retained separately');
      assertEqual(report.salaryAdjustmentDeductionAmount, 0, 'salary adjustment deductions should be retained separately');
      assertEqual(report.socialInsuranceDeductionAmount, 800, 'personal social insurance should be deducted from net salary');
      assertEqual(report.taxableSalaryIncomeAmount, 11594.25, 'performance prepay should enter taxable salary income');
      assertEqual(report.personalIncomeTaxAmount, 264.43, 'personal income tax should use attendance-adjusted cumulative salary income');
      assertEqual(report.grossSalary, 12100, 'gross salary should include performance prepay and positive monthly adjustment');
      assertEqual(report.deductionAmount, 1570.18, 'deduction should include hourly attendance, statutory deductions, and attendance-adjusted tax');
      assertEqual(report.netSalary, 10529.82, 'net salary should equal gross minus attendance, statutory and IIT deductions');
      assertEqual(report.salaryCompositionLines.length, 6, 'salary detail should include base, performance, attendance, adjustment, statutory, and tax lines');
      assertEqual(report.status, '待确认', 'ready sources without workflow should leave salary pending confirmation');
    }
  },
  {
    name: 'NP-19 preserves payroll calculation while splitting employee deductions and employer contributions',
    run: () => {
      const report = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport()],
        performanceRecords: [createPerformanceRecord()],
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        personalIncomeTaxProfiles: [createPersonalIncomeTaxProfile()],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [
          createSocialInsuranceDeduction({ companyAmount: 1000, personalAmount: 800 }),
          createSocialInsuranceDeduction({
            category: '公积金',
            companyAmount: 600,
            id: 'housing-deduction-np19',
            personalAmount: 400
          })
        ],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource({ category: '社保', companyAmount: 1000, personalAmount: 800 }),
          createSocialInsuranceSource({
            category: '公积金',
            companyAmount: 600,
            id: 'housing-source-np19',
            personalAmount: 400
          })
        ]
      })[0];
      const settlement = report.settlementSnapshot;

      assertEqual(settlement.employeeSocialInsuranceAmount, 800, 'employee social insurance should remain a personal deduction');
      assertEqual(settlement.employeeHousingFundAmount, 400, 'employee housing fund should remain a personal deduction');
      assertEqual(settlement.employerSocialInsuranceAmount, 1000, 'employer social insurance should be tracked separately');
      assertEqual(settlement.employerHousingFundAmount, 600, 'employer housing fund should be tracked separately');
      assertEqual(
        settlement.employeeGrossPayableAmount,
        settlement.employeeNetPayableAmount
          + settlement.withheldPersonalIncomeTaxAmount
          + settlement.employeeSocialInsuranceAmount
          + settlement.employeeHousingFundAmount,
        'employee gross payable should equal net pay plus statutory employee liabilities'
      );
      assertEqual(
        settlement.totalEmploymentCostAmount,
        settlement.employeeGrossPayableAmount + settlement.employerContributionAmount,
        'total employment cost should add employer contributions without changing employee payroll'
      );
    }
  },
  {
    name: 'NP-01 FRONTEND-CHAIN accepts a full-time task and includes its monthly performance in one taxable salary report',
    run: () => {
      const member = createMember({ position: '主案设计师' });
      const rule = performanceRulePresets[0];
      const readyTask: StoreTaskRecord = {
        ...createAcceptedPerformanceTask(),
        acceptedAt: undefined,
        files: [
          {
            id: 'task-performance-delivery-001',
            name: '测试平面方案交付.pdf',
            registeredBy: '测试人员',
            source: '业务服务器',
            stage: '交付文件',
            status: '已上传',
            type: 'PDF图纸',
            updatedAt: '2026-06-13 17:00',
            url: '/mock/tasks/task-performance-delivery-001.pdf'
          }
        ],
        status: '待验收',
        updatedAt: '2026-06-13 17:00'
      };
      const scoreItem = rule?.taskScoreItems.find((item) => item.taskConfigId === readyTask.taskConfigId);

      assert(rule && scoreItem, 'full-time acceptance fixture should match a published performance rule');
      const scoringDraft: AcceptanceScoringDraft = {
        adjustmentReason: '',
        dimensionScores: rule.qualityDimensions.map((dimension) => ({
          id: dimension.id,
          maxScore: dimension.score,
          name: dimension.name,
          score: dimension.score
        })),
        ruleId: rule.id,
        scoreItemId: scoreItem.id,
        scoreValue: scoreItem.score,
        sourceMonth: '2026-06'
      };
      const prepared = prepareTaskAcceptanceCommit({
        acceptedAt: '2026-06-13 18:00',
        performanceRuleRows: [rule],
        person: member,
        scoringDraft,
        task: readyTask
      });

      assert(prepared.success, `full-time task acceptance should succeed: ${prepared.success ? '' : prepared.message}`);
      const committedTaskState = applyTaskAcceptanceCommit(
        {
          customerTaskBillingFacts: [],
          partTimeLaborAcceptanceRows: [],
          storeTaskRows: [readyTask],
          taskPerformanceScoringRows: []
        },
        prepared.commitInput
      );
      const performanceRecords = buildTaskPerformanceMonthlySourceRecords({
        peopleRows: [member],
        performanceMonths: ['2026-06'],
        ruleRows: performanceRulePresets,
        scoringRows: committedTaskState.taskPerformanceScoringRows,
        taskRows: committedTaskState.storeTaskRows
      });
      const reports = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport({ member })],
        performanceRecords,
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [],
        socialInsuranceSourceRecords: []
      });
      const report = reports[0];

      assertEqual(performanceRecords.length, 1, 'one accepted scored task should create one monthly performance source');
      assertEqual(committedTaskState.storeTaskRows[0]?.status, '已完成', 'frontend acceptance commit should complete the task');
      assertEqual(performanceRecords[0]?.sourceLabel, '任务验收', 'salary performance should originate from task acceptance');
      assertEqual(reports.length, 1, 'monthly performance should be carried by the single employee salary report');
      assertEqual(report.performancePrepayAmount, 21.25, 'monthly performance prepay should enter salary from the accepted score');
      assertEqual(report.performanceQuarterlyAdjustmentAmount, 0, 'monthly prepay should not create a quarterly adjustment');
      assertEqual(report.performanceSettlementLines.length, 1, 'salary should consume one stable performance result');
      assertEqual(
        report.performanceSettlementLines[0]?.salarySettlementReference,
        'performance-result:task-performance:2026-06:20260001:perf-rule-space-design-2026-final:monthly-prepay:v1',
        'salary should retain the stable performance result reference'
      );
      assert(report.taxableSalaryIncomeAmount >= report.baseSalaryAmount + report.performancePrepayAmount - report.attendanceDeductionAmount, 'performance prepay should enter taxable wage income');
    }
  },
  {
    name: 'NP-02 FRONTEND-CHAIN consumes one published quarterly result in the quarter-end salary month',
    run: () => {
      const member = createMember({ position: '主案设计师' });
      const sourceRecord = buildTaskPerformanceMonthlySourceRecords({
        peopleRows: [member],
        performanceMonths: ['2026-04'],
        ruleRows: performanceRulePresets.map((rule) =>
          rule.id === 'perf-rule-space-design-2026-final'
            ? { ...rule, effectiveStartAt: '2026-04-01' }
            : rule
        ),
        scoringRows: [
          createAcceptedPerformanceScoring({
            confirmedAt: '2026-04-18 18:00',
            sourceMonth: '2026-04'
          })
        ],
        taskRows: [
          createAcceptedPerformanceTask({
            acceptedAt: '2026-04-18 18:00',
            createdAt: '2026-04-15 09:00',
            plannedDeliveryAt: '2026-04-18 18:00',
            submittedAt: '2026-04-18 17:00',
            updatedAt: '2026-04-18 18:00'
          })
        ]
      })[0];

      assert(sourceRecord, 'accepted April task should create a performance source');
      const quarterSourceRecords = [
        sourceRecord,
        {
          ...sourceRecord,
          id: `${sourceRecord.id}-may`,
          performanceMonth: '2026-05',
          salarySettlementReference: `${sourceRecord.salarySettlementReference}-may`
        },
        {
          ...sourceRecord,
          id: `${sourceRecord.id}-june`,
          performanceMonth: '2026-06',
          salarySettlementReference: `${sourceRecord.salarySettlementReference}-june`
        }
      ];
      const reviewedRecords = attachQuarterlySalaryConsumerFixture({
        confirmedAt: '2026-06-30 18:00',
        finalAmount: 1500,
        records: quarterSourceRecords,
        resultKey: 'quarterly:20260001:2026-Q2:绘图任务制'
      });
      const reviewedRecord = reviewedRecords[0];
      assert(reviewedRecord?.quarterlyReviewResult, 'published quarter result should reach the salary consumer fixture');
      assertEqual(reviewedRecord.quarterlyReviewResult.sourceMonths.length, 3, 'quarterly result should freeze all three source months');

      const report = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport({ member })],
        performanceRecords: reviewedRecords,
        personalIncomeTaxCumulativeSnapshots: [],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [],
        socialInsuranceSourceRecords: []
      })[0];

      assertEqual(report.month, '2026-06', 'the salary report should use the quarter-end salary month');
      assertEqual(report.performancePrepayAmount, sourceRecord.prepayAmount, 'only June monthly prepay should enter June salary once');
      assertEqual(
        report.performanceQuarterlyAdjustmentAmount,
        Math.round((1500 - sourceRecord.prepayAmount * 3) * 100) / 100,
        'quarterly difference should use the frozen three-month prepay total'
      );
      assertEqual(
        report.performanceSettlementLines.filter((line) => line.kind === '季度复核差额').length,
        1,
        'one quarterly fact should create exactly one salary difference component'
      );
      assertEqual(
        report.performanceSettlementLines[0]?.salarySettlementReference,
        reviewedRecord.quarterlyReviewResult.salarySettlementReference,
        'quarterly salary should retain the committed review result reference'
      );
      const settlementRows = getSalaryPerformanceSettlementRows(report);
      const quarterlySettlementRow = settlementRows.find((row) => row.kind === '季度复核差额');
      assertEqual(quarterlySettlementRow?.performancePeriod, '2026-Q2', 'salary detail should show the actual quarterly performance period');
      assertEqual(
        quarterlySettlementRow?.amount,
        report.performanceQuarterlyAdjustmentAmount,
        'salary detail should show the quarter difference actually carried by the salary batch'
      );
    }
  },
  {
    name: 'NP-03 FRONTEND-CHAIN defers published post-payment performance differences without changing original salary',
    run: () => {
      const member = createMember({ position: '主案设计师' });
      const firstSource = buildTaskPerformanceMonthlySourceRecords({
        peopleRows: [member],
        performanceMonths: ['2026-06'],
        ruleRows: performanceRulePresets,
        scoringRows: [createAcceptedPerformanceScoring()],
        taskRows: [createAcceptedPerformanceTask()]
      })[0];
      assert(firstSource, 'accepted task should create a performance source');
      const secondSource = {
        ...firstSource,
        ruleApplicability: firstSource.ruleApplicability
          ? {
              ...firstSource.ruleApplicability,
              ruleId: `${firstSource.ruleApplicability.ruleId ?? 'performance-rule'}-second`,
              ruleName: `${firstSource.ruleApplicability.ruleName} 补充规则`
            }
          : undefined,
        id: `${firstSource.id}-second`,
        ruleName: `${firstSource.ruleName} 补充规则`,
        salarySettlementReference: `${firstSource.salarySettlementReference}-second`
      };
      const reviewedRecords = [
        ...attachQuarterlySalaryConsumerFixture({
          confirmedAt: '2026-06-30 18:00',
          finalAmount: 1500,
          records: [firstSource],
          resultKey: 'quarterly:20260001:2026-Q2:绘图任务制'
        }),
        ...attachQuarterlySalaryConsumerFixture({
          confirmedAt: '2026-06-30 18:05',
          finalAmount: 0,
          records: [secondSource],
          resultKey: 'quarterly:20260001:2026-Q2:绘图任务制-补充'
        })
      ];
      const quarterlyReference = reviewedRecords[0]?.quarterlyReviewResult?.salarySettlementReference ?? '';
      const negativeQuarterlyReference = reviewedRecords[1]?.quarterlyReviewResult?.salarySettlementReference ?? '';
      const monthlyReference = firstSource.salarySettlementReference;
      const negativeMonthlyReference = secondSource.salarySettlementReference;
      const reports = buildSalaryMonthlyReports({
        attendanceReports: [
          createAttendanceReport({ member }),
          createAttendanceReport({ id: '2026-07-20260001', member, month: '2026-07' })
        ],
        performanceRecords: reviewedRecords,
        personalIncomeTaxCumulativeSnapshots: [],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [
          createWorkflow({ salarySettlementReferences: [monthlyReference, negativeMonthlyReference] })
        ],
        socialInsuranceDeductions: [],
        socialInsuranceSourceRecords: []
      });
      const juneReport = reports.find((report) => report.month === '2026-06');
      const julyReport = reports.find((report) => report.month === '2026-07');
      const deferredAdjustment = julyReport?.salaryAdjustmentRecords.find(
        (record) => record.salarySettlementReference === quarterlyReference
      );
      const deferredRecovery = julyReport?.salaryAdjustmentRecords.find(
        (record) => record.salarySettlementReference === negativeQuarterlyReference
      );

      assert(juneReport, 'the already-paid June salary should remain available');
      assert(julyReport, 'the next unpaid July salary should receive the difference');
      assertEqual(
        juneReport.performancePayAmount,
        Math.round((firstSource.prepayAmount + secondSource.prepayAmount) * 100) / 100,
        'the already-paid salary should retain only its original prepays'
      );
      assertEqual(juneReport.performanceQuarterlyAdjustmentAmount, 0, 'the original salary should not be rewritten with the later review difference');
      assertEqual(
        deferredAdjustment?.amount,
        Math.round((1500 - firstSource.prepayAmount) * 100) / 100,
        'the later salary adjustment should contain the committed review difference'
      );
      assertEqual(deferredAdjustment?.type, '补发', 'a positive review difference should become a performance supplement');
      assertEqual(deferredAdjustment?.month, '2026-07', 'the adjustment should enter the next unpaid salary month');
      assertEqual(deferredRecovery?.amount, secondSource.prepayAmount, 'a negative review difference should retain its absolute adjustment amount');
      assertEqual(deferredRecovery?.type, '误发追回', 'a negative review difference should become a performance recovery');
      assertEqual(deferredRecovery?.month, '2026-07', 'the recovery should enter the next unpaid salary month');
      const deferredSettlementRows = getSalaryPerformanceSettlementRows(julyReport);
      assert(
        deferredSettlementRows.every((row) => row.note.includes('原薪酬已确认转入本月')),
        'salary detail should explain why every deferred performance difference entered the current salary month'
      );
    }
  },
  {
    name: 'NP-18 FRONTEND-CHAIN blocks one quarterly result from entering two salary batches',
    run: () => {
      const performanceRecords = buildTaskPerformanceMonthlySourceRecords({
        peopleRows: [createMember({ position: '主案设计师' })],
        performanceMonths: ['2026-06'],
        ruleRows: performanceRulePresets,
        scoringRows: [createAcceptedPerformanceScoring()],
        taskRows: [createAcceptedPerformanceTask()]
      });
      const sourceRecord = performanceRecords[0];
      assert(sourceRecord, 'accepted task should create a performance result');
      const reference = buildPerformanceSalarySettlementReference(
        'quarterly:20260001:2026-Q2:绘图任务制',
        'quarterly-difference',
        'v1'
      );
      const validation = validateSalaryPerformanceSettlementClaim({
        memberId: '20260001',
        month: '2026-07',
        salaryMonthlyWorkflows: [
          createWorkflow({
            month: '2026-06',
            salarySettlementReferences: [reference]
          })
        ],
        salarySettlementReferences: [reference]
      });

      assertEqual(validation.allowed, false, 'the second salary batch should be rejected by the unique performance claim');
      assert(!validation.allowed && validation.conflictingReference === reference, 'the conflict should identify the stable performance result reference');

      const confirmedWorkflow = createConfirmedSalaryMonthlyWorkflow({
        confirmedAt: '2026-06-30 10:00',
        confirmedBy: '测试确认人',
        memberId: '20260001',
        month: '2026-06',
        note: '确认',
        salaryCompositionLines: [],
        salarySettlementReferences: [reference],
        settlementSnapshot: createSalarySettlementSnapshot(),
        settlementSourceRecords: []
      });
      const paidWorkflow = createPaidSalaryMonthlyWorkflow({
        existingWorkflow: confirmedWorkflow,
        financeTransactionNo: 'FIN-SALARY-TEST-001',
        memberId: '20260001',
        month: '2026-06',
        note: '已发放',
        paidAt: '2026-07-15 11:00',
        paidBy: '测试付款人'
      });
      assertEqual(paidWorkflow.salarySettlementReferences?.[0], reference, 'paying salary must preserve the immutable performance claim');
      assertEqual(
        paidWorkflow.paymentLifecycleRecords?.[0]?.financeTransactionNo,
        'FIN-SALARY-TEST-001',
        'paying salary must retain the linked finance transaction in the salary lifecycle'
      );
    }
  },
  {
    name: 'creates a stable payroll number at confirmation and matches a payment candidate',
    run: () => {
      const reportInput = {
        attendanceReports: [createAttendanceReport()],
        performanceRecords: [createPerformanceRecord()],
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        personalIncomeTaxProfiles: [createPersonalIncomeTaxProfile()],
        salaryAdjustments: [] as SalaryAdjustmentRecord[],
        salaryPaymentRecords: [],
        socialInsuranceDeductions: [createSocialInsuranceDeduction({ personalAmount: 800 })],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource({ category: '社保', personalAmount: 800 }),
          createSocialInsuranceSource({ category: '公积金', id: 'housing-source-confirmed', personalAmount: 0 })
        ]
      };
      const draftReport = buildSalaryMonthlyReports({
        ...reportInput,
        salaryMonthlyWorkflows: []
      })[0];
      const confirmedWorkflow = createConfirmedSalaryMonthlyWorkflow({
        confirmedAt: '2026-06-18 10:30',
        confirmedBy: '测试确认人',
        memberId: '20260001',
        month: '2026-06',
        note: '薪酬明细已确认',
        salaryCompositionLines: draftReport.salaryCompositionLines,
        settlementSnapshot: draftReport.settlementSnapshot,
        settlementSourceRecords: draftReport.settlementSourceRecords
      });
      const reconfirmedWorkflow = createConfirmedSalaryMonthlyWorkflow({
        confirmedAt: '2026-06-18 10:35',
        confirmedBy: '测试确认人',
        existingWorkflow: confirmedWorkflow,
        memberId: '20260001',
        month: '2026-06',
        note: '薪酬明细重新确认',
        salaryCompositionLines: draftReport.salaryCompositionLines,
        settlementSnapshot: draftReport.settlementSnapshot,
        settlementSourceRecords: draftReport.settlementSourceRecords
      });
      const repairedWorkflow = createConfirmedSalaryMonthlyWorkflow({
        confirmedAt: '2026-06-18 10:40',
        confirmedBy: '测试确认人',
        existingWorkflow: { ...confirmedWorkflow, payrollNo: '' },
        memberId: '20260001',
        month: '2026-06',
        note: '修复历史空单号后重新确认',
        salaryCompositionLines: draftReport.salaryCompositionLines,
        settlementSnapshot: draftReport.settlementSnapshot,
        settlementSourceRecords: draftReport.settlementSourceRecords
      });
      const report = buildSalaryMonthlyReports({
        ...reportInput,
        salaryMonthlyWorkflows: [confirmedWorkflow]
      })[0];
      const frozenReportAfterSourceDrift = buildSalaryMonthlyReports({
        ...reportInput,
        attendanceReports: [createAttendanceReport({ leaveDays: 3, leaveHours: 24 })],
        salaryMonthlyWorkflows: [confirmedWorkflow],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource({
            category: '社保',
            handlingStatus: '待确认',
            personalAmount: 999,
            reason: '当前源项发生变化'
          }),
          createSocialInsuranceSource({
            category: '公积金',
            handlingStatus: '待确认',
            id: 'housing-source-drift',
            personalAmount: 999,
            reason: '当前源项发生变化'
          })
        ]
      })[0];
      const evidence = {
        accountName: '工资付款户',
        amount: report.netSalary,
        financeTransactionNo: 'FIN-SALARY-202606-20260001',
        occurredAt: '2026-07-15',
        payrollNo: confirmedWorkflow.payrollNo ?? '',
        status: '已入账' as const
      };
      const paymentCandidates = [evidence].filter(
        (candidate) =>
          candidate.payrollNo === report.workflow?.payrollNo &&
          Math.abs(candidate.amount - report.netSalary) < 0.01
      );
      const validation = validateSalaryPaymentConfirmation({
        evidence: paymentCandidates[0],
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        personalIncomeTaxProfile: createPersonalIncomeTaxProfile(),
        report
      });
      const payment = createSalaryPaymentRecord({
        paymentEvidence: {
          accountName: evidence.accountName,
          financeTransactionNo: evidence.financeTransactionNo,
          status: '已核验'
        },
        paidAt: '2026-07-15 11:00',
        paidBy: '测试出纳',
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        personalIncomeTaxProfile: createPersonalIncomeTaxProfile(),
        report
      });

      assertEqual(confirmedWorkflow.payrollNo, buildSalaryPayrollNo('2026-06', '20260001'), 'confirmation should assign the stable payroll number');
      assertEqual(reconfirmedWorkflow.payrollNo, confirmedWorkflow.payrollNo, 'reconfirmation should preserve the payroll number');
      assertEqual(repairedWorkflow.payrollNo, confirmedWorkflow.payrollNo, 'reconfirmation should repair an empty historical payroll number');
      assertEqual(
        getSalaryPayslipStatus({ ...draftReport, status: '结算中', workflow: undefined }),
        '暂不可查看',
        'processing salary should not expose a payslip'
      );
      assertEqual(
        getSalaryPayslipNo({ ...draftReport, status: '结算中', workflow: undefined }),
        '-',
        'processing salary should not have a payslip number'
      );
      assertEqual(getSalaryPayslipStatus(draftReport), '预览', 'source-ready salary should expose preview status');
      assertEqual(getSalaryPayslipNo(draftReport), '预览未编号', 'salary preview should not invent a formal payslip number');
      assertEqual(getSalaryPayslipStatus(report), '待发放', 'confirmed salary should expose pending-payment status');
      assertEqual(getSalaryPayslipNo(report), confirmedWorkflow.payrollNo, 'formal payslip should use the workflow payroll number');
      assertEqual(getSalaryPayslipStatus({ ...report, status: '已发放' }), '已发放', 'paid salary should expose paid status');
      assertEqual(
        getSalaryPayslipNo({ ...report, status: '已发放' }),
        confirmedWorkflow.payrollNo,
        'paid payslip should preserve the confirmed payroll number'
      );
      assertEqual(report.status, '已确认', 'confirmed workflow should make the salary report payable');
      assertEqual(report.canPay, true, 'confirmed salary should expose the payment action');
      assertEqual(frozenReportAfterSourceDrift.status, '已确认', 'confirmed salary must not fall back to processing when current source data drifts');
      assertEqual(frozenReportAfterSourceDrift.settlementPendingSourceLabels.length, 0, 'confirmed salary should not expose current source blockers');
      assertEqual(
        JSON.stringify(frozenReportAfterSourceDrift.salaryCompositionLines),
        JSON.stringify(draftReport.salaryCompositionLines),
        'confirmed salary should retain the frozen salary composition'
      );
      assertEqual(
        JSON.stringify(frozenReportAfterSourceDrift.settlementSourceRecords),
        JSON.stringify(draftReport.settlementSourceRecords),
        'confirmed salary should retain the frozen settlement sources'
      );
      assertEqual(paymentCandidates.length, 1, 'confirmed payroll number should match the posted salary payment candidate');
      assertEqual(validation.allowed, true, 'matched payment candidate should pass salary payment validation');
      assertEqual(payment.payrollNo, confirmedWorkflow.payrollNo, 'payment record should retain the confirmed payroll number');
      assertEqual(
        payment.settlementSnapshot.grossEarningsAmount,
        report.grossSalary,
        'payment record should include performance through monthly gross salary'
      );
      assertEqual(
        payment.personalIncomeTaxRecord?.currentIncomeAmount,
        report.taxableSalaryIncomeAmount,
        'payment withholding should use taxable salary income that already includes performance'
      );
    }
  },
  {
    name: 'keeps tax-exempt salary adjustments out of taxable wage income',
    run: () => {
      const sharedInput = {
        attendanceReports: [createAttendanceReport()],
        performanceRecords: [] as SalaryPerformanceSourceRecord[],
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        salaryMonthlyWorkflows: [] as SalaryMonthlyWorkflowRecord[],
        socialInsuranceDeductions: [createSocialInsuranceDeduction({ personalAmount: 800 })],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource({ category: '社保', personalAmount: 800 }),
          createSocialInsuranceSource({ category: '公积金', id: 'housing-source-001', personalAmount: 0 })
        ]
      };
      const taxableReport = buildSalaryMonthlyReports({
        ...sharedInput,
        salaryAdjustments: [createAdjustment({ amount: 500, taxTreatment: '税前计税' })]
      })[0];
      const taxExemptReport = buildSalaryMonthlyReports({
        ...sharedInput,
        salaryAdjustments: [createAdjustment({ amount: 500, taxTreatment: '税前免税' })]
      })[0];

      assertEqual(taxableReport.grossSalary, taxExemptReport.grossSalary, 'tax treatment should not change gross payment amount');
      assertEqual(
        taxableReport.taxableSalaryIncomeAmount - taxExemptReport.taxableSalaryIncomeAmount,
        500,
        'tax-exempt adjustment should be excluded from taxable wage income'
      );
      assert(
        taxableReport.personalIncomeTaxAmount > taxExemptReport.personalIncomeTaxAmount,
        'taxable adjustment should produce more withholding than the same tax-exempt adjustment'
      );
    }
  },
  {
    name: 'deducts leave by hours with fixed monthly payroll hours',
    run: () => {
      const report = buildSalaryMonthlyReports({
        attendanceReports: [
          createAttendanceReport({
            leaveDays: 0.63,
            leaveHours: 5,
            payableAttendanceDays: 21.38,
            payableAttendanceHours: 171,
            payrollDeductionDays: 0.63,
            payrollDeductionHours: 5
          })
        ],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [],
        socialInsuranceSourceRecords: []
      })[0];

      assertEqual(report.attendanceDeductionAmount, 316.09, 'five leave hours should deduct monthly salary divided by 174 hours');
      assertEqual(report.deductionAmount, 316.09, 'hourly leave deduction should enter total deductions');
      assertEqual(report.netSalary, 10683.91, 'net salary should reflect hourly leave deduction');
    }
  },
  {
    name: 'deducts uncovered compensatory rest by payroll deduction entries',
    run: () => {
      const report = buildSalaryMonthlyReports({
        attendanceReports: [
          createAttendanceReport({
            leaveDays: 0,
            leaveHours: 0,
            payableAttendanceDays: 21,
            payableAttendanceHours: 168,
            payrollDeductionDays: 1,
            payrollDeductionEntries: [{
              dateText: '2026-06-10',
              hours: 8,
              recordId: 'uncovered-rest',
              type: '调休超额'
            }],
            payrollDeductionHours: 8,
            restDays: 1,
            restHours: 8,
            restUncoveredDays: 1,
            restUncoveredHours: 8
          })
        ],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [],
        socialInsuranceSourceRecords: []
      })[0];

      assertEqual(report.attendanceDeductionAmount, 505.75, 'uncovered compensatory rest should deduct by hourly salary');
      assertEqual(report.netSalary, 10494.25, 'net salary should reflect uncovered compensatory rest deduction');
    }
  },
  {
    name: 'prorates base salary for entry month by expected work hours',
    run: () => {
      const member = createMember({ joinedAt: '2026-06-17' });
      const report = buildSalaryMonthlyReports({
        attendanceReports: [
          createAttendanceReport({
            expectedWorkdays: 10,
            expectedWorkHours: 80,
            leaveDays: 0,
            leaveHours: 0,
            member,
            payableAttendanceDays: 10,
            payableAttendanceHours: 80,
            payrollDeductionDays: 0,
            payrollDeductionHours: 0
          })
        ],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [],
        socialInsuranceSourceRecords: []
      })[0];

      assertEqual(report.monthlyBaseSalaryAmount, 11000, 'original monthly salary should remain visible');
      assertEqual(report.baseSalaryPayableHours, 80, 'entry-month base salary should use post-entry expected work hours');
      assertEqual(report.baseSalaryAmount, 5057.47, 'entry-month base salary should be prorated by 174 monthly payroll hours');
      assertEqual(report.grossSalary, 5057.47, 'gross salary should use prorated base salary when no other earnings exist');
    }
  },
  {
    name: 'uses regular salary after probation end even before personnel status changes',
    run: () => {
      const member = createMember({
        probationEndAt: '2026-06-30',
        salaryProfile: {
          effectiveAt: '2026-01-01',
          note: '',
          payCycle: '月度',
          probationSalary: '8000 元/月',
          regularSalary: '10000 元/月',
          status: '已配置',
          structure: '固定月薪'
        },
        status: '试用期'
      });
      const report = buildSalaryMonthlyReports({
        attendanceReports: [
          createAttendanceReport({
            expectedWorkdayDates: createWorkdayDates('2026-07'),
            expectedWorkdays: 23,
            expectedWorkHours: 184,
            leaveDays: 0,
            leaveHours: 0,
            member,
            month: '2026-07',
            payableAttendanceDays: 23,
            payableAttendanceHours: 184,
            payrollDeductionDays: 0,
            payrollDeductionHours: 0
          })
        ],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [],
        socialInsuranceSourceRecords: []
      })[0];

      assertEqual(report.baseSalaryText, '10000 元/月', 'post-probation salary month should use regular salary by date');
      assertEqual(report.monthlyBaseSalaryAmount, 10000, 'regular salary should be the monthly base after probation end');
      assertEqual(report.baseSalaryAmount, 10000, 'full post-probation month should not remain on probation salary');
    }
  },
  {
    name: 'splits base salary when regularization takes effect inside the salary month',
    run: () => {
      const member = createMember({
        probationEndAt: '2026-06-15',
        salaryProfile: {
          effectiveAt: '2026-01-01',
          note: '',
          payCycle: '月度',
          probationSalary: '8000 元/月',
          regularSalary: '10000 元/月',
          status: '已配置',
          structure: '固定月薪'
        },
        status: '在职'
      });
      const report = buildSalaryMonthlyReports({
        attendanceReports: [
          createAttendanceReport({
            leaveDays: 0,
            leaveHours: 0,
            member,
            payrollDeductionDays: 0,
            payrollDeductionHours: 0
          })
        ],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [],
        socialInsuranceSourceRecords: []
      })[0];

      assertEqual(report.baseSalaryText, '试用 8000 元/月 / 正式 10000 元/月', 'regularization month should expose salary phases');
      assertEqual(report.baseSalaryPayableHours, 174, 'full regularization month should still use fixed monthly payroll hours');
      assertEqual(report.baseSalaryAmount, 9090.91, 'base salary should split probation and regular salary by expected workday ratio');
      assertEqual(report.monthlyBaseSalaryAmount, 9090.91, 'monthly equivalent should follow the split salary rate');
    }
  },
  {
    name: 'uses leave date salary rate inside regularization month',
    run: () => {
      const member = createMember({
        probationEndAt: '2026-06-15',
        salaryProfile: {
          effectiveAt: '2026-01-01',
          note: '',
          payCycle: '月度',
          probationSalary: '8000 元/月',
          regularSalary: '10000 元/月',
          status: '已配置',
          structure: '固定月薪'
        },
        status: '在职'
      });
      const report = buildSalaryMonthlyReports({
        attendanceReports: [
          createAttendanceReport({
            leaveDays: 1,
            leaveHours: 8,
            member,
            payableAttendanceDays: 21,
            payableAttendanceHours: 168,
            payrollDeductionEntries: [{
              dateText: '2026-06-10',
              hours: 8,
              recordId: 'attendance-leave-001',
              type: '请假'
            }],
            payrollDeductionDays: 1,
            payrollDeductionHours: 8,
            relatedExceptions: [createAttendanceExceptionRecord({ memberId: member.id, startAt: '2026-06-10 10:00', endAt: '2026-06-10 18:00' })]
          })
        ],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [],
        socialInsuranceSourceRecords: []
      })[0];

      assertEqual(report.baseSalaryAmount, 9090.91, 'regularization base salary should still use split salary amount');
      assertEqual(report.attendanceDeductionAmount, 367.82, 'leave before regularization should deduct by probation hourly salary');
      assertEqual(report.netSalary, 8723.09, 'net salary should reflect date-scoped leave deduction');
    }
  },
  {
    name: 'marks monthly salary as processing until statutory deduction sources are confirmed',
    run: () => {
      const report = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport()],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource({
            category: '社保',
            handlingStatus: '待确认',
            personalAmount: 800,
            reason: '社保待确认'
          }),
          createSocialInsuranceSource({
            category: '公积金',
            handlingStatus: '待确认',
            id: 'housing-source-001',
            personalAmount: 800,
            reason: '公积金待确认'
          })
        ]
      })[0];

      assertEqual(report.status, '结算中', 'pending statutory sources should keep monthly salary processing');
      assertEqual(report.canConfirm, false, 'processing monthly salary should not be confirmable');
      assertEqual(report.settlementPendingSourceLabels.includes('社保'), true, 'social insurance should be a pending source');
      assertEqual(report.settlementPendingSourceLabels.includes('公积金'), true, 'housing fund should be a pending source');
      assertEqual(report.settlementPendingSourceLabels.includes('个税'), false, 'personal income tax should be derived after salary sources are ready');
      assertEqual(report.personalIncomeTaxAmount, 0, 'processing salary should not expose a premature tax deduction');
    }
  },
  {
    name: 'rolls paid salary tax result into the next payment-period cumulative withholding snapshot',
    run: () => {
      const juneReports = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport()],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [createWorkflow({ paidAt: undefined, status: '已确认' })],
        socialInsuranceDeductions: [createSocialInsuranceDeduction({ personalAmount: 800 })],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource({ category: '社保', personalAmount: 800 }),
          createSocialInsuranceSource({
            category: '公积金',
            id: 'housing-source-001',
            personalAmount: 0
          })
        ]
      });
      const payment = createSalaryPaymentRecord({
        paidAt: '2026-06-18 11:00',
        paidBy: '测试出纳',
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        personalIncomeTaxProfile: createPersonalIncomeTaxProfile(),
        report: juneReports[0]
      });
      const rollingSnapshots = buildPersonalIncomeTaxCumulativeSnapshotsFromPayments(
        [createPersonalIncomeTaxSnapshot()],
        [payment]
      );
      const julyReport = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport({ id: '2026-07-20260001', month: '2026-07' })],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: rollingSnapshots,
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [createSocialInsuranceDeduction({ payrollMonth: '2026-07', personalAmount: 800 })],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource({ category: '社保', period: '2026-07', personalAmount: 800 }),
          createSocialInsuranceSource({
            category: '公积金',
            id: 'housing-source-2026-07',
            period: '2026-07',
            personalAmount: 0
          })
        ]
      })[0];
      const julyTaxRecord = julyReport.personalIncomeTaxRecords[0];

      assertEqual(juneReports[0].status, '已确认', 'salary confirmation should remain separate from actual payment');
      assertEqual(payment.taxPeriod, '2026-06', 'withholding period should follow the actual payment date');
      assertEqual(
        payment.settlementSnapshot.withheldPersonalIncomeTaxAmount,
        154.43,
        'payment should freeze the withholding recalculated for its actual payment period'
      );
      assertEqual(julyTaxRecord?.priorCumulativePeriod, '2026-06', 'July tax should use the June payment snapshot');
      assertEqual(julyTaxRecord?.priorWithheldTaxAmount, 1099.43, 'July tax should carry forward actual June payment withholding');
      assertEqual(julyReport.personalIncomeTaxAmount, 469.42, 'July tax should be calculated by cumulative withholding instead of a standalone monthly formula');
    }
  },
  {
    name: 'treats deferred or skipped social-insurance decisions as handled without current deduction',
    run: () => {
      const report = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport()],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource({
            category: '社保',
            handlingStatus: '延期补缴',
            personalAmount: 800,
            reason: '账户信息待核对'
          }),
          createSocialInsuranceSource({
            category: '公积金',
            handlingStatus: '本月不缴',
            id: 'housing-source-001',
            personalAmount: 800,
            reason: '当月未缴'
          })
        ]
      })[0];
      const socialSource = report.settlementSourceRecords.find((record) => record.key === 'social-insurance');
      const housingSource = report.settlementSourceRecords.find((record) => record.key === 'housing-fund');

      assertEqual(socialSource?.status, '本月不扣', 'deferred social insurance should be treated as handled without current deduction');
      assertEqual(housingSource?.status, '本月不扣', 'skipped housing fund should be treated as handled without current deduction');
      assertEqual(report.settlementPendingSourceLabels.includes('社保'), false, 'deferred social insurance should not block salary confirmation');
      assertEqual(report.settlementPendingSourceLabels.includes('公积金'), false, 'skipped housing fund should not block salary confirmation');
      assertEqual(report.socialInsuranceDeductionAmount, 0, 'deferred or skipped records should not deduct current salary');
      assertEqual(report.status, '待确认', 'salary should be pending confirmation when all source decisions are handled');
    }
  },
  {
    name: 'does not block salary settlement or deduct housing fund when personnel policy is not applicable',
    run: () => {
      const member = createMember({
        housingFundEffectiveMonth: undefined,
        housingFundStatus: '暂不缴存'
      });
      const report = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport({ member })],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [
          createSocialInsuranceDeduction({ category: '社保', personalAmount: 800 }),
          createSocialInsuranceDeduction({
            category: '公积金',
            id: 'housing-deduction-001',
            personalAmount: 500
          })
        ],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource({ category: '社保', personalAmount: 800 }),
          createSocialInsuranceSource({
            category: '公积金',
            handlingStatus: '待确认',
            id: 'housing-source-001',
            personalAmount: 500,
            reason: '不应阻塞薪酬'
          })
        ]
      })[0];
      const housingFundSource = report.settlementSourceRecords.find((record) => record.key === 'housing-fund');

      assertEqual(housingFundSource?.status, '不适用', 'non-contributing personnel policy should mark housing fund source as not applicable');
      assertEqual(report.settlementPendingSourceLabels.includes('公积金'), false, 'not applicable housing fund should not block salary confirmation');
      assertEqual(report.socialInsuranceDeductionAmount, 800, 'not applicable housing fund deduction should be excluded from salary');
      assertEqual(report.status, '待确认', 'salary should be pending confirmation when applicable sources are confirmed');
    }
  },
  {
    name: 'does not require housing fund before the personnel effective month',
    run: () => {
      const member = createMember({
        housingFundEffectiveMonth: '2026-07',
        housingFundStatus: '缴存'
      });
      const report = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport({ member })],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: [
          createSocialInsuranceDeduction({ category: '社保', personalAmount: 800 }),
          createSocialInsuranceDeduction({
            category: '公积金',
            id: 'housing-deduction-future',
            personalAmount: 500
          })
        ],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource({ category: '社保', personalAmount: 800 })
        ]
      })[0];
      const housingFundSource = report.settlementSourceRecords.find((record) => record.key === 'housing-fund');

      assertEqual(housingFundSource?.status, '不适用', 'future effective month should mark housing fund source as not applicable for current salary month');
      assertEqual(housingFundSource?.note, '公积金 2026-07 起生效', 'future effective month should explain the current inapplicable status');
      assertEqual(report.settlementPendingSourceLabels.includes('公积金'), false, 'future effective housing fund should not block current salary confirmation');
      assertEqual(report.socialInsuranceDeductionAmount, 800, 'future effective housing fund deduction should be excluded from current salary');
      assertEqual(report.status, '待确认', 'current salary should be pending confirmation when current applicable sources are confirmed');
    }
  },
  {
    name: 'marks settled monthly salary as locked and exports attendance lock records',
    run: () => {
      const workflow = createWorkflow();
      const report = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport()],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [workflow],
        socialInsuranceDeductions: [],
        socialInsuranceSourceRecords: []
      })[0];
      const attendanceLocks = toAttendanceMonthlySalarySettlementRecords([workflow]);

      assertEqual(report.status, '已发放', 'paid workflow should mark report as paid');
      assertEqual(report.canAdjust, false, 'settled monthly salary should not allow adjustments');
      assertEqual(report.canPay, false, 'paid monthly salary should not be paid again');
      assertEqual(attendanceLocks.length, 1, 'settled salary should export one attendance lock record');
      assertEqual(attendanceLocks[0].settlementNo, 'PAY-TEST-001', 'attendance lock should use salary payroll number');
    }
  },
  {
    name: 'freezes withholding by actual salary payment period',
    run: () => {
      const report = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport()],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        personalIncomeTaxProfiles: [createPersonalIncomeTaxProfile()],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [createWorkflow({ paidAt: undefined, paidBy: undefined, status: '已确认' })],
        socialInsuranceDeductions: [],
        socialInsuranceSourceRecords: []
      })[0];
      const payment = createSalaryPaymentRecord({
        paidAt: '2026-07-15 10:30',
        paidBy: '测试出纳',
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        personalIncomeTaxProfile: createPersonalIncomeTaxProfile(),
        report
      });
      const snapshots = buildPersonalIncomeTaxCumulativeSnapshotsFromPayments([], [payment]);
      const frozenTaxAmount = payment.settlementSnapshot.withheldPersonalIncomeTaxAmount;

      report.personalIncomeTaxAmount = frozenTaxAmount + 100;

      assertEqual(payment.payrollMonth, '2026-06', 'payment should preserve the salary attribution month');
      assertEqual(payment.taxPeriod, '2026-07', 'withholding period should follow the actual payment month');
      assertEqual(
        payment.settlementSnapshot.withheldPersonalIncomeTaxAmount,
        frozenTaxAmount,
        'paid withholding snapshot must not follow later report mutations'
      );
      assertEqual(snapshots[0]?.period, '2026-07', 'cumulative withholding should advance by payment period');
    }
  },
  {
    name: 'renders salary adjustments as locked when monthly salary is settled',
    run: () => {
      const adjustment = createAdjustment();
      const workflow = createWorkflow();

      assertEqual(getSalaryAdjustmentDisplayStatus(adjustment, []), '已生效', 'open salary month should keep adjustment status');
      assertEqual(getSalaryAdjustmentDisplayStatus(adjustment, [workflow]), '已锁定', 'settled salary month should lock adjustment display');
      assert(getSalaryAdjustmentDisplayStatus(createAdjustment({ memberId: 'other' }), [workflow]) !== '已锁定', 'other member should not be locked');
    }
  },
  {
    name: 'selects salary overview months from date-scope filters',
    run: () => {
      const salaryDetailMonths = ['2026-04', '2026-06', '2026-05'];

      assertEqual(
        getSalaryOverviewReportMonths({ salaryDetailMonths, salaryTime: { mode: 'currentMonth' } }).join(','),
        '2026-06',
        'current-month scope should resolve to the salary overview default month'
      );
      assertEqual(
        getSalaryOverviewReportMonths({ salaryDetailMonths, salaryTime: { mode: 'all' } }).join(','),
        '2026-06,2026-05,2026-04',
        'all scope should keep salary detail months in descending order'
      );
      assertEqual(
        getSalaryOverviewReportMonths({
          salaryDetailMonths,
          salaryTime: {
            mode: 'range',
            range: {
              endDate: '2026-06-30',
              startDate: '2026-05-01'
            }
          }
        }).join(','),
        '2026-06,2026-05',
        'range scope should include salary detail months that overlap the selected range'
      );
    }
  },
  {
    name: 'builds salary overview board rows and employee ranking',
    run: () => {
      const memberA = createMember({ id: 'member-a', name: '人员A', position: '设计师' });
      const memberB = createMember({
        id: 'member-b',
        name: '人员B',
        position: 'CEO',
        salaryProfile: {
          effectiveAt: '2026-01-01',
          note: '',
          payCycle: '月度',
          regularSalary: '8000 元/月',
          status: '已配置',
          structure: '固定月薪'
        }
      });
      const reports = buildSalaryMonthlyReports({
        attendanceReports: [
          createAttendanceReport({ id: '2026-06-member-a', member: memberA }),
          createAttendanceReport({
            id: '2026-06-member-b',
            member: memberB,
            payableAttendanceDays: 22,
            payableAttendanceHours: 176,
            payrollDeductionDays: 0,
            payrollDeductionHours: 0
          })
        ],
        performanceRecords: [
          createPerformanceRecord({ employeeName: memberA.name, workNo: memberA.id, prepayAmount: 600 }),
          createPerformanceRecord({ employeeName: memberB.name, workNo: memberB.id, id: 'performance-b', prepayAmount: 300 })
        ],
        personalIncomeTaxCumulativeSnapshots: [],
        salaryAdjustments: [
          createAdjustment({ amount: 500, memberId: memberA.id }),
          createAdjustment({
            amount: 1200,
            id: 'salary-adjust-b',
            memberId: memberB.id,
            reason: '测试追回',
            type: '误发追回'
          })
        ],
        salaryMonthlyWorkflows: [
          createWorkflow({ memberId: memberA.id }),
          createWorkflow({
            id: 'salary-monthly-2026-06-member-b',
            memberId: memberB.id,
            paidAt: undefined,
            paidBy: undefined,
            status: '已确认'
          })
        ],
        socialInsuranceDeductions: [
          createSocialInsuranceDeduction({ employeeName: memberA.name, employeeNo: memberA.id, personalAmount: 800 }),
          createSocialInsuranceDeduction({
            employeeName: memberB.name,
            employeeNo: memberB.id,
            id: 'social-insurance-deduction-b',
            personalAmount: 600
          })
        ],
        socialInsuranceSourceRecords: [
          createSocialInsuranceSource({ category: '社保', employeeName: memberA.name, employeeNo: memberA.id, personalAmount: 800 }),
          createSocialInsuranceSource({
            category: '社保',
            employeeName: memberB.name,
            employeeNo: memberB.id,
            id: 'social-source-b',
            personalAmount: 600
          })
        ]
      });
      const overviewReports = reports.map((report) => ({
        ...report,
        status: report.member.id === memberA.id ? '已发放' as const : '已确认' as const
      }));
      const overview = buildSalaryOverview(overviewReports);
      const overviewWithEmptyDraft = buildSalaryOverview([
        ...overviewReports,
        {
          ...overviewReports[0],
          attendanceDeductionAmount: 0,
          attendanceIncreaseAmount: 0,
          baseSalaryAmount: 0,
          deductionAmount: 0,
          grossSalary: 0,
          id: '2026-06-member-empty',
          member: createMember({ id: 'member-empty', name: '待完善人员' }),
          netSalary: 0,
          performancePrepayAmount: 0,
          performanceQuarterlyAdjustmentAmount: 0,
          personalIncomeTaxAmount: 0,
          salaryAdjustmentDeductionAmount: 0,
          salaryAdjustmentIncreaseAmount: 0,
          socialInsuranceDeductionAmount: 0,
          status: '结算中'
        }
      ]);
      const baseSalaryRow = overview.boardRows.find((row) => row.id === 'base-salary');
      const adjustmentDeductionRow = overview.boardRows.find((row) => row.id === 'salary-adjustment-deduction');
      const topEmployee = overview.employeeRows[0];

      assertEqual(overview.summary.employeeCount, 2, 'salary overview should count unique employees');
      assertEqual(overview.summary.recordCount, 2, 'salary overview should count salary detail rows');
      assertEqual(
        overviewWithEmptyDraft.summary.employeeCount,
        overview.summary.employeeCount,
        'salary overview must not count a zero-amount unresolved draft as a salary employee'
      );
      assertEqual(
        overviewWithEmptyDraft.summary.recordCount,
        overview.summary.recordCount,
        'salary overview must keep zero-amount unresolved drafts in salary detail instead of statistics'
      );
      assertEqual(
        overview.summary.paidNetSalary,
        overviewReports.find((report) => report.member.id === memberA.id)?.netSalary,
        'salary overview must count only paid reports as actual disbursement'
      );
      assertEqual(
        overview.summary.pendingPaymentNetSalary,
        overviewReports.find((report) => report.member.id === memberB.id)?.netSalary,
        'salary overview must count confirmed reports as pending payment'
      );
      assert(baseSalaryRow, 'salary overview should include base salary board row');
      assertEqual(
        baseSalaryRow.totalAmount,
        reports.reduce((total, report) => total + report.baseSalaryAmount, 0),
        'base salary board row should aggregate base salary amounts'
      );
      assert(adjustmentDeductionRow, 'salary overview should include salary adjustment deduction board row');
      assertEqual(adjustmentDeductionRow.employeeCount, 1, 'deduction board rows should count only involved employees');
      assertEqual(
        topEmployee.netSalary,
        Math.max(...reports.map((report) => report.netSalary)),
        'employee salary ranking should sort by total net salary'
      );
      assertEqual(topEmployee.rank, 1, 'employee salary ranking should assign stable rank');
    }
  }
];

export function runSalaryDomainTests(): UnitTestResult {
  const failures: string[] = [];
  const passedTestNames: string[] = [];
  let passed = 0;

  for (const test of tests) {
    try {
      test.run();
      passed += 1;
      passedTestNames.push(test.name);
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    executedTestNames: tests.map((test) => test.name),
    failures,
    passed,
    passedTestNames,
    total: tests.length
  };
}

import type { AttendanceMonthlyReport } from '../people/peopleAttendanceMonthlyDomain';
import type { PeopleMember } from '../people/peopleTypes';
import type { SocialInsuranceEmployeeRecord, SocialInsurancePayrollDeductionRecord } from '../finance/financeSocialInsuranceData';
import {
  buildPersonalIncomeTaxCumulativeSnapshotsFromReports,
  buildSalaryMonthlyReports,
  getSalaryAdjustmentDirection,
  getSalaryAdjustmentDisplayStatus,
  getSalaryAdjustmentSignedAmount,
  parseSalaryAmount,
  toAttendanceMonthlySalarySettlementRecords,
  type SalaryAdjustmentRecord,
  type SalaryPerformanceSourceRecord,
  type SalaryPersonalIncomeTaxCumulativeSnapshot,
  type SalaryMonthlyWorkflowRecord
} from './salaryDomain';
import { getSalaryMonthlyAccountingPeriod } from './salaryMonthlyDisplayModel';
import {
  buildSalaryOverview,
  getSalaryOverviewReportMonths
} from './salaryOverviewModel';

type UnitTest = {
  name: string;
  run: () => void;
};

type UnitTestResult = {
  failures: string[];
  passed: number;
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
    id: 'member-001',
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
    workEvaluationRecords: [],
    workEvaluationSummary: {
      acceptedTasks: 0,
      level: 'A',
      month: '2026-06',
      reworkTasks: 0,
      score: 90
    },
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
    memberId: 'member-001',
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
    id: '2026-06-member-001',
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
    memberId: 'member-001',
    month: '2026-06',
    reason: '测试调整',
    source: '薪酬调整',
    status: '已生效',
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
    employeeNo: 'member-001',
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
    employeeNo: 'member-001',
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
    employeeNo: 'member-001',
    period: '2026-05',
    taxYear: '2026',
    updatedAt: '2026-05-31',
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
    sourceLabel: '月度绩效',
    sourceTaskCount: 10,
    updatedAt: '2026-06-18 09:00',
    workNo: 'member-001',
    ...overrides
  };
}

function createWorkflow(overrides: Partial<SalaryMonthlyWorkflowRecord> = {}): SalaryMonthlyWorkflowRecord {
  return {
    confirmedAt: '2026-06-18 10:30',
    confirmedBy: '测试确认人',
    id: 'salary-monthly-2026-06-member-001',
    memberId: 'member-001',
    month: '2026-06',
    note: '测试结算',
    payrollNo: 'PAY-TEST-001',
    settledAt: '2026-06-18 11:00',
    settledBy: '测试结算人',
    status: '已结算',
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
    name: 'parses salary text and derives signed adjustment amounts from type',
    run: () => {
      assertEqual(parseSalaryAmount('11,000 元/月'), 11000, 'salary parser should read formatted monthly salary');
      assertEqual(parseSalaryAmount('按任务规则'), 0, 'non-fixed salary text should parse to zero');
      assertEqual(getSalaryAdjustmentDirection('补贴'), '增加', 'subsidy should increase monthly salary');
      assertEqual(getSalaryAdjustmentDirection('误发追回'), '减少', 'overpayment recovery should reduce monthly salary');
      assertEqual(getSalaryAdjustmentSignedAmount(createAdjustment({ amount: 300, type: '补贴' })), 300, 'increase adjustment should be positive');
      assertEqual(getSalaryAdjustmentSignedAmount(createAdjustment({ amount: 200, type: '误发追回' })), -200, 'deduction adjustment should be negative');
      assertEqual(getSalaryAdjustmentSignedAmount(createAdjustment({ status: '已作废', amount: 200 })), 0, 'void adjustment should not affect salary');
    }
  },
  {
    name: 'builds monthly salary from attendance and salary adjustments',
    run: () => {
      const report = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport()],
        performanceRecords: [createPerformanceRecord()],
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
      assertEqual(report.performancePayAmount, 600, 'performance prepay should be included in monthly salary');
      assertEqual(report.performanceTotalAmount, 1200, 'performance total should remain visible as source amount');
      assertEqual(report.salaryAdjustmentAmount, 500, 'salary adjustment should be included in monthly salary');
      assertEqual(report.salaryAdjustmentIncreaseAmount, 500, 'salary adjustment increases should be retained separately');
      assertEqual(report.salaryAdjustmentDeductionAmount, 0, 'salary adjustment deductions should be retained separately');
      assertEqual(report.socialInsuranceDeductionAmount, 800, 'personal social insurance should be deducted from net salary');
      assertEqual(report.personalIncomeTaxAmount, 315, 'personal income tax should be calculated from cumulative monthly salary result');
      assertEqual(report.grossSalary, 12100, 'gross salary should include performance prepay and positive monthly adjustment');
      assertEqual(report.deductionAmount, 1620.75, 'deduction should include hourly attendance, statutory deductions, and derived tax');
      assertEqual(report.netSalary, 10479.25, 'net salary should equal gross minus deductions');
      assertEqual(report.salaryCompositionLines.length, 6, 'salary detail should include base, performance, attendance, adjustment, statutory, and tax lines');
      assertEqual(report.status, '待确认', 'ready sources without workflow should leave salary pending confirmation');
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
    name: 'rolls confirmed salary tax result into next monthly cumulative withholding snapshot',
    run: () => {
      const juneReports = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport()],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [createPersonalIncomeTaxSnapshot()],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [createWorkflow({ settledAt: undefined, status: '已确认' })],
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
      const rollingSnapshots = buildPersonalIncomeTaxCumulativeSnapshotsFromReports(
        [createPersonalIncomeTaxSnapshot()],
        juneReports
      );
      const julyReport = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport({ id: '2026-07-member-001', month: '2026-07' })],
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

      assertEqual(juneReports[0].status, '已确认', 'confirmed workflow should allow monthly tax result to become cumulative source');
      assertEqual(juneReports[0].personalIncomeTaxAmount, 205, 'June tax should be calculated from the prior cumulative snapshot');
      assertEqual(julyTaxRecord?.priorCumulativePeriod, '2026-06', 'July tax should use confirmed June cumulative snapshot');
      assertEqual(julyTaxRecord?.priorWithheldTaxAmount, 1150, 'July tax should carry forward June cumulative withheld amount');
      assertEqual(julyReport.personalIncomeTaxAmount, 520, 'July tax should be calculated by cumulative withholding instead of a standalone monthly formula');
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

      assertEqual(report.status, '已结算', 'settled workflow should mark report as settled');
      assertEqual(report.canAdjust, false, 'settled monthly salary should not allow adjustments');
      assertEqual(report.canSettle, false, 'settled monthly salary should not settle again');
      assertEqual(attendanceLocks.length, 1, 'settled salary should export one attendance lock record');
      assertEqual(attendanceLocks[0].settlementNo, 'PAY-TEST-001', 'attendance lock should use salary payroll number');
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
        salaryMonthlyWorkflows: [createWorkflow({ memberId: memberA.id })],
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
      const overview = buildSalaryOverview(reports);
      const baseSalaryRow = overview.boardRows.find((row) => row.id === 'base-salary');
      const adjustmentDeductionRow = overview.boardRows.find((row) => row.id === 'salary-adjustment-deduction');
      const topEmployee = overview.employeeRows[0];

      assertEqual(overview.summary.employeeCount, 2, 'salary overview should count unique employees');
      assertEqual(overview.summary.recordCount, 2, 'salary overview should count salary detail rows');
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
  let passed = 0;

  for (const test of tests) {
    try {
      test.run();
      passed += 1;
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    failures,
    passed,
    total: tests.length
  };
}

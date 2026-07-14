import type { AnnualExceptionConfigRow, WorkCalendarRow } from '../system/WorkCalendarState';
import type { PeopleMember } from '../people/peopleTypes';
import { performanceRulePresets } from './performanceMockData';
import { performanceSignatureEmployees, signatureRuleOptions } from './performanceSignatureArchiveData';
import {
  buildPerformanceSalarySettlementReference,
  buildPerformanceMonthlyRecords,
  getPerformanceMonthlyEmploymentScope
} from './performanceMonthlyModel';
import type { PerformanceDrawingTaskMonthlyRecord, PerformanceMonthlyCategoryRecord } from './performanceTypes';

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

const weekdayCalendar: WorkCalendarRow = {
  alternateWorkdays: [],
  code: 'CAL-PERF-001',
  fixedWorkdays: ['周一', '周二', '周三', '周四', '周五'],
  id: 'calendar-performance-weekday',
  isDefault: true,
  name: '绩效测试双休',
  note: '',
  status: '启用',
  type: '双休',
  updatedAt: '2026-06-23'
};

const annualExceptionRows: AnnualExceptionConfigRow[] = [];

function createMember(overrides: Partial<PeopleMember> = {}): PeopleMember {
  return {
    address: '湖北武汉',
    archiveFiles: [],
    archiveStatus: '资料完整',
    archiveUpdatedAt: '2026-06-16',
    auditRecords: [],
    birthDate: '1994-01-01',
    city: '武汉',
    contractNo: 'HT-PERF-001',
    contractStartAt: '2026-06-16',
    contractStatus: '劳动合同有效',
    contractType: '劳动合同',
    education: '本科',
    educationMajor: '环境设计',
    email: 'perf@example.com',
    emergencyContact: '测试联系人',
    emergencyContactPhone: '13800000000',
    emergencyContactRelation: '家属',
    gender: '女',
    graduatedAt: '2016-06-30',
    graduationSchool: '武汉大学',
    hukouAddress: '湖北武汉',
    id: '20269999',
    idDocumentType: '身份证',
    idValidUntil: '2036-01-01',
    identityNo: '420000199401010000',
    joinedAt: '2026-06-16',
    mobile: '13800000001',
    name: '绩效测试人员',
    nationality: '中国',
    paymentProfile: {
      accountName: '绩效测试人员',
      bankAccount: '6222000000000000000',
      bankName: '招商银行',
      mode: '工资发放',
      payCycle: '月度'
    },
    personnelType: '全职',
    position: '空间设计师',
    salaryProfile: {
      effectiveAt: '2026-06-16',
      note: '',
      payCycle: '月度',
      regularSalary: '10000 元/月',
      status: '已配置',
      structure: '固定月薪'
    },
    source: '社招',
    status: '在职',
    taskAccessStatus: '可参与任务',
    taskCapabilityIds: [],
    taskRecords: [],
    wechat: 'perf-test',
    workCalendarId: weekdayCalendar.id,
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

function createDrawingRecord(overrides: Partial<PerformanceDrawingTaskMonthlyRecord> = {}): PerformanceDrawingTaskMonthlyRecord {
  return {
    amountSummary: {
      baseAmount: 0,
      baseQualityRatio: 0.9,
      confirmedBaseScore: 0,
      excessAmount: 0,
      excessMultiplier: 0,
      excessQualityRatio: 0.9,
      excessScore: 0,
      monthlyAmount: 0,
      pointValue: 25,
      prepayAmount: 0,
      prepayRatio: 0.5,
      settlementNote: '测试',
      taskConfirmRatio: 1
    },
    baseQualityRatio: 0.9,
    category: '绘图任务制',
    department: '设计部',
    employeeName: '绩效测试人员',
    events: [],
    excessQualityRatio: 0.9,
    id: 'monthly-drawing-202606-test',
    salarySettlementReference: 'performance-result:monthly-drawing-202606-test:monthly-prepay:v1',
    monthlyAmount: 0,
    performanceMonth: '2026-06',
    position: '空间设计师',
    prepayAmount: 0,
    qualityBand: '80-89分',
    qualityScore: 86,
    qualitySummaries: [],
    ruleName: '绘图任务制V1',
    ruleVersion: 'V1',
    sourceTaskCount: 20,
    taskScore: 46.6,
    taskSummaries: [],
    updatedAt: '2026-06-30 18:00',
    workNo: '20269999',
    ...overrides
  };
}

function createCategoryRecord(overrides: Partial<PerformanceMonthlyCategoryRecord> = {}): PerformanceMonthlyCategoryRecord {
  return {
    category: '岗位职责考核',
    department: '设计部',
    employeeName: '绩效测试人员',
    events: [],
    id: 'monthly-duty-202606-test',
    salarySettlementReference: 'performance-result:monthly-duty-202606-test:monthly-prepay:v1',
    monthlyAmount: 1200,
    note: '岗位职责考核按周期评价结果进入员工绩效汇总',
    performanceMonth: '2026-06',
    position: '空间设计师',
    prepayAmount: 600,
    qualityScore: 90,
    ruleName: '岗位职责考核V1',
    ruleVersion: 'V1',
    sourceLabel: '周期考核',
    sourceTaskCount: 0,
    updatedAt: '2026-06-30 18:00',
    workNo: '20269999',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'builds stable salary settlement references for confirmed performance results',
    run() {
      assertEqual(
        buildPerformanceSalarySettlementReference('monthly-duty-202606-test', 'monthly-prepay'),
        'performance-result:monthly-duty-202606-test:monthly-prepay:v1',
        'the same performance result identity should produce a stable salary reference'
      );
      assertEqual(
        buildPerformanceSalarySettlementReference('monthly-duty-202606-test', 'quarterly-review', 'review-2'),
        'performance-result:monthly-duty-202606-test:quarterly-review:review-2',
        'quarterly review revisions should have an explicit stable identity'
      );
    }
  },
  {
    name: 'calculates performance employment scope from actual workdays',
    run() {
      const scope = getPerformanceMonthlyEmploymentScope({
        annualExceptionRows,
        member: createMember(),
        month: '2026-06',
        workCalendarRows: [weekdayCalendar]
      });

      assert(scope, 'mid-month full-time member should have a performance scope');
      assertEqual(scope.monthWorkdays, 22, 'June 2026 weekday calendar should have 22 actual workdays');
      assertEqual(scope.effectiveWorkdays, 11, 'June 16 entry should have 11 effective workdays');
      assertEqual(scope.ratio, 0.5, 'performance ratio should use actual workdays, not 21.75 payroll days');
    }
  },
  {
    name: 'prorates full-time task-scoring thresholds without discounting task score',
    run() {
      const records = buildPerformanceMonthlyRecords({
        annualExceptionRows,
        categoryRecords: [createCategoryRecord({ category: '绘图任务制', id: 'monthly-drawing-202606-test', ruleName: '绘图任务制V1', sourceLabel: '任务汇总', taskScore: 46.6 })],
        drawingTaskRecords: [createDrawingRecord()],
        peopleRows: [createMember()],
        ruleOptions: signatureRuleOptions,
        ruleRows: performanceRulePresets,
        signatureEmployees: [
          {
            ...performanceSignatureEmployees[1],
            employeeName: '绩效测试人员',
            files: [
              {
                category: '绘图任务制',
                fileName: '绩效测试人员_绘图任务制V1_绩效签署文件.pdf',
                id: 'perf-file-20269999-draw-v1',
                note: '测试签署文件',
                relationStatus: '当前签署',
                ruleName: '绘图任务制V1',
                ruleVersion: 'V1',
                signedAt: '2026-06-16',
                uploadedAt: '2026-06-16 10:00'
              }
            ],
            id: 'perf-signature-employee-20269999',
            workNo: '20269999'
          }
        ],
        workCalendarRows: [weekdayCalendar]
      });
      const drawingRecord = records.drawingTaskRecords[0];
      const categoryRecord = records.categoryRecords[0];

      assert(drawingRecord, 'drawing record should remain after employment-scope calculation');
      assert(categoryRecord, 'category record should be built from adjusted drawing detail');
      assertEqual(drawingRecord.taskScore, 46.6, 'raw task score should not be discounted');
      assertEqual(drawingRecord.prorationSummary?.fullScore, 50, 'full score should be prorated by effective workdays');
      assertEqual(drawingRecord.prorationSummary?.baseLineScore, 40, 'base line should be prorated by effective workdays');
      assertEqual(drawingRecord.prorationSummary?.basePerformanceAmount, 1250, 'base performance cap should be prorated');
      assertEqual(drawingRecord.executionContract?.status, '已匹配', 'drawing record should match signed execution contract');
      assertEqual(drawingRecord.amountSummary.confirmedBaseScore, 46.6, 'confirmed score should use raw task score below prorated full score');
      assertEqual(drawingRecord.amountSummary.taskConfirmRatio, 1, 'task confirmation should compare against prorated base line');
      assertEqual(drawingRecord.monthlyAmount, 1048.5, 'monthly amount should use prorated scoring thresholds');
      assertEqual(drawingRecord.prepayAmount, 524.25, 'prepay should derive from adjusted monthly amount');
      assertEqual(categoryRecord.monthlyAmount, 1048.5, 'category row should consume adjusted drawing amount');
    }
  },
  {
    name: 'prorates duty-assessment amounts but keeps project bonus amounts intact',
    run() {
      const records = buildPerformanceMonthlyRecords({
        annualExceptionRows,
        categoryRecords: [
          createCategoryRecord(),
          createCategoryRecord({
            category: '项目奖金',
            id: 'monthly-bonus-202606-test',
            monthlyAmount: 800,
            note: '项目奖金按实际确认金额进入绩效',
            prepayAmount: 400,
            ruleName: '项目奖金V1',
            sourceLabel: '奖金确认'
          })
        ],
        drawingTaskRecords: [],
        peopleRows: [createMember()],
        ruleOptions: signatureRuleOptions,
        ruleRows: performanceRulePresets,
        signatureEmployees: [
          {
            ...performanceSignatureEmployees[0],
            employeeName: '绩效测试人员',
            files: [
              {
                category: '岗位职责考核',
                fileName: '绩效测试人员_岗位职责考核V1_绩效签署文件.pdf',
                id: 'perf-file-20269999-duty-v1',
                note: '测试签署文件',
                relationStatus: '当前签署',
                ruleName: '岗位职责考核V1',
                ruleVersion: 'V1',
                signedAt: '2026-06-16',
                uploadedAt: '2026-06-16 10:00'
              },
              {
                category: '项目奖金',
                fileName: '绩效测试人员_项目奖金V1_绩效签署文件.pdf',
                id: 'perf-file-20269999-bonus-v1',
                note: '测试签署文件',
                relationStatus: '历史文件',
                ruleName: '项目奖金V1',
                ruleVersion: 'V1',
                signedAt: '2026-06-16',
                uploadedAt: '2026-06-16 10:00'
              }
            ],
            id: 'perf-signature-employee-20269999',
            workNo: '20269999'
          }
        ],
        workCalendarRows: [weekdayCalendar]
      });
      const dutyRecord = records.categoryRecords.find((record) => record.category === '岗位职责考核');
      const bonusRecord = records.categoryRecords.find((record) => record.category === '项目奖金');

      assert(dutyRecord, 'duty record should remain in scope');
      assert(bonusRecord, 'project bonus record should remain in scope');
      assertEqual(dutyRecord.monthlyAmount, 600, 'duty-assessment amount should be prorated by workday ratio');
      assertEqual(dutyRecord.prepayAmount, 300, 'duty-assessment prepay should be prorated by workday ratio');
      assertEqual(dutyRecord.executionContract?.status, '已匹配', 'duty record should match signature rule option contract');
      assertEqual(bonusRecord.monthlyAmount, 800, 'project bonus should keep actual confirmed amount');
      assertEqual(bonusRecord.prepayAmount, 400, 'project bonus prepay should keep actual confirmed amount');
      assertEqual(bonusRecord.executionContract?.status, '已匹配', 'historical project bonus signature should remain contract matched');
    }
  },
  {
    name: 'keeps monthly result but marks execution-contract problems',
    run() {
      const records = buildPerformanceMonthlyRecords({
        annualExceptionRows,
        categoryRecords: [
          createCategoryRecord({
            category: '绘图任务制',
            id: 'monthly-drawing-202606-test',
            ruleName: '绘图任务制V2',
            ruleVersion: 'V2',
            sourceLabel: '任务汇总',
            taskScore: 46.6
          })
        ],
        drawingTaskRecords: [createDrawingRecord({ ruleName: '绘图任务制V2', ruleVersion: 'V2' })],
        peopleRows: [createMember()],
        ruleOptions: signatureRuleOptions,
        ruleRows: performanceRulePresets,
        signatureEmployees: [
          {
            ...performanceSignatureEmployees[1],
            employeeName: '绩效测试人员',
            files: [
              {
                category: '绘图任务制',
                fileName: '绩效测试人员_绘图任务制V1_绩效签署文件.pdf',
                id: 'perf-file-20269999-draw-v1',
                note: '测试签署文件',
                relationStatus: '当前签署',
                ruleName: '绘图任务制V1',
                ruleVersion: 'V1',
                signedAt: '2026-06-16',
                uploadedAt: '2026-06-16 10:00'
              }
            ],
            id: 'perf-signature-employee-20269999',
            workNo: '20269999'
          }
        ],
        workCalendarRows: [weekdayCalendar]
      });
      const drawingRecord = records.drawingTaskRecords[0];

      assert(drawingRecord, 'drawing record should remain available for ledger review');
      assertEqual(drawingRecord.executionContract?.status, '签署版本不一致', 'contract should flag version mismatch');
      assertEqual(drawingRecord.executionContract?.signedRuleVersion, 'V1', 'contract should preserve signed version evidence');
    }
  }
];

export function runPerformanceMonthlyModelTests(): UnitTestResult {
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

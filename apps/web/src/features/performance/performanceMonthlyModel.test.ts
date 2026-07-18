import type { AnnualExceptionConfigRow, WorkCalendarRow } from '../system/WorkCalendarState';
import { peopleMembers } from '../people/mockData';
import type { PeopleMember } from '../people/peopleTypes';
import { performanceRulePresets } from './performanceMockData';
import {
  buildPerformanceSalarySettlementReference,
  buildPerformanceMonthlyRecords,
  getPerformanceMonthlyEmploymentScope
} from './performanceMonthlyModel';
import {
  calculateDrawingTaskPerformanceAmount,
  calculateWeightedPerformanceQualityScore
} from './performanceRuleCalculationModel';
import type { PerformanceDrawingTaskMonthlyRecord } from './performanceTypes';

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
function requireFixture<T>(value: T | undefined, message: string): T {
  if (!value) {
    throw new Error(message);
  }

  return value;
}
const baseMember = requireFixture(
  peopleMembers.find((member) => member.id === '20250018'),
  'Performance test member 20250018 is missing.'
);

function createMember(overrides: Partial<PeopleMember> = {}): PeopleMember {
  return {
    ...baseMember,
    workCalendarId: weekdayCalendar.id,
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
      settlementNote: '月度预发50%，季度复核差额',
      taskConfirmRatio: 1
    },
    baseQualityRatio: 0.9,
    category: '绘图任务制',
    employeeName: baseMember.name,
    events: [],
    excessQualityRatio: 0.9,
    id: 'task-performance:2026-06:20250018:perf-rule-space-design-2026-final',
    monthlyAmount: 0,
    note: '按已验收任务归集。',
    performanceMonth: '2026-06',
    position: baseMember.position,
    prepayAmount: 0,
    qualityBand: '80-89分',
    qualityScore: 86,
    qualitySummaries: [],
    ruleName: '绘图任务制V1',
    ruleVersion: 'V1',
    salarySettlementReference: 'performance-result:task-performance:2026-06:20250018:perf-rule-space-design-2026-final:monthly-prepay:v1',
    sourceLabel: '任务验收',
    sourceRecordIds: ['score-task-001'],
    sourceTaskCount: 1,
    taskScore: 46.6,
    taskSummaries: [],
    updatedAt: '2026-06-30 18:00',
    workNo: baseMember.id,
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'builds stable salary settlement references for confirmed performance results',
    run() {
      assertEqual(
        buildPerformanceSalarySettlementReference('monthly-drawing-202606-test', 'monthly-prepay'),
        'performance-result:monthly-drawing-202606-test:monthly-prepay:v1',
        'the same performance result identity should produce a stable salary reference'
      );
      assertEqual(
        buildPerformanceSalarySettlementReference('quarterly:20260001:2026-Q2:绘图任务制', 'quarterly-difference', 'v2'),
        'performance-result:quarterly:20260001:2026-Q2:绘图任务制:quarterly-difference:v2',
        'quarterly result versions should produce an explicit stable difference identity'
      );
    }
  },
  {
    name: 'PF-10 calculates amounts only from structured ratios, factors and quality weights',
    run() {
      const rule = performanceRulePresets[0];

      assert(rule, 'published drawing rule should exist');
      const qualityScore = calculateWeightedPerformanceQualityScore(
        [
          { id: 'quality', score: 40 },
          { id: 'timeliness', score: 12.5 },
          { id: 'workflow', score: 0 },
          { id: 'collaboration', score: 0 }
        ],
        rule.qualityDimensions
      );
      const reweightedQualityScore = calculateWeightedPerformanceQualityScore(
        [
          { id: 'quality', score: 40 },
          { id: 'timeliness', score: 12.5 },
          { id: 'workflow', score: 0 },
          { id: 'collaboration', score: 0 }
        ],
        rule.qualityDimensions.map((dimension) => ({
          ...dimension,
          weight: dimension.id === 'quality' ? 0.1 : dimension.id === 'timeliness' ? 0.7 : 0.1
        }))
      );
      const originalAmount = calculateDrawingTaskPerformanceAmount({
        basePerformanceAmount: 2500,
        baselineScore: 80,
        belowBaselineFactor: 0.5,
        excessBands: rule.excessBands,
        fullScore: 100,
        monthlyPrepayRatio: 0.5,
        qualityBands: rule.qualityBands,
        qualityScore: 95,
        taskScore: 40
      });
      const revisedAmount = calculateDrawingTaskPerformanceAmount({
        basePerformanceAmount: 2500,
        baselineScore: 80,
        belowBaselineFactor: 0.8,
        excessBands: rule.excessBands,
        fullScore: 100,
        monthlyPrepayRatio: 0.25,
        qualityBands: rule.qualityBands,
        qualityScore: 95,
        taskScore: 40
      });

      assertEqual(qualityScore, 52.5, 'quality score should use configured weights');
      assertEqual(reweightedQualityScore, 45, 'changing structured weights should change quality score');
      assertEqual(originalAmount.monthlyAmount, 500, 'below-baseline amount should use configured factor');
      assertEqual(originalAmount.prepayAmount, 250, 'prepay should use configured ratio');
      assertEqual(revisedAmount.monthlyAmount, 800, 'revised factor should change the monthly result');
      assertEqual(revisedAmount.prepayAmount, 200, 'revised prepay ratio should change prepay independently');
    }
  },
  {
    name: 'PF-11 prorates joining employee thresholds without discounting accepted task score',
    run() {
      const member = createMember({ joinedAt: '2026-06-16' });
      const scope = getPerformanceMonthlyEmploymentScope({
        annualExceptionRows,
        member,
        month: '2026-06',
        workCalendarRows: [weekdayCalendar]
      });
      const records = buildPerformanceMonthlyRecords({
        annualExceptionRows,
        drawingTaskRecords: [createDrawingRecord()],
        peopleRows: [member],
        ruleRows: performanceRulePresets,
        workCalendarRows: [weekdayCalendar]
      });
      const record = records.drawingTaskRecords[0];

      assert(scope, 'mid-month employee should have a performance scope');
      assert(record, 'mid-month employee result should remain available');
      assertEqual(scope.monthWorkdays, 22, 'June 2026 should contain 22 weekday-calendar workdays');
      assertEqual(scope.effectiveWorkdays, 11, 'June 16 entry should contain 11 effective workdays');
      assertEqual(record.taskScore, 46.6, 'accepted task score should remain unchanged');
      assertEqual(record.prorationSummary?.fullScore, 50, 'full score should follow effective workday ratio');
      assertEqual(record.prorationSummary?.baseLineScore, 40, 'baseline should follow effective workday ratio');
      assertEqual(record.prorationSummary?.basePerformanceAmount, 1250, 'base amount should follow effective workday ratio');
      assertEqual(record.monthlyAmount, 1048.5, 'monthly amount should use prorated thresholds');
      assertEqual(record.prepayAmount, 524.25, 'prepay should derive from the prorated result');
    }
  },
  {
    name: 'PF-11 prorates leaving employee thresholds without discounting accepted task score',
    run() {
      const member = createMember({
        archiveUpdatedAt: '2026-06-15',
        contractEndAt: '2026-06-15',
        joinedAt: '2025-11-15',
        status: '离职'
      });
      const records = buildPerformanceMonthlyRecords({
        annualExceptionRows,
        drawingTaskRecords: [createDrawingRecord()],
        peopleRows: [member],
        ruleRows: performanceRulePresets,
        workCalendarRows: [weekdayCalendar]
      });
      const record = records.drawingTaskRecords[0];

      assert(record, 'mid-month leaver result should remain available');
      assertEqual(record.employmentScope?.effectiveWorkdays, 11, 'June 15 exit should contain 11 effective workdays');
      assertEqual(record.taskScore, 46.6, 'accepted task score should remain unchanged for leavers');
      assertEqual(record.prorationSummary?.fullScore, 50, 'leaver full score should be prorated');
      assertEqual(record.prorationSummary?.baseLineScore, 40, 'leaver baseline should be prorated');
      assertEqual(record.prorationSummary?.basePerformanceAmount, 1250, 'leaver base amount should be prorated');
    }
  },
  {
    name: 'keeps the result visible while flagging a rule-version mismatch',
    run() {
      const records = buildPerformanceMonthlyRecords({
        annualExceptionRows,
        drawingTaskRecords: [createDrawingRecord({ ruleName: '绘图任务制V2', ruleVersion: 'V2' })],
        peopleRows: [createMember()],
        ruleRows: performanceRulePresets,
        workCalendarRows: [weekdayCalendar]
      });
      const record = records.drawingTaskRecords[0];

      assert(record, 'version-mismatched record should remain available for review');
      assertEqual(record.ruleApplicability?.status, '规则版本不一致', 'period-version mismatch should be explicit');
      assertEqual(record.ruleApplicability?.ruleVersion, 'V1', 'June should resolve the V1 published rule');
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

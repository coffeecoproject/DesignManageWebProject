import { performanceRulePresets } from './performanceMockData';
import { buildPerformanceDashboardData, buildPerformanceDashboardPeriodRange } from './performanceDashboardModel';
import type { PerformanceMonthlyCategoryRecord } from './performanceTypes';

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

function assertClose(actual: number, expected: number, message: string) {
  if (Math.abs(actual - expected) > 0.001) {
    fail(`${message}. Expected ${expected}, received ${actual}`);
  }
}

function createMonthlyRecord(
  id: string,
  performanceMonth: string,
  workNo: string,
  monthlyAmount: number,
  prepayAmount: number,
  qualityScore: number
): PerformanceMonthlyCategoryRecord {
  return {
    category: '绘图任务制',
    employeeName: `员工${workNo}`,
    events: [],
    id,
    monthlyAmount,
    note: '按已验收任务归集。',
    performanceMonth,
    position: '主案设计师',
    prepayAmount,
    qualityScore,
    ruleName: performanceMonth === '2026-06' ? '绘图任务制V1' : '绘图任务制V1',
    ruleVersion: 'V1',
    salarySettlementReference: `performance-result:${id}:monthly-prepay:v1`,
    sourceLabel: '任务验收',
    sourceRecordIds: [`score-${id}`],
    sourceTaskCount: 1,
    taskScore: monthlyAmount / 25,
    updatedAt: `${performanceMonth}-28 18:00`,
    workNo
  };
}

const monthlyRecords = [
  createMonthlyRecord('june-a', '2026-06', '20250018', 1000, 500, 90),
  createMonthlyRecord('june-b', '2026-06', '20260008', 2000, 1000, 80),
  createMonthlyRecord('may-a', '2026-05', '20250018', 800, 400, 70)
];

const tests: UnitTest[] = [
  {
    name: 'performance dashboard defaults to current natural month',
    run() {
      const period = buildPerformanceDashboardPeriodRange('month', '2026-06-15');

      assertEqual(period.startDate, '2026-06-01', 'month period should start at first day');
      assertEqual(period.endDate, '2026-06-30', 'month period should end at last day');
      assertEqual(period.label, '2026-06-01 至 2026-06-30', 'month period label should be explicit');
      assertEqual(period.trendGranularity, 'month', 'performance trend should keep month granularity');
    }
  },
  {
    name: 'performance dashboard aggregates source-backed drawing records',
    run() {
      const dashboard = buildPerformanceDashboardData({
        monthlyRecords,
        ruleRows: performanceRulePresets,
        today: '2026-06-15'
      });

      assertEqual(dashboard.metrics.employeeCount, 2, 'current month should include two employees');
      assertEqual(dashboard.metrics.recordCount, 2, 'current month should include two drawing records');
      assertClose(dashboard.metrics.periodAmount, 3000, 'current month amount should aggregate source-backed results');
      assertClose(dashboard.metrics.periodPrepayAmount, 1500, 'current month prepay should aggregate source-backed results');
      assertClose(dashboard.metrics.averageQualityScore ?? 0, 85, 'average quality should use current-month records');
      assertEqual(dashboard.metrics.publishedRules, 2, 'published rule count should use structured rule rows');
      assertEqual(dashboard.categoryDistribution[0]?.label, '绘图任务制', 'only the implemented category should be present');
    }
  },
  {
    name: 'performance dashboard quarter trend uses month buckets',
    run() {
      const period = buildPerformanceDashboardPeriodRange('quarter', '2026-06-15');
      const dashboard = buildPerformanceDashboardData({
        monthlyRecords,
        periodRange: period,
        ruleRows: performanceRulePresets
      });

      assertEqual(dashboard.trend.length, 3, 'quarter trend should include three month buckets');
      assertEqual(dashboard.trend[0]?.date, '2026-04', 'quarter trend should begin with quarter start month');
      assertEqual(dashboard.trend[2]?.date, '2026-06', 'quarter trend should end with selected month');
      assertClose(dashboard.trend[1]?.amount ?? 0, 800, 'May bucket should include May source records');
      assertClose(dashboard.trend[2]?.amount ?? 0, 3000, 'June bucket should include June source records');
    }
  },
  {
    name: 'performance dashboard flags monthly rule applicability risks',
    run() {
      const firstRecord = monthlyRecords[0];

      assert(firstRecord, 'monthly fixture should include at least one record');
      const dashboard = buildPerformanceDashboardData({
        monthlyRecords: [
          {
            ...firstRecord,
            ruleApplicability: {
              applicablePositions: ['主案设计师'],
              category: firstRecord.category,
              note: '绩效结果版本与该期间自动适用版本不一致。',
              position: firstRecord.position,
              ruleName: firstRecord.ruleName,
              ruleVersion: firstRecord.ruleVersion,
              status: '规则版本不一致',
              workNo: firstRecord.workNo
            }
          }
        ],
        ruleRows: performanceRulePresets,
        today: '2026-06-15'
      });

      assert(
        dashboard.riskRows.some((row) => row.id === `applicability-${firstRecord.id}` && row.riskText === '规则版本不一致'),
        'dashboard risk rows should include rule applicability mismatches'
      );
    }
  },
  {
    name: 'performance dashboard separates disputed results from normal aggregates',
    run() {
      const disputedRecord = {
        ...monthlyRecords[0],
        resultResponseStatus: '有异议' as const
      };

      assert(disputedRecord, 'monthly fixture should include a disputed record');
      const dashboard = buildPerformanceDashboardData({
        monthlyRecords: [disputedRecord],
        ruleRows: performanceRulePresets,
        today: '2026-06-15'
      });

      assertEqual(dashboard.metrics.recordCount, 0, 'disputed result should not enter normal metrics');
      assertEqual(dashboard.metrics.periodAmount, 0, 'disputed amount should not enter period amount');
      assertEqual(dashboard.employeeRows.length, 0, 'disputed result should not enter employee ranking');
      assertEqual(dashboard.trend[0]?.amount, 0, 'disputed result should not enter period trend');
      assert(
        dashboard.riskRows.some(
          (row) => row.id === `objection-${disputedRecord.id}` && row.riskText === '绩效结果存在未处理异议'
        ),
        'disputed result should remain visible as a separate objection risk'
      );
    }
  }
];

export function runPerformanceDashboardModelTests(): UnitTestResult {
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

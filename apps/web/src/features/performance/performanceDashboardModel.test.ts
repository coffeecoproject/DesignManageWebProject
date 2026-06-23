import { performanceMonthlyCategoryRecords, performanceRulePresets } from './performanceMockData';
import { performanceSignatureEmployees } from './performanceSignatureArchiveData';
import { buildPerformanceDashboardData, buildPerformanceDashboardPeriodRange } from './performanceDashboardModel';

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
    name: 'performance dashboard aggregates all monthly category records',
    run() {
      const dashboard = buildPerformanceDashboardData({
        monthlyRecords: performanceMonthlyCategoryRecords,
        ruleRows: performanceRulePresets,
        signatureEmployees: performanceSignatureEmployees,
        today: '2026-06-15'
      });

      assertEqual(dashboard.metrics.employeeCount, 3, 'current month should include three employees');
      assertEqual(dashboard.metrics.recordCount, 5, 'current month should include all category records');
      assertClose(dashboard.metrics.periodAmount, 9439.45, 'current month amount should include drawing and duty records');
      assertClose(dashboard.metrics.periodPrepayAmount, 4719.73, 'current month prepay amount should include drawing and duty records');
      assertClose(dashboard.metrics.averageQualityScore ?? 0, 89.4, 'average quality score should include all scored records');
      assertEqual(dashboard.metrics.currentSignedRelationships, 5, 'current signed relationship count should use signature archive');
      assertEqual(dashboard.metrics.publishedRules, 2, 'published rule count should use rule rows');
      assertEqual(dashboard.categoryDistribution[0]?.label, '绘图任务制', 'highest amount category should be first');
    }
  },
  {
    name: 'performance dashboard quarter trend uses month buckets',
    run() {
      const period = buildPerformanceDashboardPeriodRange('quarter', '2026-06-15');
      const dashboard = buildPerformanceDashboardData({
        monthlyRecords: performanceMonthlyCategoryRecords,
        periodRange: period,
        ruleRows: performanceRulePresets,
        signatureEmployees: performanceSignatureEmployees
      });

      assertEqual(dashboard.trend.length, 3, 'quarter trend should include three month buckets');
      assertEqual(dashboard.trend[0]?.date, '2026-04', 'quarter trend should begin with quarter start month');
      assertEqual(dashboard.trend[2]?.date, '2026-06', 'quarter trend should end with selected month');
      assertClose(dashboard.trend[1]?.amount ?? 0, 2900, 'May bucket should include drawing and bonus records');
      assertClose(dashboard.trend[2]?.amount ?? 0, 9439.45, 'June bucket should include all current records');
    }
  },
  {
    name: 'performance dashboard flags missing current signed monthly records',
    run() {
      const drawingOnlyRecords = performanceMonthlyCategoryRecords.filter((record) => record.category === '绘图任务制');
      const dashboard = buildPerformanceDashboardData({
        monthlyRecords: drawingOnlyRecords,
        ruleRows: performanceRulePresets,
        signatureEmployees: performanceSignatureEmployees,
        today: '2026-06-15'
      });
      const missingDutyRows = dashboard.riskRows.filter((row) => row.riskText === '当前签署关系缺少月度绩效');

      assertEqual(missingDutyRows.length, 2, 'current signed duty relationships should require monthly results');
      assert(
        missingDutyRows.some((row) => row.objectName === '赵倩') && missingDutyRows.some((row) => row.objectName === '陈思'),
        'missing duty risks should identify affected employees'
      );
    }
  },
  {
    name: 'performance dashboard flags monthly execution contract risks',
    run() {
      const firstRecord = performanceMonthlyCategoryRecords[0];

      assert(firstRecord, 'monthly fixture should include at least one record');

      const dashboard = buildPerformanceDashboardData({
        monthlyRecords: [
          {
            ...firstRecord,
            executionContract: {
              applicablePositions: ['空间设计师'],
              category: firstRecord.category,
              note: '绩效结果版本与员工签署文件版本不一致。',
              position: firstRecord.position,
              ruleName: firstRecord.ruleName,
              ruleSource: '结构化规则',
              ruleVersion: firstRecord.ruleVersion,
              signedRuleVersion: 'V0',
              status: '签署版本不一致',
              workNo: firstRecord.workNo
            }
          }
        ],
        ruleRows: performanceRulePresets,
        signatureEmployees: performanceSignatureEmployees,
        today: '2026-06-15'
      });

      assert(
        dashboard.riskRows.some((row) => row.id === `contract-${firstRecord.id}` && row.riskText === '签署版本不一致'),
        'dashboard risk rows should include execution contract mismatches'
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

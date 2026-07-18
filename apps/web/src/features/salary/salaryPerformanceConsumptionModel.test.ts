import { settlePerformanceResults } from '../performance/performanceResultSettlementModel';
import type {
  PerformanceMonthlyCategoryRecord,
  PerformanceMonthlyResultSnapshot,
  PerformanceQuarterlyResultSnapshot
} from '../performance/performanceTypes';
import {
  buildSalaryPerformanceSettlementLines,
  type SalaryMonthlyWorkflowRecord
} from './salaryDomain';
import { buildSalaryPerformanceSourceRecords } from './salaryPerformanceConsumptionModel';

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

function createCategoryRecord(
  prepayAmount: number,
  overrides: Partial<PerformanceMonthlyCategoryRecord> = {}
): PerformanceMonthlyCategoryRecord {
  return {
    category: '绘图任务制',
    employeeName: '示例员工',
    events: [],
    id: 'task-performance:2026-06:employee-001:rule-001',
    monthlyAmount: prepayAmount * 2,
    note: '按任务验收结果自动计算。',
    performanceMonth: '2026-06',
    position: '空间设计师',
    prepayAmount,
    qualityScore: 90,
    ruleApplicability: {
      applicablePositions: ['空间设计师'],
      category: '绘图任务制',
      note: '已按岗位和生效期自动适用。',
      position: '空间设计师',
      ruleId: 'rule-001',
      ruleName: '设计绩效规则',
      ruleVersion: 'V1',
      status: '适用',
      workNo: 'employee-001'
    },
    ruleName: '设计绩效规则',
    ruleVersion: 'V1',
    salarySettlementReference: 'source-only-reference',
    sourceLabel: '任务验收',
    sourceRecordIds: ['task-score-001'],
    sourceTaskCount: 1,
    taskScore: 90,
    updatedAt: '2026-06-15 09:00',
    workNo: 'employee-001',
    ...overrides
  };
}

function createMonthlyResult({
  prepayAmount = 600,
  version = 1,
  ...overrides
}: Partial<PerformanceMonthlyResultSnapshot> & {
  prepayAmount?: number;
  version?: number;
} = {}): PerformanceMonthlyResultSnapshot {
  const id = overrides.id ?? `monthly:employee-001:2026-06:绘图任务制:v${version}`;
  const categoryRecord = createCategoryRecord(prepayAmount);

  return {
    calculationSnapshot: { categoryRecord },
    deliveredAt: '2026-06-15 10:00',
    employeeId: 'employee-001',
    employeeNameSnapshot: '示例员工',
    employeeResponse: {
      employeeId: 'employee-001',
      resultId: id,
      resultVersion: version,
      status: '待确认'
    },
    events: [],
    id,
    kind: '月度结果',
    lifecycleStatus: '已发布',
    monthlyAmount: prepayAmount * 2,
    period: '2026-06',
    positionSnapshot: '空间设计师',
    prepayAmount,
    publishedAt: '2026-06-15 10:00',
    publishedBy: '李明',
    responseDeadline: '2026-06-18 23:59:59',
    resultKey: 'monthly:employee-001:2026-06:绘图任务制',
    ruleId: 'rule-001',
    ruleNameSnapshot: '设计绩效规则',
    ruleVersion: 'V1',
    salarySettlementMonth: '2026-06',
    salarySettlementReference: `performance-result:monthly:employee-001:2026-06:drawing:v${version}`,
    sourceHash: `source-hash-v${version}`,
    sourceRecordIds: [`task-score-v${version}`],
    version,
    workNoSnapshot: 'employee-001',
    ...overrides
  };
}

function createQuarterlyResult(
  overrides: Partial<PerformanceQuarterlyResultSnapshot> = {}
): PerformanceQuarterlyResultSnapshot {
  const id = overrides.id ?? 'quarterly:employee-001:2026-Q2:绘图任务制:v1';

  return {
    calculationSnapshot: {
      category: '绘图任务制',
      expectedMonths: ['2026-04', '2026-05', '2026-06'],
      missingMonths: [],
      unresolvedObjectionMonths: [],
      quarterAdjustmentAmount: 0,
      quarterCalculatedAmount: 1800,
      quarterClosed: true,
      quarterDifferenceAmount: 300,
      quarterEndDate: '2026-06-30',
      quarterEvidenceFileIds: [],
      quarterFinalAmount: 1800,
      quarterPrepayAmount: 1500,
      salarySettlementMonth: '2026-06',
      sourceResults: []
    },
    deliveredAt: '2026-07-01 10:00',
    employeeId: 'employee-001',
    employeeNameSnapshot: '示例员工',
    employeeResponse: {
      employeeId: 'employee-001',
      resultId: id,
      resultVersion: 1,
      status: '已确认'
    },
    events: [],
    id,
    kind: '季度结果',
    lifecycleStatus: '已发布',
    period: '2026-Q2',
    positionSnapshot: '空间设计师',
    publishedAt: '2026-07-01 10:00',
    publishedBy: '李明',
    quarterAdjustmentAmount: 0,
    quarterCalculatedAmount: 1800,
    quarterDifferenceAmount: 300,
    quarterEvidenceFileIds: [],
    quarterFinalAmount: 1800,
    quarterPrepayAmount: 1500,
    responseDeadline: '2026-07-04 23:59:59',
    resultKey: 'quarterly:employee-001:2026-Q2:绘图任务制',
    ruleId: 'rule-001',
    ruleNameSnapshot: '设计绩效规则',
    ruleVersion: 'V1',
    salarySettlementMonth: '2026-06',
    salarySettlementReference: 'performance-result:quarterly:employee-001:2026-Q2:drawing:v1',
    sourceHash: 'quarter-source-hash-v1',
    sourceRecordIds: ['monthly-result-apr', 'monthly-result-may', 'monthly-result-jun'],
    version: 1,
    workNoSnapshot: 'employee-001',
    ...overrides
  };
}

function createWorkflow(
  overrides: Partial<SalaryMonthlyWorkflowRecord> = {}
): SalaryMonthlyWorkflowRecord {
  return {
    confirmedAt: '2026-06-30 10:00',
    confirmedBy: '李明',
    id: 'salary-workflow:2026-06:employee-001',
    memberId: 'employee-001',
    month: '2026-06',
    note: '薪酬已确认',
    payrollNo: 'PAY-202606-EMPLOYEE001',
    salarySettlementReferences: [],
    status: '已确认',
    updatedAt: '2026-06-30 10:00',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'PF-20 feedback window and active objections block salary consumption',
    run() {
      const pending = createMonthlyResult();
      const beforeDeadline = buildSalaryPerformanceSourceRecords({
        asOf: '2026-06-17 10:00',
        formalResults: [pending],
        salaryMonthlyWorkflows: []
      });
      const afterDeadline = buildSalaryPerformanceSourceRecords({
        asOf: '2026-06-19 10:00',
        formalResults: [pending],
        salaryMonthlyWorkflows: []
      });
      const objected = createMonthlyResult({
        employeeResponse: {
          employeeId: 'employee-001',
          objectionReason: '任务计分有误',
          respondedAt: '2026-06-17 11:00',
          resultId: pending.id,
          resultVersion: 1,
          status: '有异议'
        }
      });
      const objectedRecords = buildSalaryPerformanceSourceRecords({
        asOf: '2026-06-19 10:00',
        formalResults: [objected],
        salaryMonthlyWorkflows: []
      });

      assertEqual(beforeDeadline.length, 0, 'pending result should not enter salary during feedback window');
      assertEqual(afterDeadline[0]?.prepayAmount, 600, 'expired result without objection should enter salary');
      assertEqual(objectedRecords.length, 0, 'active objection should block salary after the deadline');
    }
  },
  {
    name: 'PF-27 salary consumes monthly prepay and quarterly difference only',
    run() {
      const monthly = createMonthlyResult({
        employeeResponse: {
          employeeId: 'employee-001',
          respondedAt: '2026-06-16 10:00',
          resultId: 'monthly:employee-001:2026-06:绘图任务制:v1',
          resultVersion: 1,
          status: '已确认'
        }
      });
      const quarterly = createQuarterlyResult();
      const records = buildSalaryPerformanceSourceRecords({
        asOf: '2026-07-02 10:00',
        formalResults: [monthly, quarterly],
        salaryMonthlyWorkflows: []
      });
      const lines = buildSalaryPerformanceSettlementLines({
        performanceRecords: records,
        salaryMonthlyWorkflows: []
      });

      assertEqual(lines.length, 2, 'monthly and quarterly results should create two settlement lines');
      assertEqual(lines.find((line) => line.kind === '月度预发')?.amount, 600, 'monthly line should use prepay');
      assertEqual(lines.find((line) => line.kind === '季度复核差额')?.amount, 300, 'quarterly line should use final minus prepay');
    }
  },
  {
    name: 'PF-27 zero-amount formal results retain settlement references and can close with salary',
    run() {
      const monthly = createMonthlyResult({
        employeeResponse: {
          employeeId: 'employee-001',
          respondedAt: '2026-06-16 10:00',
          resultId: 'monthly:employee-001:2026-06:绘图任务制:v1',
          resultVersion: 1,
          status: '已确认'
        },
        monthlyAmount: 0,
        prepayAmount: 0
      });
      const quarterly = createQuarterlyResult({
        calculationSnapshot: {
          ...createQuarterlyResult().calculationSnapshot,
          quarterCalculatedAmount: 1500,
          quarterDifferenceAmount: 0,
          quarterFinalAmount: 1500,
          quarterPrepayAmount: 1500
        },
        quarterCalculatedAmount: 1500,
        quarterDifferenceAmount: 0,
        quarterFinalAmount: 1500,
        quarterPrepayAmount: 1500
      });
      const records = buildSalaryPerformanceSourceRecords({
        asOf: '2026-07-02 10:00',
        formalResults: [monthly, quarterly],
        salaryMonthlyWorkflows: []
      });
      const lines = buildSalaryPerformanceSettlementLines({
        performanceRecords: records,
        salaryMonthlyWorkflows: []
      });
      const settlement = settlePerformanceResults([monthly, quarterly], {
        actor: '李明',
        salarySettlementReferences: lines.map((line) => line.salarySettlementReference),
        settledAt: '2026-07-02 10:00'
      });

      assertEqual(records.length, 2, 'zero-amount formal results should remain visible to the salary consumer');
      assertEqual(lines.length, 2, 'monthly zero prepay and quarterly zero difference should each retain one reference');
      assert(lines.every((line) => line.amount === 0), 'zero-amount references must not change salary amounts');
      assert(settlement.success, 'salary should be able to close zero-amount formal results');
      assert(
        settlement.results.every((result) => result.lifecycleStatus === '已结算'),
        'zero-amount formal results should not remain published forever'
      );
    }
  },
  {
    name: 'PF-28 correction after salary confirmation creates a future-month difference',
    run() {
      const v1 = createMonthlyResult({
        employeeResponse: {
          employeeId: 'employee-001',
          respondedAt: '2026-06-16 10:00',
          resultId: 'monthly:employee-001:2026-06:绘图任务制:v1',
          resultVersion: 1,
          status: '已确认'
        },
        lifecycleStatus: '已结算'
      });
      const v2 = createMonthlyResult({
        employeeResponse: {
          employeeId: 'employee-001',
          respondedAt: '2026-07-02 10:00',
          resultId: 'monthly:employee-001:2026-06:绘图任务制:v2',
          resultVersion: 2,
          status: '已确认'
        },
        prepayAmount: 750,
        supersedesResultId: v1.id,
        version: 2
      });
      const workflow = createWorkflow({
        salarySettlementReferences: [v1.salarySettlementReference]
      });
      const records = buildSalaryPerformanceSourceRecords({
        asOf: '2026-07-02 12:00',
        formalResults: [v1, v2],
        salaryMonthlyWorkflows: [workflow]
      });
      const lines = buildSalaryPerformanceSettlementLines({
        performanceRecords: records,
        salaryMonthlyWorkflows: [workflow]
      });
      const originalLine = lines.find((line) => line.salarySettlementReference === v1.salarySettlementReference);
      const correctionLine = lines.find((line) => line.salarySettlementReference === v2.salarySettlementReference);

      assertEqual(originalLine?.amount, 600, 'claimed V1 should preserve the frozen historical amount');
      assertEqual(originalLine?.salaryMonth, '2026-06', 'claimed V1 should remain in its original salary month');
      assertEqual(correctionLine?.amount, 150, 'V2 should settle only the difference from claimed V1');
      assertEqual(correctionLine?.salaryMonth, '2026-07', 'confirmed June salary must not be rewritten');
      assertEqual(correctionLine?.deferredFromMonth, '2026-06', 'deferred line should retain the original month');
    }
  },
  {
    name: 'PF-28 quarterly V2 settles only its difference in the next unlocked salary month',
    run() {
      const v1 = createQuarterlyResult({ lifecycleStatus: '已结算' });
      const v2 = createQuarterlyResult({
        calculationSnapshot: {
          ...v1.calculationSnapshot,
          quarterCalculatedAmount: 2100,
          quarterDifferenceAmount: 450,
          quarterFinalAmount: 2100,
          quarterPrepayAmount: 1650
        },
        employeeResponse: {
          employeeId: 'employee-001',
          respondedAt: '2026-07-03 10:00',
          resultId: 'quarterly:employee-001:2026-Q2:绘图任务制:v2',
          resultVersion: 2,
          status: '已确认'
        },
        id: 'quarterly:employee-001:2026-Q2:绘图任务制:v2',
        quarterCalculatedAmount: 2100,
        quarterDifferenceAmount: 450,
        quarterFinalAmount: 2100,
        quarterPrepayAmount: 1650,
        salarySettlementReference: 'performance-result:quarterly:employee-001:2026-Q2:drawing:v2',
        sourceHash: 'quarter-source-hash-v2',
        supersedesResultId: v1.id,
        version: 2
      });
      const workflow = createWorkflow({
        salarySettlementReferences: [v1.salarySettlementReference]
      });
      const records = buildSalaryPerformanceSourceRecords({
        asOf: '2026-07-03 12:00',
        formalResults: [v1, v2],
        salaryMonthlyWorkflows: [workflow]
      });
      const lines = buildSalaryPerformanceSettlementLines({
        performanceRecords: records,
        salaryMonthlyWorkflows: [workflow]
      });
      const originalLine = lines.find((line) => line.salarySettlementReference === v1.salarySettlementReference);
      const correctionLine = lines.find((line) => line.salarySettlementReference === v2.salarySettlementReference);

      assertEqual(originalLine?.amount, 300, 'claimed quarterly V1 should preserve its frozen settlement amount');
      assertEqual(originalLine?.salaryMonth, '2026-06', 'claimed quarterly V1 should remain in June salary');
      assertEqual(correctionLine?.amount, 150, 'quarterly V2 should settle only the difference from V1');
      assertEqual(correctionLine?.salaryMonth, '2026-07', 'confirmed June salary must not be rewritten');
      assertEqual(correctionLine?.deferredFromMonth, '2026-06', 'quarterly V2 should retain its original month');
    }
  },
  {
    name: 'PF-27 salary confirmation settles only referenced formal results',
    run() {
      const monthly = createMonthlyResult({
        employeeResponse: {
          employeeId: 'employee-001',
          respondedAt: '2026-06-16 10:00',
          resultId: 'monthly:employee-001:2026-06:绘图任务制:v1',
          resultVersion: 1,
          status: '已确认'
        }
      });
      const quarterly = createQuarterlyResult();
      const outcome = settlePerformanceResults([monthly, quarterly], {
        actor: '李明',
        salarySettlementReferences: [monthly.salarySettlementReference],
        settledAt: '2026-06-30 10:00'
      });
      const nextMonthly = outcome.results.find((result) => result.id === monthly.id);
      const nextQuarterly = outcome.results.find((result) => result.id === quarterly.id);

      assert(outcome.success, 'valid references should settle successfully');
      assertEqual(nextMonthly?.lifecycleStatus, '已结算', 'referenced result should become settled');
      assertEqual(nextQuarterly?.lifecycleStatus, '已发布', 'unreferenced result should remain published');
      assertEqual(nextMonthly?.events.at(-1)?.action, '结算结果', 'settlement should keep an audit event');

      const missing = settlePerformanceResults([monthly], {
        actor: '李明',
        salarySettlementReferences: ['missing-reference'],
        settledAt: '2026-06-30 10:00'
      });

      assertEqual(missing.success, false, 'unknown references must block salary confirmation');

      const objected = createMonthlyResult({
        employeeResponse: {
          employeeId: 'employee-001',
          objectionReason: '任务计分有误',
          respondedAt: '2026-06-17 11:00',
          resultId: monthly.id,
          resultVersion: 1,
          status: '有异议'
        }
      });
      const objectedSettlement = settlePerformanceResults([objected], {
        actor: '李明',
        salarySettlementReferences: [objected.salarySettlementReference],
        settledAt: '2026-06-30 10:00'
      });

      assertEqual(objectedSettlement.success, false, 'active objection must block result settlement');
    }
  }
];

export function runSalaryPerformanceConsumptionModelTests(): UnitTestResult {
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

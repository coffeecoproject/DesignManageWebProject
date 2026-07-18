import {
  confirmPerformanceResult,
  getPerformanceEmployeeResponseAvailability,
  getPerformanceEmployeeResponseDisplayStatus,
  isPerformanceResultSalaryEligible,
  objectToPerformanceResult,
  resolvePerformanceResultObjection
} from './performanceResultResponseModel';
import type {
  PerformanceMonthlyCategoryRecord,
  PerformanceMonthlyResultSnapshot,
  PerformanceQuarterlyResultSnapshot
} from './performanceTypes';

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

function createCategoryRecord(): PerformanceMonthlyCategoryRecord {
  return {
    category: '绘图任务制',
    employeeName: '示例员工',
    events: [],
    id: 'task-performance:2026-06:employee-001:rule-001',
    monthlyAmount: 1200,
    note: '按任务验收结果自动计算。',
    performanceMonth: '2026-06',
    position: '空间设计师',
    prepayAmount: 600,
    qualityScore: 88,
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
    salarySettlementReference: 'performance-result:monthly:employee-001:2026-06:drawing:v1',
    sourceLabel: '任务验收',
    sourceRecordIds: ['task-score-001'],
    sourceTaskCount: 1,
    taskScore: 92,
    updatedAt: '2026-06-15 09:00:00',
    workNo: 'employee-001'
  };
}

function createMonthlyResult(
  overrides: Partial<PerformanceMonthlyResultSnapshot> = {}
): PerformanceMonthlyResultSnapshot {
  const categoryRecord = createCategoryRecord();
  const version = overrides.version ?? 1;
  const id = overrides.id ?? `monthly:employee-001:2026-06:绘图任务制:v${version}`;

  return {
    calculationSnapshot: { categoryRecord },
    deliveredAt: '2026-06-15 10:00:00',
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
    monthlyAmount: 1200,
    period: '2026-06',
    positionSnapshot: '空间设计师',
    prepayAmount: 600,
    publishedAt: '2026-06-15 10:00:00',
    publishedBy: '李明',
    responseDeadline: '2026-06-18 23:59:59',
    resultKey: 'monthly:employee-001:2026-06:绘图任务制',
    ruleId: 'rule-001',
    ruleNameSnapshot: '设计绩效规则',
    ruleVersion: 'V1',
    salarySettlementMonth: '2026-06',
    salarySettlementReference: `performance-result:monthly:employee-001:2026-06:drawing:v${version}`,
    sourceHash: `source-hash-v${version}`,
    sourceRecordIds: ['task-score-001'],
    version,
    workNoSnapshot: 'employee-001',
    ...overrides
  };
}

function createQuarterlyResult(
  overrides: Partial<PerformanceQuarterlyResultSnapshot> = {}
): PerformanceQuarterlyResultSnapshot {
  const version = overrides.version ?? 1;
  const id = overrides.id ?? `quarterly:employee-001:2026-Q2:绘图任务制:v${version}`;

  return {
    calculationSnapshot: {
      category: '绘图任务制',
      expectedMonths: ['2026-04', '2026-05', '2026-06'],
      missingMonths: [],
      unresolvedObjectionMonths: [],
      quarterAdjustmentAmount: 0,
      quarterCalculatedAmount: 3600,
      quarterClosed: true,
      quarterDifferenceAmount: 1800,
      quarterEndDate: '2026-06-30',
      quarterEvidenceFileIds: [],
      quarterFinalAmount: 3600,
      quarterPrepayAmount: 1800,
      salarySettlementMonth: '2026-06',
      sourceResults: []
    },
    deliveredAt: '2026-07-01 10:00:00',
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
    kind: '季度结果',
    lifecycleStatus: '已发布',
    period: '2026-Q2',
    positionSnapshot: '空间设计师',
    publishedAt: '2026-07-01 10:00:00',
    publishedBy: '李明',
    quarterAdjustmentAmount: 0,
    quarterCalculatedAmount: 3600,
    quarterDifferenceAmount: 1800,
    quarterEvidenceFileIds: [],
    quarterFinalAmount: 3600,
    quarterPrepayAmount: 1800,
    responseDeadline: '2026-07-06 23:59:59',
    resultKey: 'quarterly:employee-001:2026-Q2:绘图任务制',
    ruleId: 'rule-001',
    ruleNameSnapshot: '设计绩效规则',
    ruleVersion: 'V1',
    salarySettlementMonth: '2026-06',
    salarySettlementReference: `performance-result:quarterly:employee-001:2026-Q2:difference:v${version}`,
    sourceHash: `quarter-source-hash-v${version}`,
    sourceRecordIds: ['monthly-2026-04', 'monthly-2026-05', 'monthly-2026-06'],
    version,
    workNoSnapshot: 'employee-001',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'PF-16 employee confirms only the current own result without changing its amount',
    run() {
      const result = createMonthlyResult();
      const outcome = confirmPerformanceResult([result], result.id, {
        employeeId: 'employee-001',
        respondedAt: '2026-06-17 09:00:00'
      });

      assert(outcome.success && outcome.result, 'current employee should be able to confirm the result');
      assertEqual(outcome.result.employeeResponse.status, '已确认', 'response should become confirmed');
      assertEqual(outcome.result.employeeResponse.respondedAt, '2026-06-17 09:00:00', 'response time should be recorded');
      assertEqual(outcome.result.employeeResponse.resultVersion, 1, 'confirmed response should remain bound to V1');
      assertEqual(outcome.result.kind === '月度结果' ? outcome.result.monthlyAmount : 0, 1200, 'confirmation must not change result amount');
      assertEqual(outcome.result.events.at(-1)?.action, '确认结果', 'confirmation event should be appended');
    }
  },
  {
    name: 'PF-17 employee objection requires a reason and cannot edit the result amount',
    run() {
      const result = createMonthlyResult();
      const missingReason = objectToPerformanceResult([result], result.id, {
        employeeId: 'employee-001',
        objectionReason: '   ',
        respondedAt: '2026-06-17 09:00:00'
      });

      assertEqual(missingReason.success, false, 'blank objection reason should be rejected');
      const outcome = objectToPerformanceResult([result], result.id, {
        employeeId: 'employee-001',
        evidenceFileIds: ['evidence-001', 'evidence-001'],
        objectionReason: '任务验收记录缺少一项',
        respondedAt: '2026-06-17 09:30:00'
      });

      assert(outcome.success && outcome.result, 'reasoned objection should be accepted');
      assertEqual(outcome.result.employeeResponse.status, '有异议', 'response should become objected');
      assertEqual(outcome.result.employeeResponse.evidenceFileIds?.length, 1, 'duplicate evidence should be removed');
      assertEqual(outcome.result.kind === '月度结果' ? outcome.result.monthlyAmount : 0, 1200, 'objection must not change result amount');
      assertEqual(outcome.result.lifecycleStatus, '已发布', 'objection must not introduce an approval lifecycle');
    }
  },
  {
    name: 'PF-18 another employee and a superseded result version cannot be responded to',
    run() {
      const current = createMonthlyResult();
      const otherEmployee = confirmPerformanceResult([current], current.id, {
        employeeId: 'employee-002',
        respondedAt: '2026-06-17 09:00:00'
      });

      assertEqual(otherEmployee.success, false, 'another employee must not confirm the result');
      const oldVersion = createMonthlyResult({
        id: 'monthly:employee-001:2026-06:绘图任务制:v1',
        lifecycleStatus: '已更正',
        supersededByResultId: 'monthly:employee-001:2026-06:绘图任务制:v2',
        version: 1
      });
      const currentVersion = createMonthlyResult({
        id: 'monthly:employee-001:2026-06:绘图任务制:v2',
        supersedesResultId: oldVersion.id,
        version: 2
      });
      const oldVersionResponse = confirmPerformanceResult([oldVersion, currentVersion], oldVersion.id, {
        employeeId: 'employee-001',
        respondedAt: '2026-06-17 09:00:00'
      });

      assertEqual(oldVersionResponse.success, false, 'superseded V1 must not accept employee feedback');
      assertEqual(oldVersion.employeeResponse.status, '待确认', 'rejected response must not mutate V1');
    }
  },
  {
    name: 'PF-19 pending result is blocked during feedback and becomes salary-eligible after deadline',
    run() {
      const result = createMonthlyResult();
      const withinWindow = getPerformanceEmployeeResponseAvailability(
        [result],
        result.id,
        'employee-001',
        '2026-06-18 12:00:00'
      );

      assertEqual(withinWindow.allowed, true, 'employee should be able to respond before the frozen deadline');
      assertEqual(isPerformanceResultSalaryEligible([result], result.id, '2026-06-18 12:00:00'), false, 'pending result should not enter salary during feedback');
      assertEqual(
        getPerformanceEmployeeResponseDisplayStatus(result, '2026-06-19 00:00:00'),
        '已送达未反馈',
        'expired pending response should be derived as delivered without feedback'
      );
      assertEqual(isPerformanceResultSalaryEligible([result], result.id, '2026-06-19 00:00:00'), true, 'no-objection result should enter salary after deadline');
      const expiredResponse = confirmPerformanceResult([result], result.id, {
        employeeId: 'employee-001',
        respondedAt: '2026-06-19 00:00:00'
      });

      assertEqual(expiredResponse.success, false, 'employee feedback must close after the deadline');
    }
  },
  {
    name: 'PF-20 open objection blocks performance salary until management maintains the result',
    run() {
      const result = createMonthlyResult();
      const objection = objectToPerformanceResult([result], result.id, {
        employeeId: 'employee-001',
        objectionReason: '任务数量不一致',
        respondedAt: '2026-06-17 09:30:00'
      });

      assert(objection.success && objection.result, 'objection fixture should be created');
      assertEqual(isPerformanceResultSalaryEligible(objection.results, result.id, '2026-06-20 09:00:00'), false, 'open objection should block this performance result');
      const resolution = resolvePerformanceResultObjection(objection.results, result.id, {
        actor: '李明',
        resolutionSummary: '已核对验收记录，维持当前结果',
        resolvedAt: '2026-06-20 10:00:00'
      });

      assert(resolution.success && resolution.result, 'management should be able to maintain the current result');
      assertEqual(resolution.result.employeeResponse.status, '异议已处理', 'objection should be closed without adding approval state');
      assertEqual(resolution.result.employeeResponse.resolvedBy, '李明', 'resolver should be recorded');
      assertEqual(isPerformanceResultSalaryEligible(resolution.results, result.id, '2026-06-20 10:01:00'), true, 'resolved result should be salary-eligible');
    }
  },
  {
    name: 'PF-26 quarterly result reuses the same confirmation and objection contract',
    run() {
      const confirmedQuarter = createQuarterlyResult();
      const confirmation = confirmPerformanceResult([confirmedQuarter], confirmedQuarter.id, {
        employeeId: 'employee-001',
        respondedAt: '2026-07-03 10:00:00'
      });

      assert(confirmation.success && confirmation.result, 'quarterly result should support employee confirmation');
      assertEqual(confirmation.result.employeeResponse.status, '已确认', 'quarterly response should become confirmed');
      assertEqual(
        confirmation.result.kind === '季度结果' ? confirmation.result.quarterDifferenceAmount : 0,
        1800,
        'quarterly confirmation must not change settlement difference'
      );
      const objectedQuarter = createQuarterlyResult({ id: 'quarterly:employee-001:2026-Q2:绘图任务制:objection-v1' });
      const objection = objectToPerformanceResult([objectedQuarter], objectedQuarter.id, {
        employeeId: 'employee-001',
        objectionReason: '季度调整依据不完整',
        respondedAt: '2026-07-03 11:00:00'
      });

      assert(objection.success && objection.result, 'quarterly result should support employee objection');
      assertEqual(objection.result.employeeResponse.status, '有异议', 'quarterly response should become objected');
    }
  }
];

export function runPerformanceResultWorkflowTests(): UnitTestResult {
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

import { peopleMembers } from '../people/mockData';
import type {
  StoreTaskRecord,
  TaskPerformanceScoringRecord
} from '../tasks/TaskManagementState';
import { performanceRulePresets } from './performanceMockData';
import {
  buildTaskPerformanceMonthlySourceRecords,
  getTaskPerformanceSourceMonths
} from './taskPerformanceMonthlySourceModel';
import type { PerformanceRulePreset } from './performanceTypes';

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

function requireFixture<T>(value: T | undefined, message: string): T {
  if (!value) {
    throw new Error(message);
  }

  return value;
}
const fullTimeMember = requireFixture(
  peopleMembers.find((member) => member.id === '20250018'),
  'Full-time performance source test member is missing.'
);
const currentDemoMember = requireFixture(
  peopleMembers.find((member) => member.id === '20260001'),
  'Current demo performance member is missing.'
);
const partTimeMember = requireFixture(
  peopleMembers.find((member) => member.personnelType === '兼职'),
  'Part-time performance source test member is missing.'
);
const drawingRule = requireFixture(
  performanceRulePresets.find((rule) => rule.currentVersion === 'V1'),
  'Published V1 drawing rule is missing.'
);

function createTask(overrides: Partial<StoreTaskRecord> = {}): StoreTaskRecord {
  return {
    acceptedAt: '2026-06-18 16:00',
    acceptorId: '20260001',
    acceptorName: '验收人',
    brandId: 'brand-performance-test',
    code: 'TASK-PERF-001',
    createdAt: '2026-06-10 09:00',
    customerId: 'customer-performance-test',
    executorId: fullTimeMember.id,
    executorName: fullTimeMember.name,
    files: [],
    id: 'task-performance-001',
    name: '绩效来源测试任务',
    note: '',
    operationRecords: [],
    plannedDeliveryAt: '2026-06-18 18:00',
    plannedDurationHours: 64,
    reworkCount: 0,
    status: '已完成',
    storeId: 'store-performance-test',
    submittedAt: '2026-06-18 15:00',
    taskConfigId: 'task-type-floor-plan',
    updatedAt: '2026-06-18 16:00',
    ...overrides
  };
}

function createScoring(
  taskId: string,
  overrides: Partial<TaskPerformanceScoringRecord> = {}
): TaskPerformanceScoringRecord {
  return {
    adjustmentReason: '',
    confirmedAt: '2026-06-18 16:00',
    confirmedBy: '验收人',
    id: `score-${taskId}`,
    operationRecords: [
      {
        action: '验收计分',
        actor: '验收人',
        id: `op-${taskId}`,
        object: taskId,
        summary: '验收完成并计入绩效',
        time: '2026-06-18 16:00'
      }
    ],
    performanceCategory: '绘图任务制',
    qualityBand: '80-89分',
    qualityDimensionScores: [
      { id: 'quality', maxScore: 40, name: '成果有效性与质量', score: 32 },
      { id: 'timeliness', maxScore: 25, name: '交付时效', score: 20 },
      { id: 'workflow', maxScore: 25, name: '流程闭环', score: 22 },
      { id: 'collaboration', maxScore: 10, name: '项目配合与沟通归档', score: 8 }
    ],
    qualityScore: 1,
    ruleId: drawingRule.id,
    ruleName: drawingRule.name,
    ruleVersion: drawingRule.currentVersion,
    scoreItemId: 'space-plan',
    scoreItemName: '平面方案',
    scoreValue: 3.4,
    sourceMonth: '2026-06',
    status: '已计入',
    taskId,
    updatedAt: '2026-06-18 16:00',
    ...overrides
  };
}

function buildRecords({
  people = [fullTimeMember],
  ruleRows = performanceRulePresets,
  scoringRows = [],
  taskRows = []
}: {
  people?: typeof peopleMembers;
  ruleRows?: PerformanceRulePreset[];
  scoringRows?: TaskPerformanceScoringRecord[];
  taskRows?: StoreTaskRecord[];
} = {}) {
  return buildTaskPerformanceMonthlySourceRecords({
    peopleRows: people,
    performanceMonths: ['2026-06'],
    ruleRows,
    scoringRows,
    taskRows
  });
}

const tests: UnitTest[] = [
  {
    name: 'PF-MOCK derives the current demo account result from accepted-task evidence',
    run() {
      const task = createTask({
        acceptedAt: '2026-06-07 16:30',
        acceptorId: fullTimeMember.id,
        acceptorName: fullTimeMember.name,
        executorId: currentDemoMember.id,
        executorName: currentDemoMember.name,
        id: 'store-task-2026-008',
        taskConfigId: 'task-type-full-drawing',
        updatedAt: '2026-06-07 16:30'
      });
      const scoring = createScoring(task.id, {
        confirmedAt: '2026-06-07 16:30',
        confirmedBy: fullTimeMember.name,
        operationRecords: [
          {
            action: '验收计分',
            actor: fullTimeMember.name,
            id: 'op-score-store-task-2026-008-create',
            object: task.name,
            summary: '绘图任务制V1 / 全套施工图 / 质量分 88',
            time: '2026-06-07 16:30'
          }
        ],
        qualityDimensionScores: [
          { id: 'quality', maxScore: 40, name: '成果有效性与质量', score: 35 },
          { id: 'timeliness', maxScore: 25, name: '交付时效', score: 22 },
          { id: 'workflow', maxScore: 25, name: '流程闭环', score: 22 },
          { id: 'collaboration', maxScore: 10, name: '项目配合与沟通归档', score: 9 }
        ],
        qualityScore: 88,
        scoreItemId: 'construction-drawing',
        scoreItemName: '全套施工图',
        scoreValue: 2.2,
        updatedAt: '2026-06-07 16:30'
      });
      const records = buildRecords({
        people: [currentDemoMember],
        scoringRows: [scoring],
        taskRows: [task]
      });
      const record = records[0];

      assert(record, 'current demo account should receive a source-derived monthly record');
      assertEqual(record.workNo, currentDemoMember.id, 'result should remain bound to the current account work number');
      assertEqual(record.sourceTaskCount, 1, 'accepted task should be the only source fact');
      assertEqual(record.sourceRecordIds.join(','), scoring.id, 'formal source identity should come from acceptance scoring');
      assertEqual(record.taskScore, 2.2, 'task score should come from the matched rule item');
      assertEqual(record.qualityScore, 88, 'quality score should be recalculated from dimension evidence');
    }
  },
  {
    name: 'PF-08 keeps one source fact when the same accepted task has duplicate scoring rows',
    run() {
      const task = createTask();
      const records = buildRecords({
        scoringRows: [
          createScoring(task.id, { id: 'score-older', updatedAt: '2026-06-18 16:00' }),
          createScoring(task.id, {
            adjustmentReason: '按验收有效工作量调整',
            id: 'score-newer',
            scoreValue: 4,
            updatedAt: '2026-06-18 17:00'
          })
        ],
        taskRows: [task]
      });
      const record = records[0];

      assert(record, 'accepted task should generate a monthly record');
      assertEqual(records.length, 1, 'one employee and month should generate one monthly record');
      assertEqual(record.sourceTaskCount, 1, 'duplicate scoring rows must not duplicate the task count');
      assertEqual(record.sourceRecordIds.join(','), 'score-newer', 'latest scoring fact should be retained');
      assertEqual(record.taskScore, 4, 'task score should be counted once from the retained fact');
      assertEqual(record.qualityScore, 82, 'quality score should be recomputed from dimensions and weights');
    }
  },
  {
    name: 'PF-09 excludes unaccepted, rejected, stopped and part-time tasks',
    run() {
      const waitingTask = createTask({ acceptedAt: undefined, id: 'task-waiting', status: '待验收' });
      const rejectedTask = createTask({ acceptedAt: undefined, id: 'task-rejected', status: '验收驳回' });
      const stoppedTask = createTask({ acceptedAt: undefined, id: 'task-stopped', status: '已中止' });
      const partTimeTask = createTask({
        executorId: partTimeMember.id,
        executorName: partTimeMember.name,
        id: 'task-part-time'
      });
      const records = buildRecords({
        people: [fullTimeMember, partTimeMember],
        scoringRows: [waitingTask, rejectedTask, stoppedTask, partTimeTask].map((task) => createScoring(task.id)),
        taskRows: [waitingTask, rejectedTask, stoppedTask, partTimeTask]
      });
      const fullTimeRecord = records.find((record) => record.workNo === fullTimeMember.id);

      assert(fullTimeRecord, 'eligible full-time employee should still receive a zero-task draft');
      assertEqual(fullTimeRecord.sourceTaskCount, 0, 'invalid task states must not enter the monthly source');
      assertEqual(fullTimeRecord.sourceRecordIds.length, 0, 'invalid task states must not retain source identities');
      assertEqual(
        records.some((record) => record.workNo === partTimeMember.id),
        false,
        'part-time task settlements must not enter full-time task performance'
      );
    }
  },
  {
    name: 'PF-09B excludes scoring facts without complete acceptance evidence',
    run() {
      const task = createTask();
      const records = buildRecords({
        scoringRows: [
          createScoring(task.id, {
            confirmedBy: undefined,
            operationRecords: []
          })
        ],
        taskRows: [task]
      });

      assertEqual(records[0]?.sourceTaskCount, 0, 'scoring without confirmer and acceptance event must not be aggregated');
    }
  },
  {
    name: 'PF-12 creates a zero-score zero-amount draft for an applicable employee with no tasks',
    run() {
      const sourceMonths = getTaskPerformanceSourceMonths(performanceRulePresets, '2026-06-30');
      const records = buildRecords();
      const record = records[0];

      assertEqual(sourceMonths.join(','), '2026-06', 'published rule periods should create the current zero-task month');
      assert(record, 'applicable employee should receive a monthly draft even without tasks');
      assertEqual(record.taskScore, 0, 'zero-task draft should have zero task score');
      assertEqual(record.qualityScore, 0, 'zero-task draft should have zero quality score');
      assertEqual(record.monthlyAmount, 0, 'zero-task draft should have zero monthly amount');
      assertEqual(record.prepayAmount, 0, 'zero-task draft should have zero prepay amount');
      assertEqual(record.sourceRecordIds.length, 0, 'zero-task draft should not invent source facts');
    }
  },
  {
    name: 'PF-13 does not generate unsupported duty or project-bonus categories',
    run() {
      const dutyRule: PerformanceRulePreset = {
        ...drawingRule,
        category: '岗位职责考核',
        id: 'unsupported-duty-rule',
        name: '岗位职责考核V1'
      };
      const bonusRule: PerformanceRulePreset = {
        ...drawingRule,
        category: '项目奖金',
        id: 'unsupported-project-bonus-rule',
        name: '项目奖金V1'
      };
      const withoutDrawing = buildRecords({ ruleRows: [dutyRule, bonusRule] });
      const withDrawing = buildRecords({ ruleRows: [drawingRule, dutyRule, bonusRule] });

      assertEqual(withoutDrawing.length, 0, 'unsupported categories alone must not create monthly records');
      assertEqual(withDrawing.length, 1, 'unsupported categories must not add extra monthly records');
      assertEqual(withDrawing[0]?.category, '绘图任务制', 'the only generated category should be drawing-task performance');
    }
  }
];

export function runTaskPerformanceMonthlySourceModelTests(): UnitTestResult {
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

import {
  buildMonthlyPerformanceResultDraft,
  buildPerformanceResultReadModel,
  correctPerformanceResult,
  getPerformanceResultHistory,
  getPublishedPerformanceResultRecords,
  isMonthlyPerformanceResult,
  publishPerformanceResult
} from './performanceResultModel';
import type {
  PerformanceDrawingTaskMonthlyRecord,
  PerformanceMonthlyCategoryRecord
} from './performanceTypes';
import type { PerformanceResponseDeadline } from './performanceResultDeadlineModel';
import type { PeopleMember } from '../people/peopleTypes';
import type { WorkCalendarRow } from '../system/WorkCalendarState';
import { buildPerformanceResultMockBootstrap } from './performanceResultMockBootstrapModel';

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
  overrides: Partial<PerformanceMonthlyCategoryRecord> = {}
): PerformanceMonthlyCategoryRecord {
  return {
    category: '绘图任务制',
    employeeName: '陈浩',
    events: [],
    id: 'task-performance:2026-06:20250018:perf-rule-space-design-2026-final',
    monthlyAmount: 1200,
    note: '按有效任务验收计分。',
    performanceMonth: '2026-06',
    position: '财务专员',
    prepayAmount: 600,
    qualityScore: 88,
    ruleApplicability: {
      applicablePositions: ['财务专员'],
      category: '绘图任务制',
      note: '已按人员岗位和规则生效期自动匹配。',
      position: '财务专员',
      ruleId: 'perf-rule-space-design-2026-final',
      ruleName: '绘图任务制V1',
      ruleVersion: 'V1',
      status: '适用',
      workNo: '20250018'
    },
    ruleName: '绘图任务制V1',
    ruleVersion: 'V1',
    salarySettlementReference:
      'performance-result:task-performance:2026-06:20250018:perf-rule-space-design-2026-final:monthly-prepay:v1',
    sourceLabel: '任务验收',
    sourceRecordIds: ['task-score-001'],
    sourceTaskCount: 1,
    taskScore: 92,
    updatedAt: '2026-06-15 10:00',
    workNo: '20250018',
    ...overrides
  };
}

function createDrawingRecord(
  overrides: Partial<PerformanceDrawingTaskMonthlyRecord> = {}
): PerformanceDrawingTaskMonthlyRecord {
  const categoryRecord = createCategoryRecord(overrides);

  return {
    ...categoryRecord,
    amountSummary: {
      baseAmount: 1200,
      baseQualityRatio: 1,
      confirmedBaseScore: 80,
      excessAmount: 0,
      excessMultiplier: 1,
      excessQualityRatio: 1,
      excessScore: 12,
      monthlyAmount: categoryRecord.monthlyAmount,
      pointValue: 25,
      prepayAmount: categoryRecord.prepayAmount,
      prepayRatio: 0.5,
      settlementNote: '季度结果发布后随薪酬结算差额。',
      taskConfirmRatio: 1
    },
    baseQualityRatio: 1,
    category: '绘图任务制',
    excessQualityRatio: 1,
    qualityBand: '达标',
    qualityScore: categoryRecord.qualityScore ?? 0,
    qualitySummaries: [],
    taskScore: categoryRecord.taskScore ?? 0,
    taskSummaries: [],
    ...overrides
  };
}

const responseDeadline: PerformanceResponseDeadline = {
  calendarSnapshot: {
    alternateWorkdays: [],
    code: 'CAL-DEFAULT',
    exceptionItems: [],
    fixedWorkdays: ['周一', '周二', '周三', '周四', '周五'],
    id: 'calendar-default',
    name: '公司默认工作日历',
    ruleVersionIds: ['calendar-default-v1'],
    type: '双休',
    updatedAt: '2026-01-01 09:00'
  },
  deadlineAt: '2026-06-18 23:59:59',
  deadlineDate: '2026-06-18',
  deliveredDate: '2026-06-15',
  workingDates: ['2026-06-16', '2026-06-17', '2026-06-18']
};

const bootstrapCalendar: WorkCalendarRow = {
  alternateWorkdays: [],
  code: 'CAL-BOOTSTRAP-001',
  fixedWorkdays: ['周一', '周二', '周三', '周四', '周五'],
  id: 'calendar-bootstrap',
  isDefault: true,
  name: '演示工作日历',
  note: '',
  status: '启用',
  type: '双休',
  updatedAt: '2026-06-01'
};

const tests: UnitTest[] = [
  {
    name: 'PF-32 bootstraps the current demo employee from task-backed source as a formal result',
    run() {
      const record = createDrawingRecord({
        employeeName: '李明',
        position: 'CEO',
        ruleApplicability: {
          applicablePositions: ['CEO'],
          category: '绘图任务制',
          note: '已按人员岗位和规则生效期自动匹配。',
          position: 'CEO',
          ruleId: 'perf-rule-space-design-2026-final',
          ruleName: '绘图任务制V1',
          ruleVersion: 'V1',
          status: '适用',
          workNo: '20260001'
        },
        sourceRecordIds: ['score-store-task-2026-008'],
        sourceTaskCount: 1,
        workNo: '20260001'
      });
      const member = {
        id: '20260001',
        name: '李明',
        personnelType: '全职',
        position: 'CEO',
        status: '在职',
        workCalendarId: bootstrapCalendar.id
      } as PeopleMember;
      const outcome = buildPerformanceResultMockBootstrap({
        actor: '李明',
        annualExceptionRows: [],
        deliveredAt: '2026-07-17 09:00:00',
        drawingTaskRecords: [record],
        employeeId: member.id,
        monthlyRecords: [record],
        peopleRows: [member],
        workCalendarRows: [bootstrapCalendar]
      });
      const result = outcome.results[0];

      assert(outcome.success && result, 'source-backed demo result should publish during state bootstrap');
      assertEqual(result.employeeId, member.id, 'bootstrap must only publish the requested demo employee');
      assertEqual(result.lifecycleStatus, '已发布', 'employee page must receive a formal result');
      assertEqual(result.sourceRecordIds[0], 'score-store-task-2026-008', 'published result must retain task scoring evidence');
      assertEqual(result.employeeResponse.status, '待确认', 'published demo result should enter employee feedback');
      assertEqual(result.responseDeadline, '2026-07-22 23:59:59', 'deadline should retain three working days');
    }
  },
  {
    name: 'PF-14 recomputes an unpublished draft without creating formal history',
    run() {
      const original = createDrawingRecord();
      const changed = createDrawingRecord({
        monthlyAmount: 1500,
        prepayAmount: 750,
        sourceRecordIds: ['task-score-001', 'task-score-002'],
        sourceTaskCount: 2,
        updatedAt: '2026-06-16 10:00'
      });
      const originalDraft = buildMonthlyPerformanceResultDraft({ drawingTaskRecord: original, record: original });
      const changedDraft = buildMonthlyPerformanceResultDraft({ drawingTaskRecord: changed, record: changed });

      assertEqual(originalDraft.id, changedDraft.id, 'draft identity should remain stable before publication');
      assertEqual(originalDraft.version, 1, 'the first draft should remain V1');
      assertEqual(changedDraft.version, 1, 'recalculated draft should not create a new version');
      assertEqual(changedDraft.monthlyAmount, 1500, 'recalculated draft should use the current amount');
      assert(
        originalDraft.sourceHash !== changedDraft.sourceHash,
        'source hash should change when effective source and amount change'
      );
      const liveReadResult = buildPerformanceResultReadModel({
        drawingTaskRecords: [changed],
        formalResults: [],
        monthlyRecords: [changed]
      })[0]?.result;

      assert(liveReadResult && isMonthlyPerformanceResult(liveReadResult), 'live read result should remain monthly');
      assertEqual(liveReadResult.monthlyAmount, 1500, 'read model should expose the latest live draft');
      assertEqual(
        getPublishedPerformanceResultRecords(
          buildPerformanceResultReadModel({
            drawingTaskRecords: [changed],
            formalResults: [],
            monthlyRecords: [changed]
          })
        ).length,
        0,
        'an unpublished draft must not enter dashboard or people-summary consumers'
      );
    }
  },
  {
    name: 'PF-15 publishes an immutable monthly result snapshot with delivery evidence',
    run() {
      const record = createDrawingRecord();
      const draft = buildMonthlyPerformanceResultDraft({ drawingTaskRecord: record, record });
      const outcome = publishPerformanceResult([], draft, {
        actor: '李明',
        deliveredAt: '2026-06-15 10:00',
        responseDeadline
      });

      assert(outcome.success && outcome.result, 'draft should publish successfully');
      assert(isMonthlyPerformanceResult(outcome.result), 'monthly publication should return a monthly result');
      assertEqual(outcome.result.lifecycleStatus, '已发布', 'published result should use published lifecycle');
      assertEqual(outcome.result.publishedBy, '李明', 'publisher should be frozen');
      assertEqual(outcome.result.responseDeadline, '2026-06-18 23:59:59', 'response deadline should be frozen');
      assertEqual(
        outcome.result.responseDeadlineSnapshot?.calendarSnapshot.id,
        'calendar-default',
        'calendar snapshot should be retained'
      );
      assertEqual(
        outcome.result.salarySettlementReference,
        'performance-result:monthly:20250018:2026-06:绘图任务制:monthly-prepay:v1',
        'published V1 should freeze a unique salary reference'
      );
      record.monthlyAmount = 9999;
      assertEqual(
        outcome.result.calculationSnapshot.categoryRecord.monthlyAmount,
        1200,
        'published calculation snapshot must not follow later source mutation'
      );
    }
  },
  {
    name: 'published read model keeps the frozen result and reports later source drift',
    run() {
      const original = createDrawingRecord();
      const draft = buildMonthlyPerformanceResultDraft({ drawingTaskRecord: original, record: original });
      const published = publishPerformanceResult([], draft, {
        actor: '李明',
        deliveredAt: '2026-06-15 10:00',
        responseDeadline
      }).result;
      const changed = createDrawingRecord({
        id: 'task-performance:2026-06:20250018:corrected-rule',
        monthlyAmount: 1800,
        prepayAmount: 900,
        ruleApplicability: {
          applicablePositions: ['财务专员'],
          category: '绘图任务制',
          note: '已按人员岗位和规则生效期自动匹配。',
          position: '财务专员',
          ruleId: 'corrected-rule',
          ruleName: '绘图任务制V2',
          ruleVersion: 'V2',
          status: '适用',
          workNo: '20250018'
        },
        ruleName: '绘图任务制V2',
        ruleVersion: 'V2',
        updatedAt: '2026-06-16 11:00'
      });

      assert(published, 'published fixture should exist');
      assert(isMonthlyPerformanceResult(published), 'published fixture should remain monthly');
      const readRecord = buildPerformanceResultReadModel({
        drawingTaskRecords: [changed],
        formalResults: [published],
        monthlyRecords: [changed]
      })[0];

      assert(readRecord, 'published read record should exist');
      assert(isMonthlyPerformanceResult(readRecord.result), 'published read record should remain monthly');
      assertEqual(
        buildPerformanceResultReadModel({
          drawingTaskRecords: [changed],
          formalResults: [published],
          monthlyRecords: [changed]
        }).length,
        1,
        'a changed rule/source record id must stay in the same employee-month-category result lineage'
      );
      assertEqual(readRecord.result.monthlyAmount, 1200, 'current formal view should keep the frozen amount');
      assertEqual(readRecord.sourceChangedSincePublish, true, 'source drift should be explicit');
      assertEqual(
        getPublishedPerformanceResultRecords([readRecord])[0]?.monthlyAmount,
        1200,
        'downstream published read model should consume the frozen amount'
      );
    }
  },
  {
    name: 'correction creates V2 and preserves V1 as corrected history',
    run() {
      const original = createDrawingRecord();
      const draft = buildMonthlyPerformanceResultDraft({ drawingTaskRecord: original, record: original });
      const published = publishPerformanceResult([], draft, {
        actor: '李明',
        deliveredAt: '2026-06-15 10:00',
        responseDeadline
      }).result;
      const changed = createDrawingRecord({
        monthlyAmount: 1800,
        prepayAmount: 900,
        sourceRecordIds: ['task-score-001', 'task-score-002'],
        sourceTaskCount: 2,
        updatedAt: '2026-06-16 11:00'
      });

      assert(published, 'published fixture should exist');
      assert(isMonthlyPerformanceResult(published), 'published fixture should remain monthly');
      const outcome = correctPerformanceResult([published], published, changed, changed, {
        actor: '李明',
        correctionReason: '补入迟到的有效任务验收记录',
        deliveredAt: '2026-06-16 12:00',
        responseDeadline
      });

      assert(outcome.success && outcome.result, 'correction should create a new result');
      assert(isMonthlyPerformanceResult(outcome.result), 'monthly correction should return a monthly result');
      assertEqual(outcome.result.version, 2, 'corrected result should be V2');
      assertEqual(outcome.result.monthlyAmount, 1800, 'V2 should freeze the corrected source amount');
      assertEqual(outcome.result.supersedesResultId, published.id, 'V2 should link to V1');
      assertEqual(
        outcome.result.salarySettlementReference,
        'performance-result:monthly:20250018:2026-06:绘图任务制:monthly-prepay:v2',
        'V2 should receive a new salary reference'
      );
      const history = getPerformanceResultHistory(published.resultKey, outcome.results);

      assertEqual(history.length, 2, 'history should retain both formal versions');
      assertEqual(history[0]?.lifecycleStatus, '已发布', 'V2 should be the current published result');
      assertEqual(history[1]?.lifecycleStatus, '已更正', 'V1 should remain as corrected history');
      const previousResult = history[1];

      assert(previousResult && isMonthlyPerformanceResult(previousResult), 'V1 history should remain monthly');
      assertEqual(previousResult.monthlyAmount, 1200, 'V1 amount must remain unchanged');
      const correctedReadModel = buildPerformanceResultReadModel({
        drawingTaskRecords: [changed],
        formalResults: outcome.results,
        monthlyRecords: [changed]
      });
      const currentPublishedRows = getPublishedPerformanceResultRecords(correctedReadModel);

      assertEqual(correctedReadModel.length, 1, 'correction must keep one current result per employee-month-category');
      assertEqual(currentPublishedRows.length, 1, 'downstream consumers must receive only the current formal version');
      assertEqual(currentPublishedRows[0]?.monthlyAmount, 1800, 'downstream consumers should receive the corrected V2 amount');
    }
  },
  {
    name: 'correction after salary settlement preserves V1 as settled history',
    run() {
      const original = createDrawingRecord();
      const draft = buildMonthlyPerformanceResultDraft({ drawingTaskRecord: original, record: original });
      const published = publishPerformanceResult([], draft, {
        actor: '李明',
        deliveredAt: '2026-06-15 10:00',
        responseDeadline
      }).result;
      const changed = createDrawingRecord({
        monthlyAmount: 1500,
        prepayAmount: 750,
        sourceRecordIds: ['task-score-001', 'task-score-002'],
        sourceTaskCount: 2,
        updatedAt: '2026-07-01 11:00'
      });

      assert(published, 'published fixture should exist');
      assert(isMonthlyPerformanceResult(published), 'published fixture should remain monthly');
      const settled = { ...published, lifecycleStatus: '已结算' as const };
      const outcome = correctPerformanceResult([settled], settled, changed, changed, {
        actor: '李明',
        correctionReason: '结算后补入有效任务验收记录',
        deliveredAt: '2026-07-01 12:00',
        responseDeadline
      });
      const history = getPerformanceResultHistory(settled.resultKey, outcome.results);

      assert(outcome.success && outcome.result, 'settled result should support source-backed correction');
      assertEqual(history[0]?.lifecycleStatus, '已发布', 'V2 should be redelivered for employee feedback');
      assertEqual(history[1]?.lifecycleStatus, '已结算', 'V1 should retain its historical settlement fact');
      assertEqual(history[0]?.supersedesResultId, settled.id, 'V2 should link to the settled V1');
    }
  },
  {
    name: 'source-backed correction closes the old objection and redelivers V2 for employee feedback',
    run() {
      const original = createDrawingRecord();
      const draft = buildMonthlyPerformanceResultDraft({ drawingTaskRecord: original, record: original });
      const published = publishPerformanceResult([], draft, {
        actor: '李明',
        deliveredAt: '2026-06-15 10:00',
        responseDeadline
      }).result;
      const changed = createDrawingRecord({
        monthlyAmount: 1800,
        prepayAmount: 900,
        sourceRecordIds: ['task-score-001', 'task-score-002'],
        sourceTaskCount: 2,
        updatedAt: '2026-06-16 11:00'
      });

      assert(published, 'published fixture should exist');
      assert(isMonthlyPerformanceResult(published), 'published fixture should remain monthly');
      const objected = {
        ...published,
        employeeResponse: {
          ...published.employeeResponse,
          objectionReason: '任务验收记录缺少一项',
          respondedAt: '2026-06-16 09:00',
          status: '有异议' as const
        }
      };
      const outcome = correctPerformanceResult([objected], objected, changed, changed, {
        actor: '李明',
        correctionReason: '补入已核实的任务验收记录',
        deliveredAt: '2026-06-16 12:00',
        responseDeadline
      });

      assert(outcome.success && outcome.result, 'source-backed objection correction should publish V2');
      assertEqual(outcome.result.version, 2, 'corrected result should be V2');
      assertEqual(outcome.result.employeeResponse.status, '待确认', 'V2 should require a new employee response');
      assertEqual(outcome.result.employeeResponse.resultVersion, 2, 'V2 response should bind to the new version');
      const history = getPerformanceResultHistory(objected.resultKey, outcome.results);
      const previousResult = history.find((result) => result.id === objected.id);

      assert(previousResult, 'V1 should remain in result history');
      assertEqual(previousResult.lifecycleStatus, '已更正', 'V1 should be retained as corrected history');
      assertEqual(previousResult.employeeResponse.status, '异议已处理', 'V1 objection should be closed by the correction');
      assertEqual(previousResult.employeeResponse.resolvedBy, '李明', 'V1 should record the correction actor');
      assertEqual(
        previousResult.employeeResponse.resolutionSummary,
        '已生成 V2 更正结果：补入已核实的任务验收记录',
        'V1 should record how the objection was resolved'
      );
    }
  },
  {
    name: 'correction rejects an unchanged source and repeated publication',
    run() {
      const record = createDrawingRecord();
      const draft = buildMonthlyPerformanceResultDraft({ drawingTaskRecord: record, record });
      const firstPublication = publishPerformanceResult([], draft, {
        actor: '李明',
        deliveredAt: '2026-06-15 10:00',
        responseDeadline
      });

      assert(firstPublication.success && firstPublication.result, 'first publication should succeed');
      assert(isMonthlyPerformanceResult(firstPublication.result), 'first publication should remain monthly');
      const repeatedPublication = publishPerformanceResult(firstPublication.results, draft, {
        actor: '李明',
        deliveredAt: '2026-06-15 10:01',
        responseDeadline
      });
      const unchangedCorrection = correctPerformanceResult(
        firstPublication.results,
        firstPublication.result,
        record,
        record,
        {
          actor: '李明',
          correctionReason: '重复提交相同来源',
          deliveredAt: '2026-06-15 10:02',
          responseDeadline
        }
      );

      assertEqual(repeatedPublication.success, false, 'a current published result should block repeated publication');
      assertEqual(unchangedCorrection.success, false, 'an unchanged source should not create a formal version');
      assertEqual(firstPublication.results.length, 1, 'failed actions must not mutate formal history');
    }
  }
];

export function runPerformanceResultModelTests(): UnitTestResult {
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

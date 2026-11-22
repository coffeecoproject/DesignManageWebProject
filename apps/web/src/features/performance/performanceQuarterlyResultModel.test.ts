import type { PerformanceResponseDeadline } from './performanceResultDeadlineModel';
import {
  buildPerformanceQuarterlyResultReadModel,
  correctQuarterlyPerformanceResult,
  publishQuarterlyPerformanceResult
} from './performanceQuarterlyResultModel';
import {
  buildMonthlyPerformanceResultDraft,
  correctPerformanceResult,
  isMonthlyPerformanceResult,
  publishPerformanceResult
} from './performanceResultModel';
import type {
  PerformanceMonthlyCategoryRecord,
  PerformanceQuarterlyResultSnapshot,
  PerformanceResultReadRecord,
  PerformanceResultSnapshot
} from './performanceTypes';
import { it } from 'vitest';
import { assert, assertEqual } from '../../__tests__/assertions';

type MonthlySourceFixture = {
  formalResults: PerformanceResultSnapshot[];
  readRecord: PerformanceResultReadRecord;
};

function assertArrayEqual(actual: string[], expected: string[], message: string) {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

const responseDeadline: PerformanceResponseDeadline = {
  calendarSnapshot: {
    alternateWorkdays: [],
    code: 'CAL-2026',
    exceptionItems: [],
    fixedWorkdays: ['周一', '周二', '周三', '周四', '周五'],
    id: 'calendar-2026',
    name: '公司工作日历',
    ruleVersionIds: ['calendar-2026-v1'],
    type: '双休',
    updatedAt: '2026-01-01 09:00'
  },
  deadlineAt: '2026-07-06 23:59:59',
  deadlineDate: '2026-07-06',
  deliveredDate: '2026-07-01',
  workingDates: ['2026-07-02', '2026-07-03', '2026-07-05']
};

function createMonthlyRecord({
  month,
  monthlyAmount,
  prepayAmount
}: {
  month: string;
  monthlyAmount: number;
  prepayAmount: number;
}): PerformanceMonthlyCategoryRecord {
  return {
    category: '绘图任务制',
    employeeName: '李明',
    events: [],
    id: `task-performance:${month}:20260001:quarter-rule`,
    monthlyAmount,
    note: monthlyAmount === 0 ? '当月规则适用但无有效任务。' : '按有效任务验收计分。',
    performanceMonth: month,
    position: '主案设计师',
    prepayAmount,
    qualityScore: monthlyAmount === 0 ? 0 : 90,
    ruleApplicability: {
      applicablePositions: ['主案设计师'],
      category: '绘图任务制',
      note: '按人员任职、规则生效期和岗位自动适用。',
      position: '主案设计师',
      ruleId: 'quarter-rule',
      ruleName: '季度绘图任务制',
      ruleVersion: 'V1',
      status: '适用',
      workNo: '20260001'
    },
    ruleName: '季度绘图任务制',
    ruleVersion: 'V1',
    salarySettlementReference: `performance-result:${month}:monthly-prepay:v1`,
    sourceLabel: '任务验收',
    sourceRecordIds: monthlyAmount === 0 ? [] : [`task-score-${month}`],
    sourceTaskCount: monthlyAmount === 0 ? 0 : 1,
    taskScore: monthlyAmount === 0 ? 0 : 90,
    updatedAt: `${month}-28 18:00`,
    workNo: '20260001'
  };
}

function createMonthlySource({
  month,
  monthlyAmount,
  prepayAmount,
  published = true
}: {
  month: string;
  monthlyAmount: number;
  prepayAmount: number;
  published?: boolean;
}): MonthlySourceFixture {
  const record = createMonthlyRecord({ month, monthlyAmount, prepayAmount });
  const draft = buildMonthlyPerformanceResultDraft({ record });

  if (!published) {
    return {
      formalResults: [],
      readRecord: {
        currentSourceRecord: record,
        publishBlockingReasons: [],
        result: draft,
        sourceAvailable: true,
        sourceChangedSincePublish: false
      }
    };
  }

  const outcome = publishPerformanceResult([], draft, {
    actor: '李明',
    deliveredAt: `${month}-28 18:00`,
    responseDeadline
  });

  assert(outcome.success && outcome.result, `${month} monthly result should publish`);
  assert(isMonthlyPerformanceResult(outcome.result), `${month} source should remain a monthly result`);

  return {
    formalResults: outcome.results,
    readRecord: {
      currentSourceRecord: record,
      publishBlockingReasons: [],
      result: outcome.result,
      sourceAvailable: true,
      sourceChangedSincePublish: false
    }
  };
}

function buildQuarterScenario(sources: MonthlySourceFixture[]) {
  const formalResults = sources.flatMap((source) => source.formalResults);
  const readRecords = buildPerformanceQuarterlyResultReadModel({
    asOfDate: '2026-07-01',
    formalResults,
    monthlyResults: sources.map((source) => source.readRecord),
    quarterlyRuleIds: ['quarter-rule']
  });
  const readRecord = readRecords[0];

  assert(readRecord, 'quarterly result read record should exist');
  assert(readRecord.result.kind === '季度结果', 'quarterly read model should return a quarterly result');

  return {
    draft: readRecord.result,
    formalResults,
    readRecord
  };
}

function assertQuarterlyResult(
  result: PerformanceResultSnapshot | undefined,
  message: string
): asserts result is PerformanceQuarterlyResultSnapshot {
  assert(result?.kind === '季度结果', message);
}

it('PF-21 derives only actually applicable months for a mid-quarter start', () => {
  const may = createMonthlySource({ month: '2026-05', monthlyAmount: 1000, prepayAmount: 500 });
  const june = createMonthlySource({ month: '2026-06', monthlyAmount: 1200, prepayAmount: 600 });
  const { draft } = buildQuarterScenario([may, june]);

  assertArrayEqual(
    draft.calculationSnapshot.expectedMonths,
    ['2026-05', '2026-06'],
    'April should not become a missing month when actual applicability starts in May'
  );
  assertArrayEqual(draft.calculationSnapshot.missingMonths, [], 'all applicable months should be complete');
});

it('PF-22 blocks quarterly publication and lists every unpublished applicable month', () => {
  const may = createMonthlySource({ month: '2026-05', monthlyAmount: 1000, prepayAmount: 500 });
  const june = createMonthlySource({
    month: '2026-06',
    monthlyAmount: 1200,
    prepayAmount: 600,
    published: false
  });
  const { draft, formalResults, readRecord } = buildQuarterScenario([may, june]);

  assertArrayEqual(draft.calculationSnapshot.missingMonths, ['2026-06'], 'unpublished June should be listed');
  assert(
    readRecord.publishBlockingReasons.some((reason) => reason.includes('2026-06')),
    'read model should expose the missing month to the UI'
  );
  const outcome = publishQuarterlyPerformanceResult(
    formalResults,
    draft,
    { adjustmentAmount: 0, adjustmentReason: '' },
    { actor: '李明', deliveredAt: '2026-07-01 09:00', responseDeadline }
  );

  assertEqual(outcome.success, false, 'quarterly result must not publish with an unpublished applicable month');
  assert(outcome.reason?.includes('2026-06'), 'publication failure should identify the missing month');
});

it('PF-22B blocks quarterly publication while a monthly source has an open objection', () => {
  const may = createMonthlySource({ month: '2026-05', monthlyAmount: 1000, prepayAmount: 500 });
  const june = createMonthlySource({ month: '2026-06', monthlyAmount: 1200, prepayAmount: 600 });
  const objectedResult = {
    ...june.readRecord.result,
    employeeResponse: {
      ...june.readRecord.result.employeeResponse,
      objectionReason: '验收计分存在争议',
      respondedAt: '2026-06-29 10:00:00',
      status: '有异议' as const
    }
  };
  june.readRecord = { ...june.readRecord, result: objectedResult };
  june.formalResults = june.formalResults.map((result) =>
    result.id === objectedResult.id ? objectedResult : result
  );
  const { draft, formalResults, readRecord } = buildQuarterScenario([may, june]);

  assertArrayEqual(
    draft.calculationSnapshot.unresolvedObjectionMonths,
    ['2026-06'],
    'open monthly objection must be retained in the quarterly snapshot'
  );
  assert(
    readRecord.publishBlockingReasons.some((reason) => reason.includes('未处理异议')),
    'quarterly workbench should expose the unresolved objection blocker'
  );
  const outcome = publishQuarterlyPerformanceResult(
    formalResults,
    draft,
    { adjustmentAmount: 0, adjustmentReason: '' },
    { actor: '李明', deliveredAt: '2026-07-01 09:00', responseDeadline }
  );

  assertEqual(outcome.success, false, 'quarterly result must not publish while a monthly objection is open');
});

it('PF-23 derives quarterly amount prepay total and difference from published monthly results', () => {
  const { draft } = buildQuarterScenario([
    createMonthlySource({ month: '2026-04', monthlyAmount: 900, prepayAmount: 450 }),
    createMonthlySource({ month: '2026-05', monthlyAmount: 1100, prepayAmount: 550 }),
    createMonthlySource({ month: '2026-06', monthlyAmount: 1300, prepayAmount: 650 })
  ]);

  assertEqual(draft.quarterCalculatedAmount, 3300, 'quarterly calculated amount should sum monthly amounts');
  assertEqual(draft.quarterPrepayAmount, 1650, 'quarterly prepay should sum monthly prepays');
  assertEqual(draft.quarterDifferenceAmount, 1650, 'quarterly difference should exclude amounts already prepaid');
});

it('PF-24 requires a reason for nonzero quarterly adjustment and freezes the adjusted amount', () => {
  const { draft, formalResults } = buildQuarterScenario([
    createMonthlySource({ month: '2026-04', monthlyAmount: 900, prepayAmount: 450 }),
    createMonthlySource({ month: '2026-05', monthlyAmount: 1100, prepayAmount: 550 }),
    createMonthlySource({ month: '2026-06', monthlyAmount: 1300, prepayAmount: 650 })
  ]);
  const rejected = publishQuarterlyPerformanceResult(
    formalResults,
    draft,
    { adjustmentAmount: 120.25, adjustmentReason: '' },
    { actor: '李明', deliveredAt: '2026-07-01 09:00', responseDeadline }
  );

  assertEqual(rejected.success, false, 'nonzero adjustment without a reason should be rejected');
  const published = publishQuarterlyPerformanceResult(
    formalResults,
    draft,
    {
      adjustmentAmount: 120.25,
      adjustmentReason: '季度客户满意度补充结果',
      evidenceFileIds: ['quarter-evidence-001']
    },
    { actor: '李明', deliveredAt: '2026-07-01 09:00', responseDeadline }
  );

  assert(published.success && published.result, 'quarterly result with a complete adjustment should publish');
  assertQuarterlyResult(published.result, 'published adjustment should remain quarterly');
  assertEqual(published.result.quarterFinalAmount, 3420.25, 'final amount should add the explicit adjustment');
  assertEqual(published.result.quarterDifferenceAmount, 1770.25, 'difference should subtract published prepays');
  assertEqual(
    published.result.quarterAdjustmentReason,
    '季度客户满意度补充结果',
    'adjustment reason should be frozen'
  );
  assertArrayEqual(
    published.result.quarterEvidenceFileIds,
    ['quarter-evidence-001'],
    'adjustment evidence identifiers should be frozen'
  );
});

it('PF-25 derives the quarter-end salary month and exposes no free settlement date', () => {
  const { draft, formalResults } = buildQuarterScenario([
    createMonthlySource({ month: '2026-05', monthlyAmount: 1000, prepayAmount: 500 }),
    createMonthlySource({ month: '2026-06', monthlyAmount: 1200, prepayAmount: 600 })
  ]);
  const outcome = publishQuarterlyPerformanceResult(
    formalResults,
    draft,
    { adjustmentAmount: 0, adjustmentReason: '' },
    { actor: '李明', deliveredAt: '2026-07-01 09:00', responseDeadline }
  );

  assert(outcome.success && outcome.result, 'complete quarter should publish');
  assertQuarterlyResult(outcome.result, 'published result should remain quarterly');
  assertEqual(outcome.result.salarySettlementMonth, '2026-06', 'Q2 should settle through the June salary period');
  assert(!Object.hasOwn(outcome.result, 'settlementDate'), 'quarter result must not expose a free settlement date');
});

it('PF-26 publishes quarterly delivery and pending employee-response evidence through the shared contract', () => {
  const { draft, formalResults } = buildQuarterScenario([
    createMonthlySource({ month: '2026-05', monthlyAmount: 1000, prepayAmount: 500 }),
    createMonthlySource({ month: '2026-06', monthlyAmount: 1200, prepayAmount: 600 })
  ]);
  const outcome = publishQuarterlyPerformanceResult(
    formalResults,
    draft,
    { adjustmentAmount: 0, adjustmentReason: '' },
    { actor: '李明', deliveredAt: '2026-07-01 09:00', responseDeadline }
  );

  assert(outcome.success && outcome.result, 'complete quarter should publish');
  assertQuarterlyResult(outcome.result, 'published result should remain quarterly');
  assertEqual(outcome.result.lifecycleStatus, '已发布', 'published quarter should become formal');
  assertEqual(outcome.result.employeeResponse.status, '待确认', 'employee response should begin pending');
  assertEqual(outcome.result.deliveredAt, '2026-07-01 09:00', 'delivery time should be frozen');
  assertEqual(outcome.result.responseDeadline, responseDeadline.deadlineAt, 'feedback deadline should be frozen');
  assertEqual(
    outcome.result.responseDeadlineSnapshot?.calendarSnapshot.id,
    'calendar-2026',
    'work-calendar evidence should be frozen with delivery'
  );
});

it('PF-28 monthly correction regenerates a quarterly V2 while preserving settled V1 history', () => {
  const april = createMonthlySource({ month: '2026-04', monthlyAmount: 900, prepayAmount: 450 });
  const may = createMonthlySource({ month: '2026-05', monthlyAmount: 1100, prepayAmount: 550 });
  const june = createMonthlySource({ month: '2026-06', monthlyAmount: 1300, prepayAmount: 650 });
  const { draft, formalResults } = buildQuarterScenario([april, may, june]);
  const publishedQuarter = publishQuarterlyPerformanceResult(
    formalResults,
    draft,
    { adjustmentAmount: 0, adjustmentReason: '' },
    { actor: '李明', deliveredAt: '2026-07-01 09:00', responseDeadline }
  );

  assert(publishedQuarter.success && publishedQuarter.result, 'initial quarterly result should publish');
  assertQuarterlyResult(publishedQuarter.result, 'initial result should be quarterly');
  const settledQuarter = {
    ...publishedQuarter.result,
    lifecycleStatus: '已结算' as const
  };
  const resultsWithSettledQuarter = publishedQuarter.results.map((result) =>
    result.id === settledQuarter.id ? settledQuarter : result
  );
  const currentJune = june.readRecord.result;

  assert(isMonthlyPerformanceResult(currentJune), 'June source should be monthly');
  const correctedJuneSource = createMonthlyRecord({
    month: '2026-06',
    monthlyAmount: 1600,
    prepayAmount: 800
  });
  const correctedJune = correctPerformanceResult(
    resultsWithSettledQuarter,
    currentJune,
    correctedJuneSource,
    undefined,
    {
      actor: '李明',
      correctionReason: '补录已验收任务',
      deliveredAt: '2026-07-03 09:00',
      responseDeadline
    }
  );

  assert(correctedJune.success && correctedJune.result, 'June monthly correction should publish V2');
  assert(isMonthlyPerformanceResult(correctedJune.result), 'corrected June result should remain monthly');
  const quarterlyReadRecord = buildPerformanceQuarterlyResultReadModel({
    asOfDate: '2026-07-03',
    formalResults: correctedJune.results,
    monthlyResults: [
      april.readRecord,
      may.readRecord,
      {
        currentSourceRecord: correctedJuneSource,
        publishBlockingReasons: [],
        result: correctedJune.result,
        sourceAvailable: true,
        sourceChangedSincePublish: false
      }
    ],
    quarterlyRuleIds: ['quarter-rule']
  })[0];

  assert(quarterlyReadRecord, 'quarterly result should remain readable after a monthly correction');
  assertEqual(
    quarterlyReadRecord.sourceChangedSincePublish,
    true,
    'quarterly result should detect that a source month changed'
  );
  assertEqual(
    quarterlyReadRecord.currentQuarterDraft?.version,
    2,
    'quarterly correction draft should use the next version'
  );
  const correctedQuarter = correctQuarterlyPerformanceResult(
    correctedJune.results,
    settledQuarter,
    quarterlyReadRecord.currentQuarterDraft!,
    { adjustmentAmount: 0, adjustmentReason: '' },
    {
      actor: '李明',
      correctionReason: '承接六月绩效更正',
      deliveredAt: '2026-07-03 10:00',
      responseDeadline
    }
  );

  assert(correctedQuarter.success && correctedQuarter.result, 'quarterly V2 should publish');
  assertQuarterlyResult(correctedQuarter.result, 'corrected result should remain quarterly');
  assertEqual(correctedQuarter.result.version, 2, 'corrected quarterly result should be V2');
  assertEqual(
    correctedQuarter.result.quarterDifferenceAmount,
    1800,
    'quarterly difference should be recalculated from corrected monthly amounts'
  );
  assertEqual(
    correctedQuarter.result.supersedesResultId,
    settledQuarter.id,
    'quarterly V2 should reference settled V1'
  );
  assertEqual(
    correctedQuarter.results.find((result) => result.id === settledQuarter.id)?.lifecycleStatus,
    '已结算',
    'settled V1 must remain frozen historical evidence'
  );
});

it('PF-28B corrects an erroneous quarterly adjustment without changing monthly sources', () => {
  const sources = [
    createMonthlySource({ month: '2026-04', monthlyAmount: 900, prepayAmount: 450 }),
    createMonthlySource({ month: '2026-05', monthlyAmount: 1100, prepayAmount: 550 }),
    createMonthlySource({ month: '2026-06', monthlyAmount: 1300, prepayAmount: 650 })
  ];
  const { draft, formalResults } = buildQuarterScenario(sources);
  const published = publishQuarterlyPerformanceResult(
    formalResults,
    draft,
    { adjustmentAmount: 0, adjustmentReason: '' },
    { actor: '李明', deliveredAt: '2026-07-01 09:00', responseDeadline }
  );

  assert(published.success && published.result, 'initial quarterly result should publish');
  assertQuarterlyResult(published.result, 'initial result should be quarterly');
  const readRecord = buildPerformanceQuarterlyResultReadModel({
    asOfDate: '2026-07-03',
    formalResults: published.results,
    monthlyResults: sources.map((source) => source.readRecord),
    quarterlyRuleIds: ['quarter-rule']
  })[0];

  assert(readRecord?.currentQuarterDraft, 'published quarter should provide a V2 correction draft');
  const corrected = correctQuarterlyPerformanceResult(
    published.results,
    published.result,
    readRecord.currentQuarterDraft,
    {
      adjustmentAmount: -100,
      adjustmentReason: '更正季度人工调整',
      evidenceFileIds: ['quarter-adjustment-correction-001']
    },
    {
      actor: '李明',
      correctionReason: '原季度调整金额录入错误',
      deliveredAt: '2026-07-03 10:00',
      responseDeadline
    }
  );

  assert(corrected.success && corrected.result, 'changed quarterly adjustment should create a correction version');
  assertQuarterlyResult(corrected.result, 'corrected result should remain quarterly');
  assertEqual(corrected.result.quarterAdjustmentAmount, -100, 'corrected adjustment amount should be frozen');
  assertEqual(corrected.result.quarterFinalAmount, 3200, 'final amount should include the corrected adjustment');
});

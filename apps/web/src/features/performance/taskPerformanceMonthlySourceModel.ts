import type { PeopleMember } from '../people/peopleTypes';
import type {
  StoreTaskRecord,
  TaskPerformanceScoringRecord
} from '../tasks/TaskManagementState';
import { buildPerformanceSalarySettlementReference } from './performanceMonthlyModel';
import { formatPerformancePayoutMode } from './performanceRuleModel';
import {
  calculateDrawingTaskPerformanceAmount,
  calculateWeightedPerformanceQualityScore,
  roundPerformanceValue
} from './performanceRuleCalculationModel';
import { resolvePerformanceRuleForMember } from './performanceRuleApplicabilityModel';
import type {
  PerformanceDrawingTaskMonthlyRecord,
  PerformanceMonthlyQualitySummary,
  PerformanceMonthlyTaskSummary,
  PerformanceRulePreset
} from './performanceTypes';

export type TaskPerformanceMonthlySourceFact = {
  acceptedAt: string;
  employeeId: string;
  id: string;
  qualityScore: number;
  ruleId: string;
  ruleVersion: string;
  scoreItemId: string;
  scoreValue: number;
  sourceMonth: string;
  taskId: string;
  taskName: string;
  updatedAt: string;
};

type BuildTaskPerformanceMonthlySourceRecordsInput = {
  peopleRows: PeopleMember[];
  performanceMonths: string[];
  ruleRows: PerformanceRulePreset[];
  scoringRows: TaskPerformanceScoringRecord[];
  taskRows: StoreTaskRecord[];
};

type ValidTaskPerformanceSource = {
  fact: TaskPerformanceMonthlySourceFact;
  scoring: TaskPerformanceScoringRecord;
  task: StoreTaskRecord;
};

function buildGroupKey(memberId: string, month: string, ruleId: string) {
  return `${month}/${memberId}/${ruleId}`;
}

function getNextMonth(month: string) {
  const [yearText, monthText] = month.split('-');
  const date = new Date(Number(yearText), Number(monthText), 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getTaskPerformanceSourceMonths(
  ruleRows: PerformanceRulePreset[],
  throughDate: string
) {
  const throughMonth = throughDate.slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(throughMonth)) {
    return [];
  }

  const months = new Set<string>();

  for (const rule of ruleRows) {
    if (
      rule.category !== '绘图任务制' ||
      rule.performanceType !== '任务制' ||
      rule.status !== '已发布' ||
      !rule.effectiveStartAt
    ) {
      continue;
    }

    const startMonth = rule.effectiveStartAt.slice(0, 7);
    const configuredEndMonth = rule.effectiveEndAt?.slice(0, 7) ?? throughMonth;
    const endMonth = configuredEndMonth < throughMonth ? configuredEndMonth : throughMonth;

    if (!/^\d{4}-\d{2}$/.test(startMonth) || startMonth > endMonth) {
      continue;
    }

    for (let month = startMonth; month <= endMonth; month = getNextMonth(month)) {
      months.add(month);
    }
  }

  return [...months].sort();
}

function isCompleteQualitySource(
  scoring: TaskPerformanceScoringRecord,
  rule: PerformanceRulePreset
) {
  if (scoring.qualityDimensionScores.length !== rule.qualityDimensions.length) {
    return false;
  }

  const scoresById = new Map(scoring.qualityDimensionScores.map((score) => [score.id, score]));

  return rule.qualityDimensions.every((dimension) => {
    const score = scoresById.get(dimension.id);

    return Boolean(
      score &&
      score.maxScore === dimension.score &&
      Number.isFinite(score.score) &&
      score.score >= 0 &&
      score.score <= dimension.score
    );
  });
}

function buildValidTaskPerformanceSources({
  peopleRows,
  ruleRows,
  scoringRows,
  taskRows
}: Omit<BuildTaskPerformanceMonthlySourceRecordsInput, 'performanceMonths'>) {
  const peopleById = new Map(peopleRows.map((member) => [member.id, member]));
  const tasksById = new Map(taskRows.map((task) => [task.id, task]));
  const sourcesByTaskId = new Map<string, ValidTaskPerformanceSource>();
  const sortedScoringRows = [...scoringRows].sort(
    (left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id)
  );

  for (const scoring of sortedScoringRows) {
    const task = tasksById.get(scoring.taskId);
    const member = task?.executorId ? peopleById.get(task.executorId) : undefined;
    const acceptedMonth = task?.acceptedAt?.slice(0, 7);

    if (
      sourcesByTaskId.has(scoring.taskId) ||
      scoring.status !== '已计入' ||
      !task ||
      task.status !== '已完成' ||
      !task.acceptedAt ||
      !acceptedMonth ||
      scoring.sourceMonth !== acceptedMonth ||
      !scoring.confirmedBy?.trim() ||
      !scoring.confirmedAt ||
      scoring.confirmedAt < task.acceptedAt ||
      !scoring.operationRecords.some(
        (record) =>
          record.action === '验收计分' &&
          record.actor === scoring.confirmedBy &&
          record.time === scoring.confirmedAt
      ) ||
      !member ||
      member.personnelType !== '全职' ||
      member.paymentProfile.mode !== '工资发放'
    ) {
      continue;
    }

    const resolution = resolvePerformanceRuleForMember({
      category: '绘图任务制',
      member,
      performanceMonth: acceptedMonth,
      ruleRows
    });
    const rule = resolution.rule;

    if (
      resolution.applicability.status !== '适用' ||
      !rule ||
      rule.performanceType !== '任务制' ||
      scoring.performanceCategory !== rule.category ||
      scoring.ruleId !== rule.id ||
      scoring.ruleVersion !== rule.currentVersion
    ) {
      continue;
    }

    const scoreItem = rule.taskScoreItems.find(
      (item) => item.id === scoring.scoreItemId && item.taskConfigId === task.taskConfigId
    );

    if (
      !scoreItem ||
      typeof scoring.scoreValue !== 'number' ||
      !Number.isFinite(scoring.scoreValue) ||
      scoring.scoreValue < 0 ||
      (scoring.scoreValue !== scoreItem.score && !scoring.adjustmentReason.trim()) ||
      !isCompleteQualitySource(scoring, rule)
    ) {
      continue;
    }

    const qualityScore = calculateWeightedPerformanceQualityScore(
      scoring.qualityDimensionScores,
      rule.qualityDimensions
    );

    sourcesByTaskId.set(scoring.taskId, {
      fact: {
        acceptedAt: task.acceptedAt,
        employeeId: member.id,
        id: scoring.id,
        qualityScore,
        ruleId: rule.id,
        ruleVersion: rule.currentVersion,
        scoreItemId: scoreItem.id,
        scoreValue: scoring.scoreValue,
        sourceMonth: acceptedMonth,
        taskId: task.id,
        taskName: task.name,
        updatedAt: scoring.updatedAt
      },
      scoring,
      task
    });
  }

  return [...sourcesByTaskId.values()];
}

function buildTaskSummaries(
  sources: ValidTaskPerformanceSource[],
  rule: PerformanceRulePreset
): PerformanceMonthlyTaskSummary[] {
  return rule.taskScoreItems.flatMap((item) => {
    const itemSources = sources.filter((source) => source.fact.scoreItemId === item.id);

    if (itemSources.length === 0) {
      return [];
    }

    const subtotalScore = roundPerformanceValue(
      itemSources.reduce((total, source) => total + source.fact.scoreValue, 0)
    );

    return [{
      id: `${item.id}-summary`,
      quantity: itemSources.length,
      quantityUnit: item.unit,
      scorePerUnit: roundPerformanceValue(subtotalScore / itemSources.length),
      scoreUnit: '分',
      subtotalScore,
      taskItem: item.name
    }];
  });
}

function buildQualitySummaries(
  sources: ValidTaskPerformanceSource[],
  rule: PerformanceRulePreset
): PerformanceMonthlyQualitySummary[] {
  return rule.qualityDimensions.map((dimension) => {
    const score = sources.length > 0
      ? sources.reduce((total, source) => {
          const dimensionScore = source.scoring.qualityDimensionScores.find(
            (item) => item.id === dimension.id
          );

          return total + (dimensionScore?.score ?? 0);
        }, 0) / sources.length
      : 0;

    return {
      dimension: dimension.name,
      id: dimension.id,
      maxScore: dimension.score,
      score: roundPerformanceValue(score)
    };
  });
}

function buildMonthlyRecord({
  member,
  performanceMonth,
  rule,
  sources
}: {
  member: PeopleMember;
  performanceMonth: string;
  rule: PerformanceRulePreset;
  sources: ValidTaskPerformanceSource[];
}): PerformanceDrawingTaskMonthlyRecord {
  const taskScore = roundPerformanceValue(
    sources.reduce((total, source) => total + source.fact.scoreValue, 0)
  );
  const qualityScore = sources.length > 0
    ? roundPerformanceValue(
        sources.reduce((total, source) => total + source.fact.qualityScore, 0) / sources.length
      )
    : 0;
  const amount = calculateDrawingTaskPerformanceAmount({
    basePerformanceAmount: rule.basePerformanceAmount ?? 0,
    baselineScore: rule.baseLineScore ?? 0,
    belowBaselineFactor: rule.belowBaselineFactor,
    excessBands: rule.excessBands,
    fullScore: rule.fullScore,
    monthlyPrepayRatio: rule.monthlyPrepayRatio,
    qualityBands: rule.qualityBands,
    qualityScore,
    taskScore
  });
  const recordId = `task-performance:${performanceMonth}:${member.id}:${rule.id}`;
  const taskNames = sources.map((source) => source.fact.taskName).join('、');

  return {
    amountSummary: {
      baseAmount: amount.baseAmount,
      baseQualityRatio: amount.baseQualityRatio,
      confirmedBaseScore: amount.confirmedBaseScore,
      excessAmount: amount.excessAmount,
      excessMultiplier: amount.excessMultiplier,
      excessQualityRatio: amount.excessQualityRatio,
      excessScore: amount.excessScore,
      monthlyAmount: amount.monthlyAmount,
      pointValue: amount.pointValue,
      prepayAmount: amount.prepayAmount,
      prepayRatio: amount.prepayRatio,
      settlementNote: formatPerformancePayoutMode(rule),
      taskConfirmRatio: amount.taskConfirmRatio
    },
    baseQualityRatio: amount.baseQualityRatio,
    category: '绘图任务制',
    employeeName: member.name,
    events: sources.flatMap((source) =>
      source.scoring.operationRecords.map((operation, operationIndex) => ({
        action: operation.action,
        actor: operation.actor,
        id: operation.id ?? `${source.scoring.id}/event/${operationIndex + 1}`,
        object: operation.object,
        summary: operation.summary,
        time: operation.time
      }))
    ),
    excessQualityRatio: amount.excessQualityRatio,
    id: recordId,
    monthlyAmount: amount.monthlyAmount,
    note: sources.length > 0
      ? `按 ${sources.length} 条已验收任务归集：${taskNames}`
      : '当月无已验收计分任务，结果为 0 分 0 元。',
    performanceMonth,
    position: member.position,
    prepayAmount: amount.prepayAmount,
    qualityBand: amount.qualityBand,
    qualityScore,
    qualitySummaries: buildQualitySummaries(sources, rule),
    ruleApplicability: resolvePerformanceRuleForMember({
      category: '绘图任务制',
      member,
      performanceMonth,
      ruleRows: [rule]
    }).applicability,
    ruleName: rule.name,
    ruleVersion: rule.currentVersion,
    salarySettlementReference: buildPerformanceSalarySettlementReference(recordId, 'monthly-prepay'),
    sourceLabel: '任务验收',
    sourceRecordIds: sources.map((source) => source.fact.id).sort(),
    sourceTaskCount: sources.length,
    taskScore,
    taskSummaries: buildTaskSummaries(sources, rule),
    updatedAt: sources
      .map((source) => source.fact.updatedAt)
      .sort((left, right) => right.localeCompare(left))[0] ?? `${performanceMonth}-01 00:00`,
    workNo: member.id
  };
}

export function buildTaskPerformanceMonthlySourceRecords({
  peopleRows,
  performanceMonths,
  ruleRows,
  scoringRows,
  taskRows
}: BuildTaskPerformanceMonthlySourceRecordsInput): PerformanceDrawingTaskMonthlyRecord[] {
  const validSources = buildValidTaskPerformanceSources({
    peopleRows,
    ruleRows,
    scoringRows,
    taskRows
  });
  const sourcesByGroup = new Map<string, ValidTaskPerformanceSource[]>();

  for (const source of validSources) {
    const key = buildGroupKey(source.fact.employeeId, source.fact.sourceMonth, source.fact.ruleId);
    const current = sourcesByGroup.get(key) ?? [];
    current.push(source);
    sourcesByGroup.set(key, current);
  }

  const months = [...new Set(performanceMonths.filter((month) => /^\d{4}-\d{2}$/.test(month)))].sort();
  const records: PerformanceDrawingTaskMonthlyRecord[] = [];

  for (const performanceMonth of months) {
    for (const member of peopleRows) {
      if (member.personnelType !== '全职' || member.paymentProfile.mode !== '工资发放') {
        continue;
      }

      const resolution = resolvePerformanceRuleForMember({
        category: '绘图任务制',
        member,
        performanceMonth,
        ruleRows
      });
      const rule = resolution.rule;

      if (
        resolution.applicability.status !== '适用' ||
        !rule ||
        rule.performanceType !== '任务制'
      ) {
        continue;
      }

      const key = buildGroupKey(member.id, performanceMonth, rule.id);
      const sources = sourcesByGroup.get(key) ?? [];

      records.push(buildMonthlyRecord({ member, performanceMonth, rule, sources }));
    }
  }

  return records.sort(
    (left, right) =>
      right.performanceMonth.localeCompare(left.performanceMonth) ||
      left.workNo.localeCompare(right.workNo) ||
      left.id.localeCompare(right.id)
  );
}

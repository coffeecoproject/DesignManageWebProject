import { buildPerformanceSalarySettlementReference } from './performanceMonthlyModel';
import {
  buildPerformanceResultEvent,
  clonePerformanceSnapshotValue,
  getCurrentPerformanceResults,
  getLatestPerformanceResultVersion,
  getPerformanceResultId,
  hashPerformanceSource,
  isMonthlyPerformanceResult,
  type PerformanceResultCorrectionInput,
  type PerformanceResultMutation,
  type PerformanceResultWorkflowInput
} from './performanceResultModel';
import type {
  PerformanceMonthlyResultSnapshot,
  PerformanceQuarterlyCalculationSnapshot,
  PerformanceQuarterlyResultSnapshot,
  PerformanceQuarterlySourceSnapshot,
  PerformanceResultReadRecord,
  PerformanceResultSnapshot,
  PerformanceRuleCategory
} from './performanceTypes';

export type PerformanceQuarterlyAdjustmentInput = {
  adjustmentAmount: number;
  adjustmentReason: string;
  evidenceFileIds?: string[];
};

type BuildQuarterlyResultReadModelInput = {
  asOfDate: string;
  formalResults: PerformanceResultSnapshot[];
  monthlyResults: PerformanceResultReadRecord[];
  quarterlyRuleIds: string[];
};

type QuarterlyMonthlySourceGroup = {
  category: PerformanceRuleCategory;
  monthlyResults: PerformanceResultReadRecord[];
  period: string;
  resultKey: string;
  workNo: string;
};

const systemPerformanceActor = '系统';

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isValidMoney(value: number) {
  return Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}

export function getPerformanceQuarter(periodMonth: string) {
  const [year, monthText] = periodMonth.split('-');
  const month = Number(monthText);

  if (!/^\d{4}$/.test(year ?? '') || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('绩效月份无法确定季度');
  }

  return `${year}-Q${Math.ceil(month / 3)}`;
}

export function getPerformanceQuarterMonths(period: string) {
  const match = /^(\d{4})-Q([1-4])$/.exec(period);

  if (!match) {
    throw new Error('绩效季度格式无效');
  }

  const startMonth = (Number(match[2]) - 1) * 3 + 1;

  return Array.from({ length: 3 }, (_, index) => `${match[1]}-${String(startMonth + index).padStart(2, '0')}`);
}

export function getPerformanceQuarterEndDate(period: string) {
  const months = getPerformanceQuarterMonths(period);
  const endMonth = months[2]!;
  const [yearText, monthText] = endMonth.split('-');
  const endDate = new Date(Number(yearText), Number(monthText), 0);

  return `${endMonth}-${String(endDate.getDate()).padStart(2, '0')}`;
}

export function getPerformanceQuarterlyResultKey(
  workNo: string,
  period: string,
  category: PerformanceRuleCategory
) {
  return `quarterly:${workNo}:${period}:${category}`;
}

function getMonthlyCategory(result: PerformanceMonthlyResultSnapshot) {
  return result.calculationSnapshot.categoryRecord.category;
}

function getQuarterlySourceSnapshot(result: PerformanceMonthlyResultSnapshot): PerformanceQuarterlySourceSnapshot {
  return {
    monthlyAmount: result.monthlyAmount,
    period: result.period,
    prepayAmount: result.prepayAmount,
    publishedAt: result.publishedAt ?? '',
    resultId: result.id,
    resultVersion: result.version,
    ruleId: result.ruleId,
    ruleName: result.ruleNameSnapshot,
    ruleVersion: result.ruleVersion,
    sourceHash: result.sourceHash
  };
}

function isFormalMonthlyResult(result: PerformanceResultSnapshot): result is PerformanceMonthlyResultSnapshot {
  return isMonthlyPerformanceResult(result)
    && (result.lifecycleStatus === '已发布' || result.lifecycleStatus === '已结算');
}

function getQuarterRuleSummary(sourceResults: PerformanceMonthlyResultSnapshot[]) {
  const ruleIds = [...new Set(sourceResults.map((result) => result.ruleId))].sort();
  const ruleNames = [...new Set(sourceResults.map((result) => result.ruleNameSnapshot))].sort();
  const ruleVersions = [...new Set(sourceResults.map((result) => result.ruleVersion))].sort();

  return {
    ruleId: ruleIds.join('|'),
    ruleName: ruleNames.join(' / '),
    ruleVersion: ruleVersions.join(' / ')
  };
}

function buildQuarterlyCalculationSnapshot({
  adjustmentAmount,
  adjustmentReason,
  asOfDate,
  category,
  evidenceFileIds,
  monthlyResults,
  period
}: {
  adjustmentAmount: number;
  adjustmentReason: string;
  asOfDate: string;
  category: PerformanceRuleCategory;
  evidenceFileIds: string[];
  monthlyResults: PerformanceResultReadRecord[];
  period: string;
}): PerformanceQuarterlyCalculationSnapshot {
  const expectedMonths = [...new Set(monthlyResults.map(({ result }) => result.period))].sort();
  const sourceResults = monthlyResults
    .map(({ result }) => result)
    .filter(isFormalMonthlyResult)
    .sort((left, right) => left.period.localeCompare(right.period));
  const publishedMonths = new Set(sourceResults.map((result) => result.period));
  const missingMonths = expectedMonths.filter((month) => !publishedMonths.has(month));
  const unresolvedObjectionMonths = sourceResults
    .filter((result) => result.employeeResponse.status === '有异议')
    .map((result) => result.period);
  const quarterCalculatedAmount = roundMoney(sourceResults.reduce((total, result) => total + result.monthlyAmount, 0));
  const quarterPrepayAmount = roundMoney(sourceResults.reduce((total, result) => total + result.prepayAmount, 0));
  const quarterFinalAmount = roundMoney(quarterCalculatedAmount + adjustmentAmount);
  const quarterEndDate = getPerformanceQuarterEndDate(period);

  return {
    category,
    expectedMonths,
    missingMonths,
    unresolvedObjectionMonths,
    quarterAdjustmentAmount: adjustmentAmount,
    quarterAdjustmentReason: adjustmentAmount === 0 ? undefined : adjustmentReason.trim(),
    quarterCalculatedAmount,
    quarterClosed: asOfDate >= quarterEndDate,
    quarterDifferenceAmount: roundMoney(quarterFinalAmount - quarterPrepayAmount),
    quarterEndDate,
    quarterEvidenceFileIds: [...evidenceFileIds],
    quarterFinalAmount,
    quarterPrepayAmount,
    salarySettlementMonth: getPerformanceQuarterMonths(period)[2]!,
    sourceResults: sourceResults.map(getQuarterlySourceSnapshot)
  };
}

export function getQuarterlyPublishBlockingReasons(draft: PerformanceQuarterlyResultSnapshot) {
  const reasons: string[] = [];
  const snapshot = draft.calculationSnapshot;

  if (snapshot.expectedMonths.length === 0) {
    reasons.push('季度内没有适用的月度绩效结果');
  }

  if (!snapshot.quarterClosed) {
    reasons.push(`季度尚未结束，需到 ${snapshot.quarterEndDate} 后发布`);
  }

  if (snapshot.missingMonths.length > 0) {
    reasons.push(`以下月份尚未发布月度结果：${snapshot.missingMonths.join('、')}`);
  }

  if (snapshot.unresolvedObjectionMonths.length > 0) {
    reasons.push(`以下月份仍有未处理异议：${snapshot.unresolvedObjectionMonths.join('、')}`);
  }

  if (draft.quarterFinalAmount < 0) {
    reasons.push('季度最终金额不能小于 0');
  }

  return reasons;
}

export function buildQuarterlyPerformanceResultDraft({
  adjustment = { adjustmentAmount: 0, adjustmentReason: '' },
  asOfDate,
  group,
  version = 1
}: {
  adjustment?: PerformanceQuarterlyAdjustmentInput;
  asOfDate: string;
  group: QuarterlyMonthlySourceGroup;
  version?: number;
}): PerformanceQuarterlyResultSnapshot {
  if (!isValidMoney(adjustment.adjustmentAmount)) {
    throw new Error('季度调整金额最多保留两位小数');
  }

  const expectedResults = group.monthlyResults
    .map(({ result }) => result)
    .filter(isMonthlyPerformanceResult)
    .sort((left, right) => left.period.localeCompare(right.period));
  const representative = expectedResults.at(-1);

  if (!representative) {
    throw new Error('季度绩效缺少适用的月度来源');
  }

  const calculationSnapshot = buildQuarterlyCalculationSnapshot({
    adjustmentAmount: roundMoney(adjustment.adjustmentAmount),
    adjustmentReason: adjustment.adjustmentReason,
    asOfDate,
    category: group.category,
    evidenceFileIds: adjustment.evidenceFileIds ?? [],
    monthlyResults: group.monthlyResults,
    period: group.period
  });
  const sourceFormalResults = expectedResults.filter(isFormalMonthlyResult);
  const ruleSummary = getQuarterRuleSummary(sourceFormalResults.length > 0 ? sourceFormalResults : expectedResults);
  const id = getPerformanceResultId(group.resultKey, version);
  const generatedAt = sourceFormalResults
    .map((result) => result.publishedAt ?? '')
    .sort()
    .at(-1) ?? `${asOfDate} 00:00`;

  return {
    calculationSnapshot,
    employeeId: representative.employeeId,
    employeeNameSnapshot: representative.employeeNameSnapshot,
    employeeResponse: {
      employeeId: representative.employeeId,
      resultId: id,
      resultVersion: version,
      status: '待确认'
    },
    events: [
      buildPerformanceResultEvent(
        group.resultKey,
        version,
        '生成草稿',
        systemPerformanceActor,
        generatedAt,
        `按 ${calculationSnapshot.expectedMonths.length} 个适用月份生成季度绩效草稿`
      )
    ],
    id,
    kind: '季度结果',
    lifecycleStatus: '待发布',
    period: group.period,
    positionSnapshot: representative.positionSnapshot,
    quarterAdjustmentAmount: calculationSnapshot.quarterAdjustmentAmount,
    quarterAdjustmentReason: calculationSnapshot.quarterAdjustmentReason,
    quarterCalculatedAmount: calculationSnapshot.quarterCalculatedAmount,
    quarterDifferenceAmount: calculationSnapshot.quarterDifferenceAmount,
    quarterEvidenceFileIds: [...calculationSnapshot.quarterEvidenceFileIds],
    quarterFinalAmount: calculationSnapshot.quarterFinalAmount,
    quarterPrepayAmount: calculationSnapshot.quarterPrepayAmount,
    resultKey: group.resultKey,
    ruleId: ruleSummary.ruleId,
    ruleNameSnapshot: ruleSummary.ruleName,
    ruleVersion: ruleSummary.ruleVersion,
    salarySettlementMonth: calculationSnapshot.salarySettlementMonth,
    salarySettlementReference: buildPerformanceSalarySettlementReference(
      group.resultKey,
      'quarterly-difference',
      `v${version}`
    ),
    sourceHash: hashPerformanceSource(calculationSnapshot),
    sourceRecordIds: calculationSnapshot.sourceResults.map((source) => source.resultId),
    version,
    workNoSnapshot: representative.workNoSnapshot
  };
}

function buildQuarterlyGroups(
  monthlyResults: PerformanceResultReadRecord[],
  quarterlyRuleIds: Set<string>
) {
  const groups = new Map<string, QuarterlyMonthlySourceGroup>();

  for (const readRecord of monthlyResults) {
    const result = readRecord.result;

    if (!isMonthlyPerformanceResult(result) || !quarterlyRuleIds.has(result.ruleId)) {
      continue;
    }

    const period = getPerformanceQuarter(result.period);
    const category = getMonthlyCategory(result);
    const resultKey = getPerformanceQuarterlyResultKey(result.workNoSnapshot, period, category);
    const existing = groups.get(resultKey);

    if (existing) {
      existing.monthlyResults.push(readRecord);
      continue;
    }

    groups.set(resultKey, {
      category,
      monthlyResults: [readRecord],
      period,
      resultKey,
      workNo: result.workNoSnapshot
    });
  }

  return groups;
}

export function buildPerformanceQuarterlyResultReadModel({
  asOfDate,
  formalResults,
  monthlyResults,
  quarterlyRuleIds
}: BuildQuarterlyResultReadModelInput): PerformanceResultReadRecord[] {
  const groups = buildQuarterlyGroups(monthlyResults, new Set(quarterlyRuleIds));
  const currentFormalByKey = new Map(
    [...getCurrentPerformanceResults(formalResults)]
      .filter((entry): entry is [string, PerformanceQuarterlyResultSnapshot] => entry[1].kind === '季度结果')
  );
  const resultKeys = new Set([...groups.keys(), ...currentFormalByKey.keys()]);

  return [...resultKeys]
    .map<PerformanceResultReadRecord>((resultKey) => {
      const group = groups.get(resultKey);
      const currentFormal = currentFormalByKey.get(resultKey);

      if (!group && currentFormal) {
        return {
          publishBlockingReasons: [],
          result: clonePerformanceSnapshotValue(currentFormal),
          sourceAvailable: false,
          sourceChangedSincePublish: false
        };
      }

      const version = currentFormal
        ? currentFormal.version + 1
        : getLatestPerformanceResultVersion(resultKey, formalResults) + 1;
      const currentDraft = buildQuarterlyPerformanceResultDraft({
        adjustment: currentFormal
          ? {
              adjustmentAmount: currentFormal.quarterAdjustmentAmount,
              adjustmentReason: currentFormal.quarterAdjustmentReason ?? '',
              evidenceFileIds: currentFormal.quarterEvidenceFileIds
            }
          : undefined,
        asOfDate,
        group: group!,
        version
      });
      const publishBlockingReasons = getQuarterlyPublishBlockingReasons(currentDraft);

      if (currentFormal) {
        return {
          currentQuarterDraft: currentDraft,
          publishBlockingReasons,
          result: clonePerformanceSnapshotValue(currentFormal),
          sourceAvailable: true,
          sourceChangedSincePublish: currentDraft.sourceHash !== currentFormal.sourceHash
        };
      }

      return {
        currentQuarterDraft: currentDraft,
        publishBlockingReasons,
        result: currentDraft,
        sourceAvailable: true,
        sourceChangedSincePublish: false
      };
    })
    .sort(
      (left, right) =>
        right.result.period.localeCompare(left.result.period)
        || left.result.employeeNameSnapshot.localeCompare(right.result.employeeNameSnapshot, 'zh-CN')
        || left.result.resultKey.localeCompare(right.result.resultKey)
    );
}

function applyQuarterlyAdjustment(
  draft: PerformanceQuarterlyResultSnapshot,
  input: PerformanceQuarterlyAdjustmentInput
) {
  const adjustmentReason = input.adjustmentReason.trim();

  if (!isValidMoney(input.adjustmentAmount)) {
    return { reason: '季度调整金额最多保留两位小数' };
  }

  if (input.adjustmentAmount !== 0 && !adjustmentReason) {
    return { reason: '季度调整金额不为零时必须填写调整原因' };
  }

  const calculationSnapshot = clonePerformanceSnapshotValue({
    ...draft.calculationSnapshot,
    quarterAdjustmentAmount: roundMoney(input.adjustmentAmount),
    quarterAdjustmentReason: input.adjustmentAmount === 0 ? undefined : adjustmentReason,
    quarterDifferenceAmount: roundMoney(
      draft.quarterCalculatedAmount + input.adjustmentAmount - draft.quarterPrepayAmount
    ),
    quarterEvidenceFileIds: [...(input.evidenceFileIds ?? [])],
    quarterFinalAmount: roundMoney(draft.quarterCalculatedAmount + input.adjustmentAmount)
  });
  const adjustedDraft: PerformanceQuarterlyResultSnapshot = {
    ...draft,
    calculationSnapshot,
    quarterAdjustmentAmount: calculationSnapshot.quarterAdjustmentAmount,
    quarterAdjustmentReason: calculationSnapshot.quarterAdjustmentReason,
    quarterDifferenceAmount: calculationSnapshot.quarterDifferenceAmount,
    quarterEvidenceFileIds: [...calculationSnapshot.quarterEvidenceFileIds],
    quarterFinalAmount: calculationSnapshot.quarterFinalAmount,
    sourceHash: hashPerformanceSource(calculationSnapshot)
  };

  return { draft: adjustedDraft };
}

export function publishQuarterlyPerformanceResult(
  formalResults: PerformanceResultSnapshot[],
  draft: PerformanceQuarterlyResultSnapshot,
  adjustment: PerformanceQuarterlyAdjustmentInput,
  input: PerformanceResultWorkflowInput
): PerformanceResultMutation {
  if (draft.lifecycleStatus !== '待发布') {
    return { reason: '只有待发布季度结果可以发布', results: formalResults, success: false };
  }

  if (getCurrentPerformanceResults(formalResults).has(draft.resultKey)) {
    return { reason: '该季度当前结果已经发布', results: formalResults, success: false };
  }

  const adjusted = applyQuarterlyAdjustment(draft, adjustment);

  if (!adjusted.draft) {
    return { reason: adjusted.reason, results: formalResults, success: false };
  }

  const blockingReasons = getQuarterlyPublishBlockingReasons(adjusted.draft);

  if (blockingReasons.length > 0) {
    return { reason: blockingReasons[0], results: formalResults, success: false };
  }

  const result = clonePerformanceSnapshotValue({
    ...adjusted.draft,
    deliveredAt: input.deliveredAt,
    employeeResponse: {
      ...adjusted.draft.employeeResponse,
      resultId: adjusted.draft.id,
      resultVersion: adjusted.draft.version,
      status: '待确认' as const
    },
    events: [
      ...adjusted.draft.events,
      buildPerformanceResultEvent(
        adjusted.draft.resultKey,
        adjusted.draft.version,
        '发布结果',
        input.actor,
        input.deliveredAt,
        `发布 ${adjusted.draft.period} 季度绩效结果并送达员工`
      )
    ],
    lifecycleStatus: '已发布' as const,
    publishedAt: input.deliveredAt,
    publishedBy: input.actor,
    responseDeadline: input.responseDeadline.deadlineAt,
    responseDeadlineSnapshot: input.responseDeadline
  });

  return {
    result,
    results: [...formalResults, result],
    success: true
  };
}

export function correctQuarterlyPerformanceResult(
  formalResults: PerformanceResultSnapshot[],
  currentResult: PerformanceQuarterlyResultSnapshot,
  currentDraft: PerformanceQuarterlyResultSnapshot,
  adjustment: PerformanceQuarterlyAdjustmentInput,
  input: PerformanceResultCorrectionInput
): PerformanceResultMutation {
  const correctionReason = input.correctionReason.trim();

  if (currentResult.lifecycleStatus !== '已发布' && currentResult.lifecycleStatus !== '已结算') {
    return { reason: '只有已发布或已结算的季度结果可以更正', results: formalResults, success: false };
  }

  if (!correctionReason) {
    return { reason: '请填写更正原因', results: formalResults, success: false };
  }

  const currentFormalResult = getCurrentPerformanceResults(formalResults).get(currentResult.resultKey);

  if (!currentFormalResult || currentFormalResult.id !== currentResult.id) {
    return { reason: '只能更正当前有效季度结果版本', results: formalResults, success: false };
  }

  if (currentDraft.resultKey !== currentResult.resultKey || currentDraft.version !== currentResult.version + 1) {
    return { reason: '季度更正草稿版本无效', results: formalResults, success: false };
  }

  const adjusted = applyQuarterlyAdjustment(currentDraft, adjustment);

  if (!adjusted.draft) {
    return { reason: adjusted.reason, results: formalResults, success: false };
  }

  const blockingReasons = getQuarterlyPublishBlockingReasons(adjusted.draft);

  if (blockingReasons.length > 0) {
    return { reason: blockingReasons[0], results: formalResults, success: false };
  }

  if (adjusted.draft.sourceHash === currentResult.sourceHash) {
    return { reason: '当前季度来源与已发布版本一致，无需生成更正版本', results: formalResults, success: false };
  }

  const correctedOldResult = clonePerformanceSnapshotValue({
    ...currentResult,
    employeeResponse: currentResult.employeeResponse.status === '有异议'
      ? {
          ...currentResult.employeeResponse,
          resolvedAt: input.deliveredAt,
          resolvedBy: input.actor,
          resolutionSummary: `已生成 V${adjusted.draft.version} 更正结果：${correctionReason}`,
          status: '异议已处理' as const
        }
      : currentResult.employeeResponse,
    events: [
      ...currentResult.events,
      buildPerformanceResultEvent(
        currentResult.resultKey,
        currentResult.version,
        '标记已更正',
        input.actor,
        input.deliveredAt,
        `结果由 V${adjusted.draft.version} 替代：${correctionReason}`
      )
    ],
    lifecycleStatus: currentResult.lifecycleStatus === '已结算' ? '已结算' as const : '已更正' as const,
    supersededByResultId: adjusted.draft.id
  });
  const correctedResult = clonePerformanceSnapshotValue({
    ...adjusted.draft,
    correctionReason,
    deliveredAt: input.deliveredAt,
    employeeResponse: {
      ...adjusted.draft.employeeResponse,
      resultId: adjusted.draft.id,
      resultVersion: adjusted.draft.version,
      status: '待确认' as const
    },
    events: [
      buildPerformanceResultEvent(
        adjusted.draft.resultKey,
        adjusted.draft.version,
        '更正结果',
        input.actor,
        input.deliveredAt,
        `发布 V${adjusted.draft.version} 季度更正结果：${correctionReason}`
      )
    ],
    lifecycleStatus: '已发布' as const,
    publishedAt: input.deliveredAt,
    publishedBy: input.actor,
    responseDeadline: input.responseDeadline.deadlineAt,
    responseDeadlineSnapshot: input.responseDeadline,
    supersedesResultId: currentResult.id
  });
  const nextResults = formalResults
    .map((result) => (result.id === currentResult.id ? correctedOldResult : result))
    .concat(correctedResult);

  return {
    result: correctedResult,
    results: nextResults,
    success: true
  };
}

import {
  buildPerformanceResultEvent,
  clonePerformanceSnapshotValue
} from './performanceResultModel';
import { isPerformanceResultSalaryEligible } from './performanceResultResponseModel';
import type { PerformanceResultSnapshot } from './performanceTypes';

export type SettlePerformanceResultsInput = {
  actor: string;
  salarySettlementReferences: string[];
  settledAt: string;
};

export type SettlePerformanceResultsResult = {
  reason?: string;
  results: PerformanceResultSnapshot[];
  settledResultIds: string[];
  success: boolean;
};

export function settlePerformanceResults(
  formalResults: PerformanceResultSnapshot[],
  input: SettlePerformanceResultsInput
): SettlePerformanceResultsResult {
  const references = new Set(input.salarySettlementReferences);

  if (references.size === 0) {
    return {
      results: formalResults,
      settledResultIds: [],
      success: true
    };
  }

  const matchedResults = formalResults.filter((result) =>
    references.has(result.salarySettlementReference)
  );
  const matchedReferences = new Set(
    matchedResults.map((result) => result.salarySettlementReference)
  );
  const missingReference = [...references].find((reference) => !matchedReferences.has(reference));

  if (missingReference) {
    return {
      reason: `未找到绩效结算引用 ${missingReference}`,
      results: formalResults,
      settledResultIds: [],
      success: false
    };
  }

  const invalidResult = matchedResults.find(
    (result) => result.lifecycleStatus !== '已发布' && result.lifecycleStatus !== '已结算'
  );

  if (invalidResult) {
    return {
      reason: `绩效结果 ${invalidResult.id} 当前不能结算`,
      results: formalResults,
      settledResultIds: [],
      success: false
    };
  }

  const ineligibleResult = matchedResults.find(
    (result) =>
      result.lifecycleStatus === '已发布'
      && !isPerformanceResultSalaryEligible(formalResults, result.id, input.settledAt)
  );

  if (ineligibleResult) {
    return {
      reason: `绩效结果 ${ineligibleResult.id} 尚未满足薪酬结算条件`,
      results: formalResults,
      settledResultIds: [],
      success: false
    };
  }

  const settledResultIds = matchedResults
    .filter((result) => result.lifecycleStatus === '已发布')
    .map((result) => result.id);
  const nextResults = formalResults.map((result) => {
    if (!settledResultIds.includes(result.id)) {
      return result;
    }

    return clonePerformanceSnapshotValue({
      ...result,
      events: [
        ...result.events,
        buildPerformanceResultEvent(
          result.resultKey,
          result.version,
          '结算结果',
          input.actor,
          input.settledAt,
          `${result.period} ${result.kind}已由薪酬承接`
        )
      ],
      lifecycleStatus: '已结算' as const
    });
  });

  return {
    results: nextResults,
    settledResultIds,
    success: true
  };
}

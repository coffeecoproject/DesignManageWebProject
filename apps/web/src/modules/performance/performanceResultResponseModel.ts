import {
  buildPerformanceResultEvent,
  clonePerformanceSnapshotValue,
  getCurrentPerformanceResults
} from './performanceResultModel';
import type {
  PerformanceEmployeeResponseStatus,
  PerformanceResultSnapshot
} from './performanceTypes';

export type PerformanceEmployeeResponseDisplayStatus =
  | PerformanceEmployeeResponseStatus
  | '已送达未反馈';

export type PerformanceEmployeeResponseActionInput = {
  employeeId: string;
  respondedAt: string;
};

export type PerformanceEmployeeObjectionInput = PerformanceEmployeeResponseActionInput & {
  evidenceFileIds?: string[];
  objectionReason: string;
};

export type PerformanceObjectionResolutionInput = {
  actor: string;
  resolutionSummary: string;
  resolvedAt: string;
};

export type PerformanceResultResponseMutation = {
  reason?: string;
  result?: PerformanceResultSnapshot;
  results: PerformanceResultSnapshot[];
  success: boolean;
};

export type PerformanceEmployeeResponseAvailability = {
  allowed: boolean;
  displayStatus: PerformanceEmployeeResponseDisplayStatus;
  reason?: string;
};

function findFormalResult(formalResults: PerformanceResultSnapshot[], resultId: string) {
  return formalResults.find((result) => result.id === resultId);
}

function isCurrentResult(result: PerformanceResultSnapshot, formalResults: PerformanceResultSnapshot[]) {
  return getCurrentPerformanceResults(formalResults).get(result.resultKey)?.id === result.id;
}

function replaceFormalResult(
  formalResults: PerformanceResultSnapshot[],
  nextResult: PerformanceResultSnapshot
) {
  return formalResults.map((result) => (result.id === nextResult.id ? nextResult : result));
}

function getEmployeeActionBlocker(
  result: PerformanceResultSnapshot,
  formalResults: PerformanceResultSnapshot[],
  employeeId: string,
  respondedAt: string
) {
  if (!isCurrentResult(result, formalResults)) {
    return '只能反馈当前有效结果版本';
  }

  if (result.employeeId !== employeeId || result.employeeResponse.employeeId !== employeeId) {
    return '只能反馈本人的绩效结果';
  }

  if (result.lifecycleStatus !== '已发布') {
    return '只有当前已发布结果可以反馈';
  }

  if (
    result.employeeResponse.resultId !== result.id
    || result.employeeResponse.resultVersion !== result.version
  ) {
    return '绩效结果与反馈版本不一致';
  }

  if (!result.deliveredAt || !result.responseDeadline) {
    return '绩效结果缺少送达或反馈截止信息';
  }

  if (respondedAt < result.deliveredAt) {
    return '反馈时间不能早于结果送达时间';
  }

  if (respondedAt > result.responseDeadline) {
    return '绩效结果反馈期限已结束';
  }

  if (result.employeeResponse.status !== '待确认') {
    return '当前绩效结果已经反馈';
  }

  return undefined;
}

export function getPerformanceEmployeeResponseDisplayStatus(
  result: PerformanceResultSnapshot,
  asOf: string
): PerformanceEmployeeResponseDisplayStatus {
  if (
    result.employeeResponse.status === '待确认'
    && result.responseDeadline
    && asOf > result.responseDeadline
  ) {
    return '已送达未反馈';
  }

  return result.employeeResponse.status;
}

export function getPerformanceEmployeeResponseAvailability(
  formalResults: PerformanceResultSnapshot[],
  resultId: string,
  employeeId: string,
  asOf: string
): PerformanceEmployeeResponseAvailability {
  const result = findFormalResult(formalResults, resultId);

  if (!result) {
    return { allowed: false, displayStatus: '待确认', reason: '未找到绩效结果' };
  }

  const reason = getEmployeeActionBlocker(result, formalResults, employeeId, asOf);

  return {
    allowed: !reason,
    displayStatus: getPerformanceEmployeeResponseDisplayStatus(result, asOf),
    reason
  };
}

export function confirmPerformanceResult(
  formalResults: PerformanceResultSnapshot[],
  resultId: string,
  input: PerformanceEmployeeResponseActionInput
): PerformanceResultResponseMutation {
  const result = findFormalResult(formalResults, resultId);

  if (!result) {
    return { reason: '未找到绩效结果', results: formalResults, success: false };
  }

  const blocker = getEmployeeActionBlocker(
    result,
    formalResults,
    input.employeeId,
    input.respondedAt
  );

  if (blocker) {
    return { reason: blocker, results: formalResults, success: false };
  }

  const nextResult = clonePerformanceSnapshotValue({
    ...result,
    employeeResponse: {
      ...result.employeeResponse,
      respondedAt: input.respondedAt,
      status: '已确认' as const
    },
    events: [
      ...result.events,
      buildPerformanceResultEvent(
        result.resultKey,
        result.version,
        '确认结果',
        result.employeeNameSnapshot,
        input.respondedAt,
        `员工确认 ${result.period} ${result.kind} V${result.version}`
      )
    ]
  });

  return {
    result: nextResult,
    results: replaceFormalResult(formalResults, nextResult),
    success: true
  };
}

export function objectToPerformanceResult(
  formalResults: PerformanceResultSnapshot[],
  resultId: string,
  input: PerformanceEmployeeObjectionInput
): PerformanceResultResponseMutation {
  const result = findFormalResult(formalResults, resultId);
  const objectionReason = input.objectionReason.trim();

  if (!result) {
    return { reason: '未找到绩效结果', results: formalResults, success: false };
  }

  const blocker = getEmployeeActionBlocker(
    result,
    formalResults,
    input.employeeId,
    input.respondedAt
  );

  if (blocker) {
    return { reason: blocker, results: formalResults, success: false };
  }

  if (!objectionReason) {
    return { reason: '请填写异议原因', results: formalResults, success: false };
  }

  const evidenceFileIds = [...new Set(input.evidenceFileIds?.filter(Boolean) ?? [])];
  const nextResult = clonePerformanceSnapshotValue({
    ...result,
    employeeResponse: {
      ...result.employeeResponse,
      evidenceFileIds: evidenceFileIds.length > 0 ? evidenceFileIds : undefined,
      objectionReason,
      respondedAt: input.respondedAt,
      status: '有异议' as const
    },
    events: [
      ...result.events,
      buildPerformanceResultEvent(
        result.resultKey,
        result.version,
        '提出异议',
        result.employeeNameSnapshot,
        input.respondedAt,
        objectionReason
      )
    ]
  });

  return {
    result: nextResult,
    results: replaceFormalResult(formalResults, nextResult),
    success: true
  };
}

export function resolvePerformanceResultObjection(
  formalResults: PerformanceResultSnapshot[],
  resultId: string,
  input: PerformanceObjectionResolutionInput
): PerformanceResultResponseMutation {
  const result = findFormalResult(formalResults, resultId);
  const actor = input.actor.trim();
  const resolutionSummary = input.resolutionSummary.trim();

  if (!result) {
    return { reason: '未找到绩效结果', results: formalResults, success: false };
  }

  if (!isCurrentResult(result, formalResults) || result.lifecycleStatus !== '已发布') {
    return { reason: '只能处理当前已发布结果的异议', results: formalResults, success: false };
  }

  if (result.employeeResponse.status !== '有异议') {
    return { reason: '当前绩效结果没有待处理异议', results: formalResults, success: false };
  }

  if (!actor) {
    return { reason: '缺少异议处理人', results: formalResults, success: false };
  }

  if (!resolutionSummary) {
    return { reason: '请填写维持原结果的说明', results: formalResults, success: false };
  }

  if (result.employeeResponse.respondedAt && input.resolvedAt < result.employeeResponse.respondedAt) {
    return { reason: '异议处理时间不能早于员工反馈时间', results: formalResults, success: false };
  }

  const nextResult = clonePerformanceSnapshotValue({
    ...result,
    employeeResponse: {
      ...result.employeeResponse,
      resolvedAt: input.resolvedAt,
      resolvedBy: actor,
      resolutionSummary,
      status: '异议已处理' as const
    },
    events: [
      ...result.events,
      buildPerformanceResultEvent(
        result.resultKey,
        result.version,
        '维持原结果',
        actor,
        input.resolvedAt,
        resolutionSummary
      )
    ]
  });

  return {
    result: nextResult,
    results: replaceFormalResult(formalResults, nextResult),
    success: true
  };
}

export function isPerformanceResultSalaryEligible(
  formalResults: PerformanceResultSnapshot[],
  resultId: string,
  asOf: string
) {
  const result = findFormalResult(formalResults, resultId);

  if (
    !result
    || !isCurrentResult(result, formalResults)
    || (result.lifecycleStatus !== '已发布' && result.lifecycleStatus !== '已结算')
  ) {
    return false;
  }

  if (
    result.kind === '月度结果'
    && result.calculationSnapshot.categoryRecord.ruleApplicability?.status !== '适用'
  ) {
    return false;
  }

  if (result.employeeResponse.status === '有异议') {
    return false;
  }

  if (
    result.employeeResponse.status === '已确认'
    || result.employeeResponse.status === '异议已处理'
  ) {
    return true;
  }

  return Boolean(result.responseDeadline && asOf > result.responseDeadline);
}

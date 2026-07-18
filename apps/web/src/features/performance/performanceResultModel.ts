import { buildPerformanceSalarySettlementReference } from './performanceMonthlyModel';
import type {
  PerformanceCalculationSnapshot,
  PerformanceDrawingTaskMonthlyRecord,
  PerformanceMonthlyCategoryRecord,
  PerformanceMonthlyResultSnapshot,
  PerformanceResultEvent,
  PerformanceResultReadRecord,
  PerformanceResultSnapshot
} from './performanceTypes';
import type { PerformanceResponseDeadline } from './performanceResultDeadlineModel';

export type PerformanceResultWorkflowInput = {
  actor: string;
  deliveredAt: string;
  responseDeadline: PerformanceResponseDeadline;
};

export type PerformanceResultCorrectionInput = PerformanceResultWorkflowInput & {
  correctionReason: string;
};

export type PerformanceResultMutation = {
  reason?: string;
  result?: PerformanceResultSnapshot;
  results: PerformanceResultSnapshot[];
  success: boolean;
};

type BuildPerformanceResultReadModelInput = {
  drawingTaskRecords: PerformanceDrawingTaskMonthlyRecord[];
  formalResults: PerformanceResultSnapshot[];
  monthlyRecords: PerformanceMonthlyCategoryRecord[];
};

type BuildMonthlyResultDraftInput = {
  drawingTaskRecord?: PerformanceDrawingTaskMonthlyRecord;
  record: PerformanceMonthlyCategoryRecord;
  version?: number;
};

const systemPerformanceActor = '系统';

export function clonePerformanceSnapshotValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function hashPerformanceSource(value: unknown) {
  const serialized = stableSerialize(value);
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `prh-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function getPerformanceResultId(resultKey: string, version: number) {
  return `performance-result:${resultKey}:v${version}`;
}

function getPerformanceResultKey(record: PerformanceMonthlyCategoryRecord) {
  return `monthly:${record.workNo}:${record.performanceMonth}:${record.category}`;
}

function getPerformanceRuleId(record: PerformanceMonthlyCategoryRecord) {
  return record.ruleApplicability?.ruleId ?? `${record.ruleName}:${record.ruleVersion}`;
}

function buildCalculationSnapshot(
  record: PerformanceMonthlyCategoryRecord,
  drawingTaskRecord?: PerformanceDrawingTaskMonthlyRecord
): PerformanceCalculationSnapshot {
  return clonePerformanceSnapshotValue({
    categoryRecord: record,
    drawingTaskRecord
  });
}

export function buildPerformanceResultEvent(
  resultKey: string,
  version: number,
  action: PerformanceResultEvent['action'],
  actor: string,
  time: string,
  summary: string
): PerformanceResultEvent {
  return {
    action,
    actor,
    id: `${resultKey}:v${version}:${action}:${time}`,
    resultVersion: version,
    summary,
    time
  };
}

export function buildMonthlyPerformanceResultDraft({
  drawingTaskRecord,
  record,
  version = 1
}: BuildMonthlyResultDraftInput): PerformanceMonthlyResultSnapshot {
  const resultKey = getPerformanceResultKey(record);
  const id = getPerformanceResultId(resultKey, version);
  const calculationSnapshot = buildCalculationSnapshot(record, drawingTaskRecord);

  return {
    calculationSnapshot,
    employeeId: record.workNo,
    employeeNameSnapshot: record.employeeName,
    employeeResponse: {
      employeeId: record.workNo,
      resultId: id,
      resultVersion: version,
      status: '待确认'
    },
    events: [
      buildPerformanceResultEvent(
        resultKey,
        version,
        '生成草稿',
        systemPerformanceActor,
        record.updatedAt,
        `按 ${record.sourceTaskCount} 条有效来源生成月度绩效草稿`
      )
    ],
    id,
    kind: '月度结果',
    lifecycleStatus: '待发布',
    monthlyAmount: record.monthlyAmount,
    period: record.performanceMonth,
    positionSnapshot: record.position,
    prepayAmount: record.prepayAmount,
    resultKey,
    ruleId: getPerformanceRuleId(record),
    ruleNameSnapshot: record.ruleName,
    ruleVersion: record.ruleVersion,
    salarySettlementReference: buildPerformanceSalarySettlementReference(resultKey, 'monthly-prepay', `v${version}`),
    sourceHash: hashPerformanceSource(calculationSnapshot),
    sourceRecordIds: [...record.sourceRecordIds],
    version,
    workNoSnapshot: record.workNo
  };
}

export function getCurrentPerformanceResults(formalResults: PerformanceResultSnapshot[]) {
  const currentByKey = new Map<string, PerformanceResultSnapshot>();

  for (const result of formalResults) {
    if (result.lifecycleStatus === '已更正') {
      continue;
    }

    const current = currentByKey.get(result.resultKey);

    if (!current || result.version > current.version) {
      currentByKey.set(result.resultKey, result);
    }
  }

  return currentByKey;
}

export function getLatestPerformanceResultVersion(resultKey: string, formalResults: PerformanceResultSnapshot[]) {
  return formalResults
    .filter((result) => result.resultKey === resultKey)
    .reduce((latest, result) => Math.max(latest, result.version), 0);
}

export function isMonthlyPerformanceResult(
  result: PerformanceResultSnapshot
): result is PerformanceMonthlyResultSnapshot {
  return result.kind === '月度结果';
}

export function buildPerformanceResultReadModel({
  drawingTaskRecords,
  formalResults,
  monthlyRecords
}: BuildPerformanceResultReadModelInput): PerformanceResultReadRecord[] {
  const drawingById = new Map(drawingTaskRecords.map((record) => [record.id, record]));
  const sourceByKey = new Map(monthlyRecords.map((record) => [getPerformanceResultKey(record), record]));
  const currentFormalByKey = new Map(
    [...getCurrentPerformanceResults(formalResults)]
      .filter((entry): entry is [string, PerformanceMonthlyResultSnapshot] => isMonthlyPerformanceResult(entry[1]))
  );
  const resultKeys = new Set([...sourceByKey.keys(), ...currentFormalByKey.keys()]);

  return [...resultKeys]
    .map<PerformanceResultReadRecord>((resultKey) => {
      const sourceRecord = sourceByKey.get(resultKey);
      const currentFormal = currentFormalByKey.get(resultKey);

      if (currentFormal) {
        const currentSourceSnapshot = sourceRecord
          ? buildCalculationSnapshot(sourceRecord, drawingById.get(sourceRecord.id))
          : undefined;

        return {
          currentSourceRecord: sourceRecord,
          publishBlockingReasons: [],
          result: clonePerformanceSnapshotValue(currentFormal),
          sourceAvailable: Boolean(sourceRecord),
          sourceChangedSincePublish: currentSourceSnapshot
            ? hashPerformanceSource(currentSourceSnapshot) !== currentFormal.sourceHash
            : false
        };
      }

      const version = getLatestPerformanceResultVersion(resultKey, formalResults) + 1;
      const draft = buildMonthlyPerformanceResultDraft({
        drawingTaskRecord: sourceRecord ? drawingById.get(sourceRecord.id) : undefined,
        record: sourceRecord!,
        version
      });

      return {
        currentSourceRecord: sourceRecord,
        publishBlockingReasons: sourceRecord?.ruleApplicability?.status === '适用'
          ? []
          : [sourceRecord?.ruleApplicability?.note ?? '绩效规则当前不适用'],
        result: draft,
        sourceAvailable: true,
        sourceChangedSincePublish: false
      };
    })
    .sort(
      (left, right) =>
        right.result.period.localeCompare(left.result.period) ||
        left.result.employeeNameSnapshot.localeCompare(right.result.employeeNameSnapshot, 'zh-CN') ||
        left.result.resultKey.localeCompare(right.result.resultKey)
    );
}

export function publishPerformanceResult(
  formalResults: PerformanceResultSnapshot[],
  draft: PerformanceMonthlyResultSnapshot,
  input: PerformanceResultWorkflowInput
): PerformanceResultMutation {
  if (draft.lifecycleStatus !== '待发布') {
    return { reason: '只有待发布结果可以发布', results: formalResults, success: false };
  }

  if (getCurrentPerformanceResults(formalResults).has(draft.resultKey)) {
    return { reason: '该期间当前结果已经发布', results: formalResults, success: false };
  }

  const result = clonePerformanceSnapshotValue({
    ...draft,
    deliveredAt: input.deliveredAt,
    employeeResponse: {
      ...draft.employeeResponse,
      resultId: draft.id,
      resultVersion: draft.version,
      status: '待确认' as const
    },
    events: [
      ...draft.events,
      buildPerformanceResultEvent(
        draft.resultKey,
        draft.version,
        '发布结果',
        input.actor,
        input.deliveredAt,
        `发布 ${draft.period} 月度绩效结果并送达员工`
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

export function correctPerformanceResult(
  formalResults: PerformanceResultSnapshot[],
  currentResult: PerformanceMonthlyResultSnapshot,
  currentSource: PerformanceMonthlyCategoryRecord,
  drawingTaskRecord: PerformanceDrawingTaskMonthlyRecord | undefined,
  input: PerformanceResultCorrectionInput
): PerformanceResultMutation {
  const correctionReason = input.correctionReason.trim();

  if (currentResult.lifecycleStatus !== '已发布' && currentResult.lifecycleStatus !== '已结算') {
    return { reason: '只有已发布或已结算的结果可以更正', results: formalResults, success: false };
  }

  if (!correctionReason) {
    return { reason: '请填写更正原因', results: formalResults, success: false };
  }

  const currentFormalResult = getCurrentPerformanceResults(formalResults).get(currentResult.resultKey);

  if (!currentFormalResult || currentFormalResult.id !== currentResult.id) {
    return { reason: '只能更正当前有效结果版本', results: formalResults, success: false };
  }

  const version = currentResult.version + 1;
  const correctionDraft = buildMonthlyPerformanceResultDraft({ drawingTaskRecord, record: currentSource, version });

  if (correctionDraft.sourceHash === currentResult.sourceHash) {
    return { reason: '当前来源与已发布版本一致，无需生成更正版本', results: formalResults, success: false };
  }
  const correctedOldResult = clonePerformanceSnapshotValue({
    ...currentResult,
    employeeResponse: currentResult.employeeResponse.status === '有异议'
      ? {
          ...currentResult.employeeResponse,
          resolvedAt: input.deliveredAt,
          resolvedBy: input.actor,
          resolutionSummary: `已生成 V${version} 更正结果：${correctionReason}`,
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
        `结果由 V${version} 替代：${correctionReason}`
      )
    ],
    lifecycleStatus: currentResult.lifecycleStatus === '已结算' ? '已结算' as const : '已更正' as const,
    supersededByResultId: correctionDraft.id
  });
  const correctedResult = clonePerformanceSnapshotValue({
    ...correctionDraft,
    correctionReason,
    deliveredAt: input.deliveredAt,
    employeeResponse: {
      ...correctionDraft.employeeResponse,
      resultId: correctionDraft.id,
      resultVersion: version,
      status: '待确认' as const
    },
    events: [
      buildPerformanceResultEvent(
        correctionDraft.resultKey,
        version,
        '更正结果',
        input.actor,
        input.deliveredAt,
        `发布 V${version} 更正结果：${correctionReason}`
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

export function getPublishedPerformanceResultRecords(results: PerformanceResultReadRecord[]) {
  return results
    .map(({ result }) => result)
    .filter((result): result is PerformanceMonthlyResultSnapshot =>
      isMonthlyPerformanceResult(result)
      && (result.lifecycleStatus === '已发布' || result.lifecycleStatus === '已结算')
    )
    .map((result) => clonePerformanceSnapshotValue({
      ...result.calculationSnapshot.categoryRecord,
      monthlyAmount: result.monthlyAmount,
      prepayAmount: result.prepayAmount,
      resultLifecycleStatus: result.lifecycleStatus,
      resultResponseStatus: result.employeeResponse.status,
      salarySettlementReference: result.salarySettlementReference
    }));
}

export function getPerformanceResultHistory(resultKey: string, formalResults: PerformanceResultSnapshot[]) {
  return formalResults
    .filter((result) => result.resultKey === resultKey)
    .sort((left, right) => right.version - left.version)
    .map(clonePerformanceSnapshotValue);
}

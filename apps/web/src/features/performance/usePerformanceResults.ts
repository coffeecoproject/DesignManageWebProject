import { useMemo } from 'react';
import dayjs from 'dayjs';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { useWorkCalendarState } from '../system/WorkCalendarState';
import { buildPerformanceResponseDeadline } from './performanceResultDeadlineModel';
import {
  buildPerformanceResultReadModel,
  getPerformanceResultHistory,
  getPublishedPerformanceResultRecords,
  isMonthlyPerformanceResult
} from './performanceResultModel';
import { usePerformanceResultState } from './PerformanceResultState';
import { usePerformanceRuleState } from './PerformanceRuleState';
import {
  buildPerformanceQuarterlyResultReadModel,
  type PerformanceQuarterlyAdjustmentInput
} from './performanceQuarterlyResultModel';
import { usePerformanceMonthlyRecords } from './usePerformanceMonthlyRecords';

type ResultActionInput = {
  actor: string;
  deliveredAt: string;
};

type CorrectResultActionInput = ResultActionInput & {
  correctionReason: string;
} & Partial<PerformanceQuarterlyAdjustmentInput>;

type PerformanceResultActionOutcome = {
  reason?: string;
  success: boolean;
};

type EmployeeResultFeedbackInput = {
  employeeId: string;
  respondedAt: string;
};

type EmployeeResultObjectionInput = EmployeeResultFeedbackInput & {
  evidenceFileIds?: string[];
  objectionReason: string;
};

type EmployeeObjectionResolutionInput = {
  actor: string;
  resolutionSummary: string;
  resolvedAt: string;
};

type PublishResultActionInput = ResultActionInput & Partial<PerformanceQuarterlyAdjustmentInput>;

export function usePerformanceResults() {
  const performanceMonthlyRecords = usePerformanceMonthlyRecords();
  const { peopleRows } = usePeopleOrganizationState();
  const { annualExceptionRows, workCalendarRows } = useWorkCalendarState();
  const { performanceRuleRows } = usePerformanceRuleState();
  const resultState = usePerformanceResultState();
  const monthlyResults = useMemo(
    () =>
      buildPerformanceResultReadModel({
        drawingTaskRecords: performanceMonthlyRecords.drawingTaskRecords,
        formalResults: resultState.formalResults,
        monthlyRecords: performanceMonthlyRecords.categoryRecords
      }),
    [performanceMonthlyRecords.categoryRecords, performanceMonthlyRecords.drawingTaskRecords, resultState.formalResults]
  );
  const publishedMonthlyRecords = useMemo(
    () => getPublishedPerformanceResultRecords(monthlyResults),
    [monthlyResults]
  );
  const quarterlyRuleIds = useMemo(
    () => performanceRuleRows
      .filter((rule) => rule.reviewCycle === '季度复核')
      .map((rule) => rule.id),
    [performanceRuleRows]
  );
  const quarterlyResults = useMemo(
    () => buildPerformanceQuarterlyResultReadModel({
      asOfDate: dayjs().format('YYYY-MM-DD'),
      formalResults: resultState.formalResults,
      monthlyResults,
      quarterlyRuleIds
    }),
    [monthlyResults, quarterlyRuleIds, resultState.formalResults]
  );
  const allResults = useMemo(
    () => [...monthlyResults, ...quarterlyResults].sort(
      (left, right) =>
        right.result.period.localeCompare(left.result.period)
        || left.result.employeeNameSnapshot.localeCompare(right.result.employeeNameSnapshot, 'zh-CN')
        || left.result.kind.localeCompare(right.result.kind, 'zh-CN')
    ),
    [monthlyResults, quarterlyResults]
  );

  function buildDeadline(resultKey: string, deliveredAt: string) {
    const target = allResults.find(({ result }) => result.resultKey === resultKey);
    const member = target ? peopleRows.find((row) => row.id === target.result.employeeId) : undefined;

    if (!target) {
      return { reason: '未找到绩效结果' };
    }

    if (!member) {
      return { reason: '未找到结果对应员工' };
    }

    if (
      isMonthlyPerformanceResult(target.result)
      && target.currentSourceRecord?.ruleApplicability?.status !== '适用'
    ) {
      return { reason: target.currentSourceRecord?.ruleApplicability?.note ?? '绩效规则当前不适用' };
    }

    const responseDeadline = buildPerformanceResponseDeadline({
      annualExceptionRows,
      deliveredAt,
      member,
      workCalendarRows
    });

    return responseDeadline
      ? { responseDeadline, target }
      : { reason: '员工适用工作日历不可用，无法生成反馈截止时间' };
  }

  function publishResult(resultKey: string, input: PublishResultActionInput): PerformanceResultActionOutcome {
    const deadlineResult = buildDeadline(resultKey, input.deliveredAt);

    if (!deadlineResult.target || !deadlineResult.responseDeadline) {
      return { reason: deadlineResult.reason, success: false };
    }

    const { target } = deadlineResult;
    const workflowInput = {
      actor: input.actor,
      deliveredAt: input.deliveredAt,
      responseDeadline: deadlineResult.responseDeadline
    };
    const outcome = isMonthlyPerformanceResult(target.result)
      ? resultState.publishMonthlyResult(target.result, workflowInput)
      : target.currentQuarterDraft
        ? resultState.publishQuarterlyResult(
            target.currentQuarterDraft,
            {
              adjustmentAmount: input.adjustmentAmount ?? 0,
              adjustmentReason: input.adjustmentReason ?? '',
              evidenceFileIds: input.evidenceFileIds
            },
            workflowInput
          )
        : { reason: '季度结果当前来源不可用', results: resultState.formalResults, success: false };

    return { reason: outcome.reason, success: outcome.success };
  }

  function correctResult(resultKey: string, input: CorrectResultActionInput): PerformanceResultActionOutcome {
    const deadlineResult = buildDeadline(resultKey, input.deliveredAt);

    if (!deadlineResult.target || !deadlineResult.responseDeadline) {
      return { reason: deadlineResult.reason, success: false };
    }

    const outcome = isMonthlyPerformanceResult(deadlineResult.target.result)
      ? deadlineResult.target.currentSourceRecord
        ? resultState.correctMonthlyResult(
            deadlineResult.target.result,
            deadlineResult.target.currentSourceRecord,
            performanceMonthlyRecords.drawingTaskRecords.find(
              (record) => record.id === deadlineResult.target?.currentSourceRecord?.id
            ),
            {
              ...input,
              responseDeadline: deadlineResult.responseDeadline
            }
          )
        : { reason: '当前来源已不存在，不能直接生成更正版本', results: resultState.formalResults, success: false }
      : deadlineResult.target.currentQuarterDraft
        ? resultState.correctQuarterlyResult(
            deadlineResult.target.result,
            deadlineResult.target.currentQuarterDraft,
            {
              adjustmentAmount: input.adjustmentAmount
                ?? deadlineResult.target.currentQuarterDraft.quarterAdjustmentAmount,
              adjustmentReason: input.adjustmentReason
                ?? deadlineResult.target.currentQuarterDraft.quarterAdjustmentReason
                ?? '',
              evidenceFileIds: input.evidenceFileIds
                ?? deadlineResult.target.currentQuarterDraft.quarterEvidenceFileIds
            },
            {
              ...input,
              responseDeadline: deadlineResult.responseDeadline
            }
          )
        : { reason: '当前季度来源已不存在，不能生成更正版本', results: resultState.formalResults, success: false };

    return { reason: outcome.reason, success: outcome.success };
  }

  function confirmEmployeeResult(
    resultId: string,
    input: EmployeeResultFeedbackInput
  ): PerformanceResultActionOutcome {
    const outcome = resultState.confirmEmployeeResult(resultId, input);

    return { reason: outcome.reason, success: outcome.success };
  }

  function objectToEmployeeResult(
    resultId: string,
    input: EmployeeResultObjectionInput
  ): PerformanceResultActionOutcome {
    const outcome = resultState.objectToEmployeeResult(resultId, input);

    return { reason: outcome.reason, success: outcome.success };
  }

  function resolveEmployeeObjection(
    resultId: string,
    input: EmployeeObjectionResolutionInput
  ): PerformanceResultActionOutcome {
    const outcome = resultState.resolveEmployeeObjection(resultId, input);

    return { reason: outcome.reason, success: outcome.success };
  }

  return {
    allResults,
    confirmEmployeeResult,
    correctResult,
    formalResults: resultState.formalResults,
    getResultHistory: (resultKey: string) => getPerformanceResultHistory(resultKey, resultState.formalResults),
    monthlyResults,
    objectToEmployeeResult,
    performanceMonthlyRecords,
    publishResult,
    publishedMonthlyRecords,
    quarterlyResults,
    resolveEmployeeObjection,
    settleSalaryResults: resultState.settleSalaryResults
  };
}

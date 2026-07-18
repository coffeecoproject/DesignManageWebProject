import type { PeopleMember } from '../people/peopleTypes';
import type {
  AnnualExceptionConfigRow,
  WorkCalendarRow
} from '../system/WorkCalendarState';
import { buildPerformanceResponseDeadline } from './performanceResultDeadlineModel';
import {
  buildPerformanceResultReadModel,
  isMonthlyPerformanceResult,
  publishPerformanceResult
} from './performanceResultModel';
import type {
  PerformanceDrawingTaskMonthlyRecord,
  PerformanceMonthlyCategoryRecord,
  PerformanceResultSnapshot
} from './performanceTypes';

export const performanceResultDemoEmployeeId = '20260001';

type BuildPerformanceResultMockBootstrapInput = {
  actor: string;
  annualExceptionRows: AnnualExceptionConfigRow[];
  deliveredAt: string;
  drawingTaskRecords: PerformanceDrawingTaskMonthlyRecord[];
  employeeId: string;
  monthlyRecords: PerformanceMonthlyCategoryRecord[];
  peopleRows: PeopleMember[];
  workCalendarRows: WorkCalendarRow[];
};

export type PerformanceResultMockBootstrap = {
  reason?: string;
  results: PerformanceResultSnapshot[];
  success: boolean;
};

export function buildPerformanceResultMockBootstrap({
  actor,
  annualExceptionRows,
  deliveredAt,
  drawingTaskRecords,
  employeeId,
  monthlyRecords,
  peopleRows,
  workCalendarRows
}: BuildPerformanceResultMockBootstrapInput): PerformanceResultMockBootstrap {
  const member = peopleRows.find((row) => row.id === employeeId);

  if (!member) {
    return { reason: '未找到演示账号对应人员', results: [], success: false };
  }

  const target = buildPerformanceResultReadModel({
    drawingTaskRecords,
    formalResults: [],
    monthlyRecords
  }).find(
    ({ currentSourceRecord, result }) =>
      result.employeeId === employeeId
      && result.lifecycleStatus === '待发布'
      && currentSourceRecord?.ruleApplicability?.status === '适用'
      && currentSourceRecord.sourceTaskCount > 0
  );

  if (!target || !isMonthlyPerformanceResult(target.result)) {
    return { reason: '当前演示账号没有可发布的任务绩效来源', results: [], success: false };
  }

  const responseDeadline = buildPerformanceResponseDeadline({
    annualExceptionRows,
    deliveredAt,
    member,
    workCalendarRows
  });

  if (!responseDeadline) {
    return { reason: '当前演示账号的工作日历不可用', results: [], success: false };
  }

  const outcome = publishPerformanceResult([], target.result, {
    actor,
    deliveredAt,
    responseDeadline
  });

  return {
    reason: outcome.reason,
    results: outcome.results,
    success: outcome.success
  };
}

import type { PerformanceMonthlyCategoryRecord } from './performanceTypes';

export type PerformanceEmployeeConsumerSummary = {
  period?: string;
  score: number | null;
  sourceTaskCount: number;
};

export function getLatestPublishedPerformanceSummary(
  records: PerformanceMonthlyCategoryRecord[],
  employeeId: string
): PerformanceEmployeeConsumerSummary {
  const latestRecord = records
    .filter(
      (record) => record.workNo === employeeId && record.resultResponseStatus !== '有异议'
    )
    .sort(
      (left, right) =>
        right.performanceMonth.localeCompare(left.performanceMonth)
        || right.updatedAt.localeCompare(left.updatedAt)
        || right.id.localeCompare(left.id)
    )[0];
  const score = latestRecord?.qualityScore ?? latestRecord?.taskScore;

  return {
    period: latestRecord?.performanceMonth,
    score: typeof score === 'number' ? score : null,
    sourceTaskCount: latestRecord?.sourceTaskCount ?? 0
  };
}

export function formatPublishedPerformanceScore(score: number | null) {
  return score === null ? '-' : `${score.toFixed(2).replace(/\.00$/, '')} 分`;
}

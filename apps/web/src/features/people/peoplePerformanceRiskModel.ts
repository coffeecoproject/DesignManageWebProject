import type { PerformanceMonthlyCategoryRecord, PerformanceRulePreset } from '../performance/performanceTypes';
import type { PeopleMember } from './peopleTypes';

export const peoplePerformanceTerminationRiskLabel = '绩效规则低分风险';

function getPublishedApplicableRules(member: PeopleMember, performanceRuleRows: PerformanceRulePreset[]) {
  return performanceRuleRows.filter(
    (rule) => rule.status === '已发布' && rule.personnelType === member.personnelType && rule.applicablePositions.includes(member.position)
  );
}

export function getPerformanceTerminationScoreThreshold(performanceRuleRows: PerformanceRulePreset[]) {
  const terminationBands = performanceRuleRows
    .flatMap((rule) => rule.qualityBands)
    .filter((band) => band.minScore === 0 || band.scoreRange.includes('以下'));

  if (terminationBands.length === 0) {
    return undefined;
  }

  return Math.max(...terminationBands.map((band) => band.maxScore ?? band.minScore));
}

function getLatestPerformanceRecord(records: PerformanceMonthlyCategoryRecord[]) {
  return [...records].sort(
    (left, right) =>
      right.performanceMonth.localeCompare(left.performanceMonth)
      || right.updatedAt.localeCompare(left.updatedAt)
  )[0];
}

export function getPeoplePerformanceRuleRiskLabels(
  member: PeopleMember,
  performanceRuleRows: PerformanceRulePreset[],
  publishedPerformanceRecords: PerformanceMonthlyCategoryRecord[] = []
) {
  const applicableRules = getPublishedApplicableRules(member, performanceRuleRows);
  const threshold = getPerformanceTerminationScoreThreshold(applicableRules);

  if (typeof threshold !== 'number') {
    return [];
  }

  const latestRecord = getLatestPerformanceRecord(
    publishedPerformanceRecords.filter(
      (record) => record.workNo === member.id && record.resultResponseStatus !== '有异议'
    )
  );
  const latestScore = latestRecord?.qualityScore ?? latestRecord?.taskScore;

  return typeof latestScore === 'number' && latestScore <= threshold
    ? [peoplePerformanceTerminationRiskLabel]
    : [];
}

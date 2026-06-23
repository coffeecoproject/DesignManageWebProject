import type { PerformanceRulePreset } from '../performance/performanceTypes';
import type { PeopleMember, PeopleWorkEvaluationRecord } from './peopleTypes';

export const peoplePerformanceTerminationRiskLabel = '触发开除条件';

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

function getLatestEvaluationRecord(records: PeopleWorkEvaluationRecord[]) {
  return [...records].sort((left, right) => right.month.localeCompare(left.month))[0];
}

export function getPeoplePerformanceRuleRiskLabels(member: PeopleMember, performanceRuleRows: PerformanceRulePreset[]) {
  const applicableRules = getPublishedApplicableRules(member, performanceRuleRows);
  const threshold = getPerformanceTerminationScoreThreshold(applicableRules);

  if (typeof threshold !== 'number') {
    return [];
  }

  const records = member.workEvaluationRecords.length > 0 ? member.workEvaluationRecords : [member.workEvaluationSummary];
  const latestRecord = getLatestEvaluationRecord(records);

  return latestRecord && latestRecord.score <= threshold ? [peoplePerformanceTerminationRiskLabel] : [];
}

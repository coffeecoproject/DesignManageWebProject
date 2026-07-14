import { useMemo } from 'react';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { useWorkCalendarState } from '../system/WorkCalendarState';
import { useTaskManagementState } from '../tasks/TaskManagementState';
import {
  performanceMonthlyCategoryRecords
} from './performanceMockData';
import { buildPerformanceMonthlyRecords } from './performanceMonthlyModel';
import { attachPerformanceQuarterlyReviewFacts } from './performanceQuarterlyReviewModel';
import { usePerformanceMonthlyState } from './PerformanceMonthlyState';
import { usePerformanceRuleState } from './PerformanceRuleState';
import { performanceSignatureEmployees, signatureRuleOptions } from './performanceSignatureArchiveData';
import { buildTaskPerformanceMonthlySourceRecords } from './taskPerformanceMonthlySourceModel';

export function usePerformanceMonthlyRecords() {
  const { peopleRows } = usePeopleOrganizationState();
  const { annualExceptionRows, workCalendarRows } = useWorkCalendarState();
  const { performanceRuleRows } = usePerformanceRuleState();
  const { storeTaskRows, taskPerformanceScoringRows } = useTaskManagementState();
  const { quarterlyReviewFacts } = usePerformanceMonthlyState();

  return useMemo(() => {
    const taskPerformanceRecords = buildTaskPerformanceMonthlySourceRecords({
      peopleRows,
      ruleRows: performanceRuleRows,
      scoringRows: taskPerformanceScoringRows,
      taskRows: storeTaskRows
    });
    const peopleIds = new Set(peopleRows.map((member) => member.id));
    const nonTaskRecords = performanceMonthlyCategoryRecords.filter(
      (record) => record.category !== '绘图任务制' && peopleIds.has(record.workNo)
    );

    return buildPerformanceMonthlyRecords({
      annualExceptionRows,
      categoryRecords: attachPerformanceQuarterlyReviewFacts(
        [...taskPerformanceRecords, ...nonTaskRecords],
        quarterlyReviewFacts
      ),
      drawingTaskRecords: [],
      peopleRows,
      ruleOptions: signatureRuleOptions,
      ruleRows: performanceRuleRows,
      signatureEmployees: performanceSignatureEmployees,
      workCalendarRows
    });
  }, [
    annualExceptionRows,
    peopleRows,
    performanceRuleRows,
    quarterlyReviewFacts,
    storeTaskRows,
    taskPerformanceScoringRows,
    workCalendarRows
  ]);
}

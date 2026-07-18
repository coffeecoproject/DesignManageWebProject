import { useMemo } from 'react';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { useWorkCalendarState } from '../system/WorkCalendarState';
import { taskManagementToday, useTaskManagementState } from '../tasks/TaskManagementState';
import { buildPerformanceMonthlyRecords } from './performanceMonthlyModel';
import { usePerformanceRuleState } from './PerformanceRuleState';
import {
  buildTaskPerformanceMonthlySourceRecords,
  getTaskPerformanceSourceMonths
} from './taskPerformanceMonthlySourceModel';

export function usePerformanceMonthlyRecords() {
  const { peopleRows } = usePeopleOrganizationState();
  const { annualExceptionRows, workCalendarRows } = useWorkCalendarState();
  const { performanceRuleRows } = usePerformanceRuleState();
  const { storeTaskRows, taskPerformanceScoringRows } = useTaskManagementState();

  return useMemo(() => {
    const performanceMonths = getTaskPerformanceSourceMonths(
      performanceRuleRows,
      taskManagementToday
    );
    const drawingTaskRecords = buildTaskPerformanceMonthlySourceRecords({
      peopleRows,
      performanceMonths,
      ruleRows: performanceRuleRows,
      scoringRows: taskPerformanceScoringRows,
      taskRows: storeTaskRows
    });
    const monthlyRecords = buildPerformanceMonthlyRecords({
      annualExceptionRows,
      drawingTaskRecords,
      peopleRows,
      ruleRows: performanceRuleRows,
      workCalendarRows
    });

    return {
      categoryRecords: monthlyRecords.categoryRecords,
      drawingTaskRecords: monthlyRecords.drawingTaskRecords
    };
  }, [
    annualExceptionRows,
    peopleRows,
    performanceRuleRows,
    storeTaskRows,
    taskPerformanceScoringRows,
    workCalendarRows
  ]);
}

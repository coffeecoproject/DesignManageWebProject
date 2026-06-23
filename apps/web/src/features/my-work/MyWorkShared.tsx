import { useMemo } from 'react';
import { useCustomerManagementState } from '../customers/CustomerManagementState';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { usePerformanceRuleState } from '../performance/PerformanceRuleState';
import { useSalaryMonthlyReportBuilder } from '../salary/salaryReportBuilder';
import { useTaskConfigState } from '../system/TaskConfigState';
import { taskManagementNow, type StoreTaskRecord } from '../tasks/TaskManagementState';
import { useTaskManagementState } from '../tasks/TaskManagementState';
import type { TaskDetailTableRow } from '../tasks/components/TaskDetailTable';
import { getTaskTypeName as resolveTaskTypeName } from '../tasks/taskDisplayModel';
import {
  buildMyWorkArchiveSummary,
  buildMyWorkPerformanceTaskRows,
  buildMyWorkTaskRows,
  buildMyWorkTaskSummary,
  currentMyWorkMemberId,
  getLatestSalaryReport,
  getMySalaryReports,
  getMyWorkMember
} from './myWorkModel';

export function useMyWorkData() {
  const { getBrandById, getCustomerById, storeRows } = useCustomerManagementState();
  const { peopleRows } = usePeopleOrganizationState();
  const { performanceRuleRows } = usePerformanceRuleState();
  const { getSalaryMonthlyReports, salaryState } = useSalaryMonthlyReportBuilder();
  const { taskConfigRows } = useTaskConfigState();
  const { storeTaskRows, taskPerformanceScoringRows } = useTaskManagementState();

  const member = useMemo(() => getMyWorkMember(peopleRows, currentMyWorkMemberId), [peopleRows]);
  const month = taskManagementNow.slice(0, 7);
  const taskRows = useMemo<TaskDetailTableRow[]>(
    () => (member ? buildMyWorkTaskRows(member.id, storeTaskRows) : []),
    [member, storeTaskRows]
  );
  const taskSummary = useMemo(
    () =>
      member
        ? buildMyWorkTaskSummary(member.id, storeTaskRows, month)
        : {
            acceptorCount: 0,
            completedThisMonthCount: 0,
            currentTaskCount: 0,
            executorCount: 0,
            inProgressCount: 0,
            overdueCount: 0,
            pendingAcceptanceCount: 0,
            pendingMyAcceptanceCount: 0,
            pendingResubmitCount: 0,
            pendingSubmitCount: 0,
            rejectedCount: 0
          },
    [member, month, storeTaskRows]
  );
  const archiveSummary = useMemo(() => (member ? buildMyWorkArchiveSummary(member) : undefined), [member]);
  const salaryReports = useMemo(() => {
    if (!member) {
      return [];
    }

    return getMySalaryReports(member.id, salaryState.salaryDetailMonths.flatMap((salaryMonth) => getSalaryMonthlyReports(salaryMonth)));
  }, [getSalaryMonthlyReports, member, salaryState.salaryDetailMonths]);
  const latestSalaryReport = useMemo(() => getLatestSalaryReport(salaryReports), [salaryReports]);
  const performanceTaskRows = useMemo(
    () => (member ? buildMyWorkPerformanceTaskRows(member.id, storeTaskRows, taskPerformanceScoringRows) : []),
    [member, storeTaskRows, taskPerformanceScoringRows]
  );

  function getBrandName(task: StoreTaskRecord) {
    return getBrandById(task.brandId)?.name ?? '-';
  }

  function getCustomerName(task: StoreTaskRecord) {
    return getCustomerById(task.customerId)?.name ?? '-';
  }

  function getStoreLabel(task: StoreTaskRecord) {
    const store = storeRows.find((row) => row.id === task.storeId);
    return store ? `${store.name} / ${store.city}` : '-';
  }

  function getTaskTypeName(task: StoreTaskRecord) {
    return resolveTaskTypeName(task.taskConfigId, taskConfigRows);
  }

  function getTaskScoreText(task: StoreTaskRecord) {
    const brand = getBrandById(task.brandId);
    const rule = performanceRuleRows.find((row) => row.id === brand?.performanceRuleId);
    const scoreItem = rule?.taskScoreItems.find((item) => item.taskConfigId === task.taskConfigId);

    return scoreItem ? `${scoreItem.score} 分` : '-';
  }

  return {
    archiveSummary,
    getBrandName,
    getCustomerName,
    getStoreLabel,
    getTaskScoreText,
    getTaskTypeName,
    latestSalaryReport,
    member,
    performanceTaskRows,
    salaryReports,
    taskRows,
    taskSummary
  };
}

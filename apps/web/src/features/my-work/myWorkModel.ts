import type { PeopleArchiveStatus, PeopleMember } from '../people/peopleTypes';
import type {
  SalaryMonthlyReport,
  SalaryOperationRecord,
  SalarySettlementSourceRecord
} from '../salary/salaryDomain';
import type { StoreTaskRecord, TaskPerformanceScoringRecord } from '../tasks/TaskManagementState';
import type { TaskDetailRole, TaskDetailTableRow } from '../tasks/components/TaskDetailTable';
import { isOpenPersonTask, isPersonTaskOverdue } from '../tasks/personTaskViewModel';

export const currentMyWorkMemberId = '20260001';

export type MyWorkArchiveStatus = '已齐全' | '待补充' | '已归档';

export type MyWorkTaskSummary = {
  acceptorCount: number;
  completedThisMonthCount: number;
  currentTaskCount: number;
  executorCount: number;
  inProgressCount: number;
  overdueCount: number;
  pendingAcceptanceCount: number;
  pendingMyAcceptanceCount: number;
  pendingResubmitCount: number;
  pendingSubmitCount: number;
  rejectedCount: number;
};

export type MyWorkArchiveSummary = {
  fileCount: number;
  pendingFileCount: number;
  status: MyWorkArchiveStatus;
  updatedAt: string;
};

export type MyWorkPerformanceTaskRow = {
  id: string;
  qualityScore?: number;
  scoreValue?: number;
  sourceMonth: string;
  status: TaskPerformanceScoringRecord['status'];
  task?: StoreTaskRecord;
  updatedAt: string;
};

export type MySalaryDisplayStatus = '待发放' | '已发放';

export type MySalaryReport = SalaryMonthlyReport & {
  employeeOperationRecords: SalaryOperationRecord[];
  employeeSettlementSourceRecords: SalarySettlementSourceRecord[];
  employeeStatus: MySalaryDisplayStatus;
};

export function getMyWorkMember(peopleRows: PeopleMember[], memberId = currentMyWorkMemberId) {
  return peopleRows.find((member) => member.id === memberId);
}

export function toMyWorkArchiveStatus(status: PeopleArchiveStatus): MyWorkArchiveStatus {
  if (status === '资料完整') {
    return '已齐全';
  }

  if (status === '待补充') {
    return '待补充';
  }

  return '已归档';
}

export function buildMyWorkArchiveSummary(member: PeopleMember): MyWorkArchiveSummary {
  return {
    fileCount: member.archiveFiles.length,
    pendingFileCount: member.archiveFiles.filter((file) => file.status === '待补充').length,
    status: toMyWorkArchiveStatus(member.archiveStatus),
    updatedAt: member.archiveUpdatedAt
  };
}

export function getMyWorkTaskRoles(task: StoreTaskRecord, memberId: string): TaskDetailRole[] {
  const roles: TaskDetailRole[] = [];

  if (task.executorId === memberId) {
    roles.push('执行');
  }

  if (task.acceptorId === memberId) {
    roles.push('验收');
  }

  return roles;
}

function sortMyWorkTasks(left: StoreTaskRecord, right: StoreTaskRecord) {
  return (
    left.plannedDeliveryAt.localeCompare(right.plannedDeliveryAt) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.name.localeCompare(right.name)
  );
}

export function buildMyWorkTaskRows(memberId: string, storeTaskRows: StoreTaskRecord[]): TaskDetailTableRow[] {
  return storeTaskRows
    .filter(isOpenPersonTask)
    .filter((task) => getMyWorkTaskRoles(task, memberId).length > 0)
    .sort(sortMyWorkTasks)
    .flatMap((task) => getMyWorkTaskRoles(task, memberId).map((role) => ({ role, task })));
}

export function buildMyWorkTaskSummary(memberId: string, storeTaskRows: StoreTaskRecord[], month: string): MyWorkTaskSummary {
  const currentRows = buildMyWorkTaskRows(memberId, storeTaskRows);
  const currentTasks = Array.from(new Map(currentRows.map((row) => [row.task.id, row.task])).values());
  const completedThisMonthCount = storeTaskRows.filter(
    (task) => task.status === '已完成' && task.executorId === memberId && (task.acceptedAt ?? task.updatedAt).startsWith(month)
  ).length;

  return {
    acceptorCount: currentRows.filter((row) => row.role === '验收').length,
    completedThisMonthCount,
    currentTaskCount: currentTasks.length,
    executorCount: currentRows.filter((row) => row.role === '执行').length,
    inProgressCount: currentTasks.filter((task) => task.status === '进行中').length,
    overdueCount: currentTasks.filter((task) => isPersonTaskOverdue(task)).length,
    pendingAcceptanceCount: currentTasks.filter((task) => task.status === '待验收').length,
    pendingMyAcceptanceCount: currentRows.filter((row) => row.role === '验收' && row.task.status === '待验收').length,
    pendingResubmitCount: currentRows.filter((row) => row.role === '执行' && row.task.status === '验收驳回').length,
    pendingSubmitCount: currentRows.filter((row) => row.role === '执行' && row.task.status === '进行中').length,
    rejectedCount: currentTasks.filter((task) => task.status === '验收驳回').length
  };
}

export function getLatestSalaryReport(reports: MySalaryReport[]) {
  return [...reports].sort((left, right) => right.month.localeCompare(left.month))[0];
}

const employeeVisibleSalaryActions = new Set([
  '确认薪酬明细',
  '关联发放流水',
  '发放流水冲正'
]);

export function getMySalaryDisplayStatus(report: SalaryMonthlyReport): MySalaryDisplayStatus | undefined {
  if (report.status === '已发放') {
    return '已发放';
  }

  if (report.status === '已确认') {
    return '待发放';
  }

  return undefined;
}

export function getMySalaryOperationRecords(report: SalaryMonthlyReport) {
  return report.operationRecords.filter((record) => employeeVisibleSalaryActions.has(record.action));
}

export function getMySalarySettlementSourceRecords(report: SalaryMonthlyReport) {
  return report.settlementSourceRecords.filter((record) => record.status !== '待确认');
}

export function getMySalaryReports(memberId: string, reports: SalaryMonthlyReport[]): MySalaryReport[] {
  return reports
    .filter((report) => report.member.id === memberId)
    .flatMap((report) => {
      const employeeStatus = getMySalaryDisplayStatus(report);

      if (!employeeStatus) {
        return [];
      }

      return [{
        ...report,
        employeeOperationRecords: getMySalaryOperationRecords(report),
        employeeSettlementSourceRecords: getMySalarySettlementSourceRecords(report),
        employeeStatus
      }];
    })
    .sort((left, right) => right.month.localeCompare(left.month));
}

export function buildMyWorkPerformanceTaskRows(
  memberId: string,
  storeTaskRows: StoreTaskRecord[],
  scoringRows: TaskPerformanceScoringRecord[]
): MyWorkPerformanceTaskRow[] {
  const taskMap = new Map(storeTaskRows.map((task) => [task.id, task]));

  return scoringRows
    .map<MyWorkPerformanceTaskRow | undefined>((scoreRow) => {
      const task = taskMap.get(scoreRow.taskId);

      if (!task || task.executorId !== memberId) {
        return undefined;
      }

      return {
        id: scoreRow.id,
        qualityScore: scoreRow.qualityScore,
        scoreValue: scoreRow.scoreValue,
        sourceMonth: scoreRow.sourceMonth,
        status: scoreRow.status,
        task,
        updatedAt: scoreRow.updatedAt
      };
    })
    .filter((row): row is MyWorkPerformanceTaskRow => Boolean(row))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

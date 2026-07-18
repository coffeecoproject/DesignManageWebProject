import type { StatusTagTone } from '../../components/Detail';
import type { DateRangeFilterValue, DateScopeFilterValue } from '../../components/DateFilterFields';
import type { OperationRecord } from '../../components/OperationRecordTable';
import type { PeopleMember } from '../people/peopleTypes';
import { getLatestPublishedPerformanceSummary } from '../performance/performanceResultConsumerModel';
import type { PerformanceMonthlyCategoryRecord } from '../performance/performanceTypes';
import { isTaskHourBefore, taskManagementNow, type StoreTaskRecord, type StoreTaskStatus } from './TaskManagementState';
import type { TaskDetailTableRow } from './components/TaskDetailTable';

export type PersonTaskDispatchState = '当前可分配' | '需关注' | '不可分配';

export type PeopleTaskFilterState = {
  completionTime: DateScopeFilterValue;
  keyword: string;
  personnelType: '全部' | '全职' | '兼职';
  taskState: '全部' | '已完成' | '执行中' | '待验收' | '逾期' | '驳回' | '当前无任务';
};

export type PersonTaskRowMode = 'all' | 'executor' | 'acceptor' | 'completed' | 'exception';

export type PersonTaskDispatchSummary = {
  reason: string;
  state: PersonTaskDispatchState;
};

export type PersonTaskSummary = {
  acceptorTasks: StoreTaskRecord[];
  completedTasks: StoreTaskRecord[];
  dispatch: PersonTaskDispatchSummary;
  executorTasks: StoreTaskRecord[];
  id: string;
  inProgressTasks: StoreTaskRecord[];
  involvedTasks: StoreTaskRecord[];
  member: PeopleMember;
  overdueTasks: StoreTaskRecord[];
  pendingAcceptanceTasks: StoreTaskRecord[];
  performancePeriod?: string;
  performanceScore: number | null;
  rejectionCount: number;
  rejectedTasks: StoreTaskRecord[];
};

export type PersonTaskMetrics = {
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  pendingAcceptanceTasks: number;
  people: number;
  rejectionCount: number;
};

export const defaultPeopleTaskFilters: PeopleTaskFilterState = {
  completionTime: { mode: 'all' },
  keyword: '',
  personnelType: '全部',
  taskState: '全部'
};

const personTaskStatusTone: Record<string, StatusTagTone> = {
  在职: 'green',
  合作中: 'blue',
  离职: 'gray',
  结束合作: 'gray',
  试用期: 'amber'
};

const closedTaskStatuses = new Set<StoreTaskStatus>(['已完成', '已中止']);

function dedupeTasks(tasks: StoreTaskRecord[]) {
  return Array.from(new Map(tasks.map((task) => [task.id, task])).values());
}

function getPersonTaskSearchText(summary: PersonTaskSummary) {
  const taskText = [...summary.involvedTasks, ...summary.completedTasks].map((task) => `${task.name} ${task.code}`).join(' ');

  return [
    summary.member.id,
    summary.member.name,
    summary.member.mobile,
    summary.member.position,
    summary.member.personnelType,
    summary.member.status,
    taskText
  ].join(' ');
}

export function isOpenPersonTask(task: StoreTaskRecord) {
  return !closedTaskStatuses.has(task.status);
}

export function isCurrentTaskMember(member: PeopleMember) {
  if (member.personnelType === '全职') {
    return member.status === '试用期' || member.status === '在职';
  }

  return member.status === '合作中';
}

export function getPersonTaskStatusLabel(member: PeopleMember) {
  return `${member.personnelType} / ${member.status}`;
}

export function getPersonTaskStatusTone(status: string) {
  return personTaskStatusTone[status] ?? 'gray';
}

export function isPersonTaskOverdue(task: StoreTaskRecord, now = taskManagementNow) {
  return isOpenPersonTask(task) && isTaskHourBefore(task.plannedDeliveryAt, now);
}

function getTaskCompletionDate(task: StoreTaskRecord) {
  return (task.acceptedAt ?? task.updatedAt).slice(0, 10);
}

function isTaskCompletedInRange(task: StoreTaskRecord, completedRange?: DateRangeFilterValue) {
  if (!completedRange) {
    return true;
  }

  const completionDate = getTaskCompletionDate(task);
  return completionDate >= completedRange.startDate && completionDate <= completedRange.endDate;
}

export function getPersonTaskDispatchSummary(
  member: PeopleMember,
  {
    involvedTasks,
    now = taskManagementNow,
    overdueTasks,
    performanceScore,
    rejectedTasks
  }: {
    involvedTasks: StoreTaskRecord[];
    now?: string;
    overdueTasks?: StoreTaskRecord[];
    performanceScore?: number | null;
    rejectedTasks?: StoreTaskRecord[];
  }
): PersonTaskDispatchSummary {
  if (!isCurrentTaskMember(member)) {
    return {
      reason: '人员状态不可用',
      state: '不可分配'
    };
  }

  if (member.taskAccessStatus !== '可参与任务') {
    return {
      reason: member.taskAccessStatus === '暂停参与' ? '暂停接单' : '任务参与已关闭',
      state: '不可分配'
    };
  }

  if (member.taskCapabilityIds.length === 0) {
    return {
      reason: '未配置任务能力',
      state: '不可分配'
    };
  }

  const resolvedOverdueTasks = overdueTasks ?? involvedTasks.filter((task) => isPersonTaskOverdue(task, now));
  const resolvedRejectedTasks = rejectedTasks ?? involvedTasks.filter((task) => task.status === '验收驳回');
  const rejectionCount = resolvedRejectedTasks.reduce((total, task) => total + task.reworkCount, 0);

  if (resolvedOverdueTasks.length > 0) {
    return {
      reason: `逾期 ${resolvedOverdueTasks.length} 项`,
      state: '需关注'
    };
  }

  if (rejectionCount > 0) {
    return {
      reason: `驳回 ${rejectionCount} 次`,
      state: '需关注'
    };
  }

  if (involvedTasks.length >= 2) {
    return {
      reason: `当前 ${involvedTasks.length} 项`,
      state: '需关注'
    };
  }

  if (performanceScore !== null && performanceScore !== undefined && performanceScore < 80) {
    return {
      reason: `绩效 ${performanceScore} 分`,
      state: '需关注'
    };
  }

  return {
    reason: involvedTasks.length === 0 ? '暂无当前任务' : `当前 ${involvedTasks.length} 项`,
    state: '当前可分配'
  };
}

export function buildPersonTaskSummaries({
  completedRange,
  now = taskManagementNow,
  peopleRows,
  publishedPerformanceRecords,
  storeTaskRows
}: {
  completedRange?: DateRangeFilterValue;
  now?: string;
  peopleRows: PeopleMember[];
  publishedPerformanceRecords: PerformanceMonthlyCategoryRecord[];
  storeTaskRows: StoreTaskRecord[];
}) {
  const openTasks = storeTaskRows.filter(isOpenPersonTask);
  const completedTasks = storeTaskRows.filter((task) => task.status === '已完成' && isTaskCompletedInRange(task, completedRange));

  return peopleRows
    .map<PersonTaskSummary>((member) => {
      const executorTasks = openTasks.filter((task) => task.executorId === member.id);
      const acceptorTasks = openTasks.filter((task) => task.acceptorId === member.id);
      const memberCompletedTasks = completedTasks
        .filter((task) => task.executorId === member.id)
        .sort(
          (left, right) =>
            getTaskCompletionDate(right).localeCompare(getTaskCompletionDate(left)) ||
            right.updatedAt.localeCompare(left.updatedAt) ||
            left.name.localeCompare(right.name)
        );
      const involvedTasks = dedupeTasks([...executorTasks, ...acceptorTasks]).sort(
        (left, right) =>
          left.plannedDeliveryAt.localeCompare(right.plannedDeliveryAt) ||
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.name.localeCompare(right.name)
      );
      const inProgressTasks = executorTasks.filter((task) => task.status === '进行中');
      const pendingAcceptanceTasks = involvedTasks.filter((task) => task.status === '待验收');
      const overdueTasks = involvedTasks.filter((task) => isPersonTaskOverdue(task, now));
      const rejectedTasks = involvedTasks.filter((task) => task.status === '验收驳回');
      const rejectionCount = [...executorTasks, ...memberCompletedTasks].reduce((total, task) => total + task.reworkCount, 0);
      const performanceSummary = getLatestPublishedPerformanceSummary(
        publishedPerformanceRecords,
        member.id
      );
      const dispatch = getPersonTaskDispatchSummary(member, {
        involvedTasks,
        now,
        overdueTasks,
        performanceScore: performanceSummary.score,
        rejectedTasks
      });

      return {
        acceptorTasks,
        completedTasks: memberCompletedTasks,
        dispatch,
        executorTasks,
        id: member.id,
        inProgressTasks,
        involvedTasks,
        member,
        overdueTasks,
        pendingAcceptanceTasks,
        performancePeriod: performanceSummary.period,
        performanceScore: performanceSummary.score,
        rejectionCount,
        rejectedTasks
      };
    })
    .filter((summary) => isCurrentTaskMember(summary.member) || summary.involvedTasks.length > 0)
    .sort(
      (left, right) =>
        right.overdueTasks.length - left.overdueTasks.length ||
        right.rejectionCount - left.rejectionCount ||
        right.pendingAcceptanceTasks.length - left.pendingAcceptanceTasks.length ||
        right.inProgressTasks.length - left.inProgressTasks.length ||
        right.involvedTasks.length - left.involvedTasks.length ||
        (right.performanceScore ?? Number.NEGATIVE_INFINITY)
          - (left.performanceScore ?? Number.NEGATIVE_INFINITY) ||
        left.member.name.localeCompare(right.member.name)
    );
}

export function filterPersonTaskSummary(summary: PersonTaskSummary, filters: PeopleTaskFilterState) {
  if (filters.personnelType !== '全部' && summary.member.personnelType !== filters.personnelType) {
    return false;
  }

  if (filters.taskState === '已完成' && summary.completedTasks.length === 0) {
    return false;
  }

  if (filters.taskState === '执行中' && summary.inProgressTasks.length === 0) {
    return false;
  }

  if (filters.taskState === '待验收' && summary.pendingAcceptanceTasks.length === 0) {
    return false;
  }

  if (filters.taskState === '逾期' && summary.overdueTasks.length === 0) {
    return false;
  }

  if (filters.taskState === '驳回' && summary.rejectionCount === 0) {
    return false;
  }

  if (filters.taskState === '当前无任务' && summary.involvedTasks.length > 0) {
    return false;
  }

  const keyword = filters.keyword.trim().toLowerCase();

  if (!keyword) {
    return true;
  }

  return getPersonTaskSearchText(summary).toLowerCase().includes(keyword);
}

export function filterPersonTaskSummaries(summaries: PersonTaskSummary[], filters: PeopleTaskFilterState) {
  return summaries.filter((summary) => filterPersonTaskSummary(summary, filters));
}

export function getPersonTaskRows(summary: PersonTaskSummary, mode: PersonTaskRowMode): TaskDetailTableRow[] {
  if (mode === 'executor') {
    return summary.executorTasks.map((task) => ({ role: '执行', task }));
  }

  if (mode === 'acceptor') {
    return summary.acceptorTasks.map((task) => ({ role: '验收', task }));
  }

  if (mode === 'completed') {
    return summary.completedTasks.map((task) => ({ role: '完成', task }));
  }

  const taskRows = [
    ...summary.executorTasks.map((task) => ({ role: '执行' as const, task })),
    ...summary.acceptorTasks.map((task) => ({ role: '验收' as const, task }))
  ];

  if (mode === 'exception') {
    return taskRows.filter(({ task }) => task.status === '验收驳回' || isPersonTaskOverdue(task));
  }

  return taskRows;
}

export function getPersonTaskOperationRecords(summary: PersonTaskSummary) {
  return dedupeTasks([...summary.involvedTasks, ...summary.completedTasks]).flatMap((task) =>
    task.operationRecords.map<OperationRecord>((record) => ({
      ...record,
      object: task.name
    }))
  );
}

export function getPersonTaskMetrics(summaries: PersonTaskSummary[]): PersonTaskMetrics {
  return {
    completedTasks: summaries.reduce((total, summary) => total + summary.completedTasks.length, 0),
    inProgressTasks: summaries.reduce((total, summary) => total + summary.inProgressTasks.length, 0),
    overdueTasks: summaries.reduce((total, summary) => total + summary.overdueTasks.length, 0),
    pendingAcceptanceTasks: summaries.reduce((total, summary) => total + summary.pendingAcceptanceTasks.length, 0),
    people: summaries.length,
    rejectionCount: summaries.reduce((total, summary) => total + summary.rejectionCount, 0)
  };
}

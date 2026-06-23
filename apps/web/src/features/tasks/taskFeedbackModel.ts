import type { OperationRecord } from '../../components/OperationRecordTable';
import type { DateRangeFilterValue, DateScopeFilterValue } from '../../components/DateFilterFields';
import type { ClientFeedbackRecord, StoreTaskRecord } from './TaskManagementState';

export type TaskFeedbackTypeFilter = '全部' | '有驳回' | '有甲方反馈' | '两者都有';

export type TaskFeedbackFilterState = {
  brandId: '全部' | string;
  channel: '全部' | ClientFeedbackRecord['channel'];
  customerId: '全部' | string;
  feedbackTime: DateScopeFilterValue;
  feedbackType: TaskFeedbackTypeFilter;
  keyword: string;
};

export type TaskFeedbackLookupContext = {
  getBrandName: (task: StoreTaskRecord) => string;
  getCustomerName: (task: StoreTaskRecord) => string;
  getStoreLabel: (task: StoreTaskRecord) => string;
  getTaskTypeName: (task: StoreTaskRecord) => string;
};

export type TaskFeedbackMetrics = {
  clientFeedbackCount: number;
  feedbackFiles: number;
  reworkCount: number;
  tasks: number;
};

export type TaskInternalReworkRecord = {
  id: string;
  rejectedAt: string;
  rejectedBy: string;
  reason: string;
  requirement: string;
  sequence: number;
  summary: string;
};

export type TaskFeedbackSummary = {
  clientFeedbackCount: number;
  clientFeedbackRows: ClientFeedbackRecord[];
  id: string;
  internalRejectionCount: number;
  internalReworkRecords: TaskInternalReworkRecord[];
  latestFeedbackAt: string;
  task: StoreTaskRecord & { status: '已完成' };
};

export const defaultTaskFeedbackFilters: TaskFeedbackFilterState = {
  brandId: '全部',
  channel: '全部',
  customerId: '全部',
  feedbackTime: { mode: 'all' },
  feedbackType: '全部',
  keyword: ''
};

function maxDateTime(values: string[]) {
  return values.reduce((latest, value) => (value > latest ? value : latest), '');
}

function isReworkOperation(action: string) {
  return action.includes('驳回');
}

function getTaskCompletedAt(task: StoreTaskRecord) {
  return task.acceptedAt ?? task.updatedAt;
}

function getTaskFeedbackEventTimes(summary: TaskFeedbackSummary) {
  return [
    ...summary.clientFeedbackRows.map((record) => record.feedbackAt),
    ...summary.internalReworkRecords.map((record) => record.rejectedAt)
  ];
}

function isDateTimeInRange(value: string, range: DateRangeFilterValue) {
  const date = value.slice(0, 10);
  return date >= range.startDate && date <= range.endDate;
}

function hasFeedbackEventInRange(summary: TaskFeedbackSummary, range?: DateRangeFilterValue) {
  if (!range) {
    return true;
  }

  return getTaskFeedbackEventTimes(summary).some((time) => isDateTimeInRange(time, range));
}

function getTaskFeedbackSearchText(summary: TaskFeedbackSummary, lookup: TaskFeedbackLookupContext) {
  const task = summary.task;
  const clientFeedbackText = summary.clientFeedbackRows
    .map((record) => `${record.summary} ${record.content} ${record.feedbackBy} ${record.feedbackRole} ${record.channel}`)
    .join(' ');
  const internalReworkText = summary.internalReworkRecords
    .map((record) => `${record.reason} ${record.requirement} ${record.rejectedBy} ${record.summary}`)
    .join(' ');

  return [
    task.code,
    task.name,
    task.executorName,
    task.acceptorName,
    lookup.getCustomerName(task),
    lookup.getBrandName(task),
    lookup.getStoreLabel(task),
    lookup.getTaskTypeName(task),
    clientFeedbackText,
    internalReworkText
  ].join(' ');
}

function matchesFeedbackType(summary: TaskFeedbackSummary, feedbackType: TaskFeedbackTypeFilter) {
  if (feedbackType === '有驳回') {
    return summary.internalRejectionCount > 0;
  }

  if (feedbackType === '有甲方反馈') {
    return summary.clientFeedbackCount > 0;
  }

  if (feedbackType === '两者都有') {
    return summary.internalRejectionCount > 0 && summary.clientFeedbackCount > 0;
  }

  return true;
}

export function buildTaskInternalReworkRecords(task: StoreTaskRecord): TaskInternalReworkRecord[] {
  if (task.reworkCount <= 0) {
    return [];
  }

  const reworkOperations = task.operationRecords
    .filter((record) => isReworkOperation(record.action))
    .sort((left, right) => right.time.localeCompare(left.time));

  const operationRows = reworkOperations.map<TaskInternalReworkRecord>((record, index) => ({
    id: record.id ?? `${task.id}-rework-${index + 1}`,
    reason: index === 0 ? task.latestReworkReason ?? record.summary : record.summary,
    rejectedAt: record.time,
    rejectedBy: record.actor,
    requirement: index === 0 ? task.latestReworkRequirement ?? '-' : '-',
    sequence: task.reworkCount - index,
    summary: record.summary
  }));

  if (operationRows.length >= task.reworkCount) {
    return operationRows;
  }

  const fallbackRows = Array.from({ length: task.reworkCount - operationRows.length }, (_, index) => ({
    id: `${task.id}-rework-fallback-${index + 1}`,
    reason: task.latestReworkReason ?? '历史驳回记录',
    rejectedAt: task.updatedAt,
    rejectedBy: task.acceptorName,
    requirement: task.latestReworkRequirement ?? '-',
    sequence: task.reworkCount - operationRows.length - index,
    summary: task.latestReworkReason ?? '历史驳回记录'
  }));

  return [...operationRows, ...fallbackRows];
}

export function buildTaskFeedbackSummaries({
  clientFeedbackRows,
  storeTaskRows
}: {
  clientFeedbackRows: ClientFeedbackRecord[];
  storeTaskRows: StoreTaskRecord[];
}) {
  const feedbackByTask = new Map<string, ClientFeedbackRecord[]>();

  for (const record of clientFeedbackRows) {
    const rows = feedbackByTask.get(record.taskId) ?? [];
    rows.push(record);
    feedbackByTask.set(record.taskId, rows);
  }

  return storeTaskRows
    .filter((task): task is StoreTaskRecord & { status: '已完成' } => task.status === '已完成')
    .map<TaskFeedbackSummary | undefined>((task) => {
      const taskFeedbackRows = (feedbackByTask.get(task.id) ?? []).sort(
        (left, right) => right.feedbackAt.localeCompare(left.feedbackAt) || right.updatedAt.localeCompare(left.updatedAt)
      );
      const internalReworkRecords = buildTaskInternalReworkRecords(task);
      const latestFeedbackAt = maxDateTime([
        ...taskFeedbackRows.map((record) => record.feedbackAt),
        ...internalReworkRecords.map((record) => record.rejectedAt)
      ]);

      if (task.reworkCount === 0 && taskFeedbackRows.length === 0) {
        return undefined;
      }

      return {
        clientFeedbackCount: taskFeedbackRows.length,
        clientFeedbackRows: taskFeedbackRows,
        id: task.id,
        internalRejectionCount: task.reworkCount,
        internalReworkRecords,
        latestFeedbackAt,
        task
      };
    })
    .filter((summary): summary is TaskFeedbackSummary => Boolean(summary))
    .sort(
      (left, right) =>
        right.latestFeedbackAt.localeCompare(left.latestFeedbackAt) ||
        getTaskCompletedAt(right.task).localeCompare(getTaskCompletedAt(left.task)) ||
        left.task.name.localeCompare(right.task.name)
    );
}

export function getTaskFeedbackCompletedAt(summary: TaskFeedbackSummary) {
  return getTaskCompletedAt(summary.task);
}

export function filterTaskFeedbackSummary(
  summary: TaskFeedbackSummary,
  filters: TaskFeedbackFilterState,
  lookup: TaskFeedbackLookupContext,
  feedbackRange?: DateRangeFilterValue
) {
  const task = summary.task;

  if (filters.customerId !== '全部' && task.customerId !== filters.customerId) {
    return false;
  }

  if (filters.brandId !== '全部' && task.brandId !== filters.brandId) {
    return false;
  }

  if (filters.channel !== '全部' && !summary.clientFeedbackRows.some((record) => record.channel === filters.channel)) {
    return false;
  }

  if (!matchesFeedbackType(summary, filters.feedbackType)) {
    return false;
  }

  if (!hasFeedbackEventInRange(summary, feedbackRange)) {
    return false;
  }

  const keyword = filters.keyword.trim().toLowerCase();

  if (!keyword) {
    return true;
  }

  return getTaskFeedbackSearchText(summary, lookup).toLowerCase().includes(keyword);
}

export function filterTaskFeedbackSummaries(
  summaries: TaskFeedbackSummary[],
  filters: TaskFeedbackFilterState,
  lookup: TaskFeedbackLookupContext,
  feedbackRange?: DateRangeFilterValue
) {
  return summaries.filter((summary) => filterTaskFeedbackSummary(summary, filters, lookup, feedbackRange));
}

export function getTaskFeedbackMetrics(summaries: TaskFeedbackSummary[]): TaskFeedbackMetrics {
  return {
    clientFeedbackCount: summaries.reduce((total, summary) => total + summary.clientFeedbackCount, 0),
    feedbackFiles: summaries.reduce(
      (total, summary) => total + summary.clientFeedbackRows.reduce((fileTotal, record) => fileTotal + record.files.length, 0),
      0
    ),
    reworkCount: summaries.reduce((total, summary) => total + summary.internalRejectionCount, 0),
    tasks: summaries.length
  };
}

export function getTaskFeedbackOperationRecords(summary: TaskFeedbackSummary): OperationRecord[] {
  return [
    ...summary.task.operationRecords,
    ...summary.clientFeedbackRows.flatMap((record) =>
      record.operationRecords.map<OperationRecord>((operationRecord) => ({
        ...operationRecord,
        object: summary.task.name
      }))
    )
  ].sort((left, right) => right.time.localeCompare(left.time));
}

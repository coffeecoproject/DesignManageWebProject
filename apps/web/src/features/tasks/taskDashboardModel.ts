import type { BrandRecord, CustomerRecord, StoreRecord } from '../customers/customerData';
import type { TaskConfigRow } from '../system/TaskConfigState';
import type { ClientFeedbackRecord, StoreTaskRecord } from './TaskManagementState';
import { taskManagementNow, taskManagementToday } from './TaskManagementState';
import { getTaskStoreContext, getTaskTypeName, isTaskClosed, isTaskOverdue } from './taskDisplayModel';

export type TaskDashboardDistributionItem = {
  key: string;
  label: string;
  percent: number;
  value: number;
};

export type TaskDashboardTrendPoint = {
  completed: number;
  created: number;
  date: string;
  label: string;
};

export type TaskDashboardPeriodMode = 'month' | 'quarter' | 'year' | 'custom';

export type TaskDashboardTrendGranularity = 'day' | 'month';

export type TaskDashboardPeriodRange = {
  endDate: string;
  label: string;
  mode: TaskDashboardPeriodMode;
  startDate: string;
  trendGranularity: TaskDashboardTrendGranularity;
};

export type TaskDashboardRiskLevel = 'high' | 'medium' | 'low';

export type TaskDashboardRiskRow = {
  acceptorName: string;
  contextLabel: string;
  executorName: string;
  id: string;
  plannedDeliveryAt: string;
  riskLevel: TaskDashboardRiskLevel;
  riskText: string;
  taskCode: string;
  taskName: string;
};

export type TaskDashboardLoadRow = {
  activeCount: number;
  executorName: string;
  id: string;
  latestTaskName: string;
  overdueCount: number;
  rejectionCount: number;
};

export type TaskDashboardData = {
  customerDistribution: TaskDashboardDistributionItem[];
  loadRows: TaskDashboardLoadRow[];
  metrics: {
    active: number;
    clientFeedback: number;
    completedInPeriod: number;
    overdue: number;
    pendingAcceptance: number;
    pendingSubmit: number;
    reworkCount: number;
    total: number;
  };
  period: TaskDashboardPeriodRange;
  riskRows: TaskDashboardRiskRow[];
  statusDistribution: TaskDashboardDistributionItem[];
  taskTypeDistribution: TaskDashboardDistributionItem[];
  trend: TaskDashboardTrendPoint[];
};

type TaskDashboardSource = {
  brandRows: BrandRecord[];
  clientFeedbackRows: ClientFeedbackRecord[];
  customerRows: CustomerRecord[];
  now?: string;
  periodRange?: TaskDashboardPeriodRange;
  storeRows: StoreRecord[];
  storeTaskRows: StoreTaskRecord[];
  taskConfigRows: Pick<TaskConfigRow, 'id' | 'name'>[];
  today?: string;
};

function getDateOnly(dateTime: string | undefined) {
  return dateTime?.slice(0, 10) ?? '';
}

function getTaskCompletedAt(task: StoreTaskRecord) {
  return task.acceptedAt ?? task.updatedAt;
}

function parseDateOnly(date: string) {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

function getLastDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0);
}

function getInclusiveDayCount(startDate: string, endDate: string) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const dayMs = 24 * 60 * 60 * 1000;

  return Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1);
}

function getTrendGranularity(startDate: string, endDate: string): TaskDashboardTrendGranularity {
  return getInclusiveDayCount(startDate, endDate) <= 45 ? 'day' : 'month';
}

function normalizeRangeOrder(startDate: string, endDate: string) {
  return startDate <= endDate ? { endDate, startDate } : { endDate: startDate, startDate: endDate };
}

export function buildTaskDashboardPeriodRange(
  mode: TaskDashboardPeriodMode,
  today = taskManagementToday,
  customRange?: { endDate: string; startDate: string }
): TaskDashboardPeriodRange {
  if (mode === 'custom' && customRange?.startDate && customRange.endDate) {
    const normalizedRange = normalizeRangeOrder(customRange.startDate, customRange.endDate);

    return {
      ...normalizedRange,
      label: `${normalizedRange.startDate} 至 ${normalizedRange.endDate}`,
      mode,
      trendGranularity: getTrendGranularity(normalizedRange.startDate, normalizedRange.endDate)
    };
  }

  const currentDate = parseDateOnly(today);
  const year = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth();
  let startDate: string;
  let endDate: string;

  if (mode === 'quarter') {
    const quarterStartMonth = Math.floor(monthIndex / 3) * 3;
    startDate = formatDateOnly(new Date(year, quarterStartMonth, 1));
    endDate = formatDateOnly(getLastDayOfMonth(year, quarterStartMonth + 2));
  } else if (mode === 'year') {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  } else {
    startDate = formatDateOnly(new Date(year, monthIndex, 1));
    endDate = formatDateOnly(getLastDayOfMonth(year, monthIndex));
  }

  return {
    endDate,
    label: `${startDate} 至 ${endDate}`,
    mode,
    startDate,
    trendGranularity: getTrendGranularity(startDate, endDate)
  };
}

function getTrendPoints(periodRange: TaskDashboardPeriodRange) {
  if (periodRange.trendGranularity === 'month') {
    const startDate = parseDateOnly(periodRange.startDate);
    const endDate = parseDateOnly(periodRange.endDate);
    const endMonthKey = getMonthKey(endDate);
    const points: Array<{ date: string; label: string }> = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

    while (getMonthKey(cursor) <= endMonthKey) {
      const month = String(cursor.getMonth() + 1).padStart(2, '0');

      points.push({
        date: getMonthKey(cursor),
        label: `${month}月`
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return points;
  }

  const startDate = parseDateOnly(periodRange.startDate);
  const endDate = parseDateOnly(periodRange.endDate);
  const points: Array<{ date: string; label: string }> = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const normalizedDate = formatDateOnly(cursor);
    const [, month, day] = normalizedDate.split('-');

    points.push({
      date: normalizedDate,
      label: `${month}-${day}`
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return points;
}

function isDateInRange(dateTime: string | undefined, periodRange: TaskDashboardPeriodRange) {
  const date = getDateOnly(dateTime);

  return Boolean(date) && date >= periodRange.startDate && date <= periodRange.endDate;
}

function getTrendBucketKey(dateTime: string | undefined, granularity: TaskDashboardTrendGranularity) {
  const date = getDateOnly(dateTime);

  return granularity === 'month' ? date.slice(0, 7) : date;
}

function isTaskInPeriod(task: StoreTaskRecord, periodRange: TaskDashboardPeriodRange, feedbackTaskIds: Set<string>) {
  const completedAt = task.status === '已完成' ? getTaskCompletedAt(task) : undefined;

  return (
    isDateInRange(task.createdAt, periodRange) ||
    isDateInRange(task.plannedDeliveryAt, periodRange) ||
    isDateInRange(completedAt, periodRange) ||
    feedbackTaskIds.has(task.id)
  );
}

function buildDistribution(entries: [string, number][]) {
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return entries
    .map<TaskDashboardDistributionItem>(([label, value]) => ({
      key: label,
      label,
      percent: total > 0 ? Math.round((value / total) * 100) : 0,
      value
    }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

function countByLabel(records: StoreTaskRecord[], getLabel: (record: StoreTaskRecord) => string) {
  const counts = new Map<string, number>();

  for (const record of records) {
    const label = getLabel(record);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()];
}

function buildFeedbackCountByTask(clientFeedbackRows: ClientFeedbackRecord[]) {
  const counts = new Map<string, number>();

  for (const record of clientFeedbackRows) {
    counts.set(record.taskId, (counts.get(record.taskId) ?? 0) + 1);
  }

  return counts;
}

function resolveCustomerName(customerRows: CustomerRecord[], customerId: string) {
  return customerRows.find((customer) => customer.id === customerId)?.name ?? '未配置客户';
}

function resolveBrandName(brandRows: BrandRecord[], brandId: string) {
  return brandRows.find((brand) => brand.id === brandId)?.name ?? '未配置品牌';
}

function resolveStoreName(storeRows: StoreRecord[], storeId: string) {
  return getTaskStoreContext(storeRows, storeId).storeCityLabel;
}

function getTaskRiskLabels(task: StoreTaskRecord, feedbackCount: number, now: string) {
  const labels: string[] = [];

  if (isTaskOverdue(task, now)) {
    labels.push('已逾期');
  }

  if (task.status === '验收驳回') {
    labels.push('验收驳回');
  }

  if (task.reworkCount >= 2) {
    labels.push('多次驳回');
  } else if (task.reworkCount > 0) {
    labels.push('有驳回');
  }

  if (feedbackCount >= 2) {
    labels.push('反馈集中');
  } else if (feedbackCount > 0) {
    labels.push('甲方反馈');
  }

  return labels;
}

function getRiskLevel(labels: string[]): TaskDashboardRiskLevel {
  if (labels.some((label) => label === '已逾期' || label === '验收驳回' || label === '多次驳回')) {
    return 'high';
  }

  if (labels.length > 0) {
    return 'medium';
  }

  return 'low';
}

function buildRiskRows({
  brandRows,
  clientFeedbackRows,
  now,
  storeRows,
  storeTaskRows
}: Pick<TaskDashboardSource, 'brandRows' | 'clientFeedbackRows' | 'storeRows' | 'storeTaskRows'> & { now: string }) {
  const feedbackCountByTask = buildFeedbackCountByTask(clientFeedbackRows);

  return storeTaskRows
    .map<TaskDashboardRiskRow | undefined>((task) => {
      const feedbackCount = feedbackCountByTask.get(task.id) ?? 0;
      const labels = getTaskRiskLabels(task, feedbackCount, now);

      if (labels.length === 0) {
        return undefined;
      }

      return {
        acceptorName: task.acceptorName,
        contextLabel: `${resolveBrandName(brandRows, task.brandId)} / ${resolveStoreName(storeRows, task.storeId)}`,
        executorName: task.executorName ?? '未分配',
        id: task.id,
        plannedDeliveryAt: task.plannedDeliveryAt,
        riskLevel: getRiskLevel(labels),
        riskText: labels.join(' / '),
        taskCode: task.code,
        taskName: task.name
      };
    })
    .filter((row): row is TaskDashboardRiskRow => Boolean(row))
    .sort((left, right) => {
      const levelScore: Record<TaskDashboardRiskLevel, number> = { high: 3, medium: 2, low: 1 };

      return (
        levelScore[right.riskLevel] - levelScore[left.riskLevel] ||
        left.plannedDeliveryAt.localeCompare(right.plannedDeliveryAt) ||
        left.taskName.localeCompare(right.taskName)
      );
    });
}

function buildLoadRows(storeTaskRows: StoreTaskRecord[], now: string) {
  const rowsByExecutor = new Map<string, TaskDashboardLoadRow & { latestUpdatedAt: string }>();

  for (const task of storeTaskRows) {
    if (isTaskClosed(task)) {
      continue;
    }

    const executorName = task.executorName ?? '未分配';
    const currentRow =
      rowsByExecutor.get(executorName) ??
      ({
        activeCount: 0,
        executorName,
        id: executorName,
        latestUpdatedAt: '',
        latestTaskName: task.name,
        overdueCount: 0,
        rejectionCount: 0
      } satisfies TaskDashboardLoadRow & { latestUpdatedAt: string });

    rowsByExecutor.set(executorName, {
      ...currentRow,
      activeCount: currentRow.activeCount + 1,
      latestTaskName: task.updatedAt >= currentRow.latestUpdatedAt ? task.name : currentRow.latestTaskName,
      latestUpdatedAt: task.updatedAt >= currentRow.latestUpdatedAt ? task.updatedAt : currentRow.latestUpdatedAt,
      overdueCount: currentRow.overdueCount + (isTaskOverdue(task, now) ? 1 : 0),
      rejectionCount: currentRow.rejectionCount + task.reworkCount
    });
  }

  return [...rowsByExecutor.values()]
    .map((row) => ({
      activeCount: row.activeCount,
      executorName: row.executorName,
      id: row.id,
      latestTaskName: row.latestTaskName,
      overdueCount: row.overdueCount,
      rejectionCount: row.rejectionCount
    }))
    .sort(
      (left, right) =>
        right.activeCount - left.activeCount ||
        right.overdueCount - left.overdueCount ||
        right.rejectionCount - left.rejectionCount ||
        left.executorName.localeCompare(right.executorName)
    );
}

export function buildTaskDashboardData({
  brandRows,
  clientFeedbackRows,
  customerRows,
  now = taskManagementNow,
  periodRange,
  storeRows,
  storeTaskRows,
  taskConfigRows,
  today = taskManagementToday
}: TaskDashboardSource): TaskDashboardData {
  const activePeriodRange = periodRange ?? buildTaskDashboardPeriodRange('month', today);
  const periodFeedbackRows = clientFeedbackRows.filter((feedback) => isDateInRange(feedback.feedbackAt, activePeriodRange));
  const periodFeedbackTaskIds = new Set(periodFeedbackRows.map((feedback) => feedback.taskId));
  const periodTaskRows = storeTaskRows.filter((task) => isTaskInPeriod(task, activePeriodRange, periodFeedbackTaskIds));
  const activeTasks = periodTaskRows.filter((task) => !isTaskClosed(task));
  const completedInPeriodTasks = storeTaskRows.filter(
    (task) => task.status === '已完成' && isDateInRange(getTaskCompletedAt(task), activePeriodRange)
  );
  const trend = getTrendPoints(activePeriodRange).map<TaskDashboardTrendPoint>((point) => ({
    ...point,
    completed: storeTaskRows.filter(
      (task) =>
        task.status === '已完成' && getTrendBucketKey(getTaskCompletedAt(task), activePeriodRange.trendGranularity) === point.date
    ).length,
    created: storeTaskRows.filter((task) => getTrendBucketKey(task.createdAt, activePeriodRange.trendGranularity) === point.date).length
  }));

  return {
    customerDistribution: buildDistribution(countByLabel(periodTaskRows, (task) => resolveCustomerName(customerRows, task.customerId))),
    loadRows: buildLoadRows(periodTaskRows, now),
    metrics: {
      active: activeTasks.length,
      clientFeedback: periodFeedbackRows.length,
      completedInPeriod: completedInPeriodTasks.length,
      overdue: activeTasks.filter((task) => isTaskOverdue(task, now)).length,
      pendingAcceptance: activeTasks.filter((task) => task.status === '待验收').length,
      pendingSubmit: activeTasks.filter((task) => task.status === '进行中').length,
      reworkCount: periodTaskRows.reduce((sum, task) => sum + task.reworkCount, 0),
      total: periodTaskRows.length
    },
    period: activePeriodRange,
    riskRows: buildRiskRows({ brandRows, clientFeedbackRows: periodFeedbackRows, now, storeRows, storeTaskRows: periodTaskRows }),
    statusDistribution: buildDistribution(countByLabel(periodTaskRows, (task) => task.status)),
    taskTypeDistribution: buildDistribution(countByLabel(periodTaskRows, (task) => getTaskTypeName(task.taskConfigId, taskConfigRows))),
    trend
  };
}

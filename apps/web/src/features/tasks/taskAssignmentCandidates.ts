import type { AnnualExceptionConfigRow, WorkCalendarRow } from '../system/WorkCalendarState';
import { isWorkCalendarActiveOnDate, isWorkCalendarDateWorkday } from '../system/workCalendarRules';
import type { PeopleAttendanceRecord } from '../people/PeopleOrganizationState';
import type { PeopleMember } from '../people/peopleTypes';
import { getMemberWorkCalendar, getPeopleRelationshipRangeBlockers } from '../people/peopleDomain';
import { getLatestPublishedPerformanceSummary } from '../performance/performanceResultConsumerModel';
import type { PerformanceMonthlyCategoryRecord } from '../performance/performanceTypes';
import { formatTaskDuration, normalizeTaskHourText, type StoreTaskRecord } from './TaskManagementState';
import { taskWorkdayEndHour, taskWorkdayStartHour } from './taskScheduling';

export type TaskAssignmentWindow = {
  startAt: string;
  endAt: string;
};

export type TaskAssignmentCandidateKind = '推荐' | '可选' | '不可选';

export type TaskAssignmentCandidate = {
  blockers: string[];
  calendarName: string;
  currentTaskCount: number;
  kind: TaskAssignmentCandidateKind;
  member: PeopleMember;
  performancePeriod?: string;
  performanceScore: number | null;
  reasons: string[];
  selectable: boolean;
  sortScore: number;
};

type BuildExecutorCandidatesInput = {
  attendanceRecords: PeopleAttendanceRecord[];
  peopleRows: PeopleMember[];
  publishedPerformanceRecords: PerformanceMonthlyCategoryRecord[];
  storeTaskRows: StoreTaskRecord[];
  taskConfigId: string;
  plannedDurationHours?: number | null;
  window?: TaskAssignmentWindow;
  annualExceptionRows: AnnualExceptionConfigRow[];
  workCalendarRows: WorkCalendarRow[];
};

type BuildAcceptorCandidatesInput = {
  attendanceRecords: PeopleAttendanceRecord[];
  executorId: string;
  peopleRows: PeopleMember[];
  publishedPerformanceRecords: PerformanceMonthlyCategoryRecord[];
  plannedDurationHours?: number | null;
  storeTaskRows: StoreTaskRecord[];
  window?: TaskAssignmentWindow;
  annualExceptionRows: AnnualExceptionConfigRow[];
  workCalendarRows: WorkCalendarRow[];
};

const closedTaskStatuses = new Set<StoreTaskRecord['status']>(['已完成', '已中止']);
const highActiveTaskCount = 2;
const lowPerformanceScore = 80;

function parseDateTime(value: string) {
  const normalizedValue = normalizeTaskHourText(value, 10);
  const match = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):00$/);

  if (!match) {
    return undefined;
  }

  const [, year, month, day, hour] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), 0, 0, 0);
}

function getWindowDateRange(window: TaskAssignmentWindow | undefined) {
  if (!window) {
    return [];
  }

  const start = parseDateTime(window.startAt);
  const end = parseDateTime(window.endAt);

  if (!start || !end || start >= end) {
    return [];
  }

  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);
  const dates: Date[] = [];

  while (cursor <= endDay) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function overlapsDateRange(leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

function coversDateRange(coverStart: Date, coverEnd: Date, targetStart: Date, targetEnd: Date) {
  return coverStart <= targetStart && coverEnd >= targetEnd;
}

function getWindowWorkSegmentForDate(date: Date, window: TaskAssignmentWindow) {
  const windowStart = parseDateTime(window.startAt);
  const windowEnd = parseDateTime(window.endAt);

  if (!windowStart || !windowEnd || windowStart >= windowEnd) {
    return undefined;
  }

  const workdayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), taskWorkdayStartHour, 0, 0, 0);
  const workdayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), taskWorkdayEndHour, 0, 0, 0);
  const segmentStart = windowStart > workdayStart ? windowStart : workdayStart;
  const segmentEnd = windowEnd < workdayEnd ? windowEnd : workdayEnd;

  if (segmentStart >= segmentEnd) {
    return undefined;
  }

  return {
    end: segmentEnd,
    start: segmentStart
  };
}

function hasMakeupWorkdayCoverage(
  memberId: string,
  date: Date,
  window: TaskAssignmentWindow,
  attendanceRecords: PeopleAttendanceRecord[]
) {
  const windowSegment = getWindowWorkSegmentForDate(date, window);

  if (!windowSegment) {
    return false;
  }

  return attendanceRecords.some((record) => {
    if (record.memberId !== memberId || record.status === '已取消' || record.effect !== '可用') {
      return false;
    }

    const recordStart = parseDateTime(record.startAt);
    const recordEnd = parseDateTime(record.endAt);

    return Boolean(recordStart && recordEnd && coversDateRange(recordStart, recordEnd, windowSegment.start, windowSegment.end));
  });
}

function getUsableWorkSegments(
  member: PeopleMember,
  window: TaskAssignmentWindow | undefined,
  attendanceRecords: PeopleAttendanceRecord[],
  workCalendarRows: WorkCalendarRow[],
  annualExceptionRows: AnnualExceptionConfigRow[]
) {
  if (!window) {
    return [];
  }

  return getWindowDateRange(window).flatMap((date) => {
    const calendar = getMemberWorkCalendar(member, workCalendarRows, formatTaskDate(date));
    if (!calendar || !isWorkCalendarActiveOnDate(calendar, date)) {
      return [];
    }
    const isWorkday = isWorkCalendarDateWorkday(calendar, date, annualExceptionRows);
    const hasMakeupWorkday = hasMakeupWorkdayCoverage(member.id, date, window, attendanceRecords);

    if (!isWorkday && !hasMakeupWorkday) {
      return [];
    }

    const segment = getWindowWorkSegmentForDate(date, window);

    return segment ? [segment] : [];
  });
}

function formatTaskDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getAttendanceConflicts(
  member: PeopleMember,
  window: TaskAssignmentWindow | undefined,
  attendanceRecords: PeopleAttendanceRecord[],
  workCalendarRows: WorkCalendarRow[],
  annualExceptionRows: AnnualExceptionConfigRow[]
) {
  if (!window) {
    return [];
  }

  const usableWorkSegments = getUsableWorkSegments(member, window, attendanceRecords, workCalendarRows, annualExceptionRows);

  if (usableWorkSegments.length === 0) {
    return [];
  }

  return attendanceRecords.filter(
    (record) => {
      if (record.memberId !== member.id || record.status === '已取消' || record.effect !== '不可用') {
        return false;
      }

      const recordStart = parseDateTime(record.startAt);
      const recordEnd = parseDateTime(record.endAt);

      if (!recordStart || !recordEnd) {
        return false;
      }

      return usableWorkSegments.some((segment) => overlapsDateRange(recordStart, recordEnd, segment.start, segment.end));
    }
  );
}

function buildCalendarWarnings(
  member: PeopleMember,
  window: TaskAssignmentWindow | undefined,
  attendanceRecords: PeopleAttendanceRecord[],
  workCalendarRows: WorkCalendarRow[],
  annualExceptionRows: AnnualExceptionConfigRow[]
) {
  const calendar = getMemberWorkCalendar(member, workCalendarRows, window?.startAt.slice(0, 10));

  if (!window) {
    return {
      blockers: [] as string[],
      calendarName: calendar?.name ?? '未配置工作日历',
      warnings: [] as string[]
    };
  }

  const dates = getWindowDateRange(window);

  if (dates.length === 0) {
    return {
      blockers: ['计划时间无效'],
      calendarName: calendar?.name ?? '未配置工作日历',
      warnings: [] as string[]
    };
  }

  const windowStartDate = new Date(`${window.startAt.slice(0, 10)}T00:00:00`);
  if (!calendar || !isWorkCalendarActiveOnDate(calendar, windowStartDate)) {
    return {
      blockers: [] as string[],
      calendarName: calendar?.name ?? '未配置工作日历',
      warnings: ['未配置可用工作日历']
    };
  }

  const usableWorkSegments = getUsableWorkSegments(member, window, attendanceRecords, workCalendarRows, annualExceptionRows);
  const restDayCount = dates.length - usableWorkSegments.length;

  if (usableWorkSegments.length === 0) {
    return {
      blockers: [] as string[],
      calendarName: calendar.name,
      warnings: ['任务周期内无日历可用工时，请自行安排']
    };
  }

  return {
    blockers: [] as string[],
    calendarName: calendar.name,
    warnings: restDayCount > 0 ? [`周期含 ${restDayCount} 天休息`] : []
  };
}

function getActiveTaskCount(memberId: string, storeTaskRows: StoreTaskRecord[]) {
  return storeTaskRows.filter((task) => task.executorId === memberId && !closedTaskStatuses.has(task.status)).length;
}

function isActiveMember(member: PeopleMember) {
  if (member.personnelType === '全职') {
    return member.status === '试用期' || member.status === '在职';
  }

  return member.status === '合作中';
}

function getTaskAccessBlocker(member: PeopleMember) {
  if (member.taskAccessStatus === '可参与任务') {
    return undefined;
  }

  return member.taskAccessStatus === '暂停参与' ? '暂停接单' : '任务参与已关闭';
}

function buildBaseCandidate({
  attendanceRecords,
  annualExceptionRows,
  member,
  plannedDurationHours,
  publishedPerformanceRecords,
  storeTaskRows,
  window,
  workCalendarRows
}: {
  attendanceRecords: PeopleAttendanceRecord[];
  annualExceptionRows: AnnualExceptionConfigRow[];
  member: PeopleMember;
  publishedPerformanceRecords: PerformanceMonthlyCategoryRecord[];
  storeTaskRows: StoreTaskRecord[];
  window?: TaskAssignmentWindow;
  plannedDurationHours?: number | null;
  workCalendarRows: WorkCalendarRow[];
}) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const shouldCheckTimeAvailability = member.personnelType === '全职';
  const attendanceConflicts = shouldCheckTimeAvailability
    ? getAttendanceConflicts(member, window, attendanceRecords, workCalendarRows, annualExceptionRows)
    : [];
  const calendarResult = shouldCheckTimeAvailability
    ? buildCalendarWarnings(member, window, attendanceRecords, workCalendarRows, annualExceptionRows)
    : {
        blockers: [] as string[],
        calendarName: '',
        warnings: [] as string[]
      };
  const currentTaskCount = getActiveTaskCount(member.id, storeTaskRows);
  const performanceSummary = getLatestPublishedPerformanceSummary(
    publishedPerformanceRecords,
    member.id
  );
  const performanceScore = performanceSummary.score;

  if (!isActiveMember(member)) {
    blockers.push('人员状态不可用');
  }

  if (window) {
    blockers.push(...getPeopleRelationshipRangeBlockers(member, window.startAt, window.endAt));
  }

  const taskAccessBlocker = getTaskAccessBlocker(member);

  if (taskAccessBlocker) {
    blockers.push(taskAccessBlocker);
  }

  if (attendanceConflicts.length > 0) {
    warnings.push(attendanceConflicts.map((record) => `${record.type}覆盖工作时段`).join('；'));
  }

  blockers.push(...calendarResult.blockers);

  if (currentTaskCount >= highActiveTaskCount) {
    warnings.push(`任务较多：进行中 ${currentTaskCount} 个`);
  }

  if (performanceScore !== null && performanceScore < lowPerformanceScore) {
    warnings.push(`绩效偏低：${performanceScore} 分`);
  }

  warnings.push(...calendarResult.warnings);

  if (shouldCheckTimeAvailability && window && plannedDurationHours && plannedDurationHours > 0) {
    const availableHours = getUsableWorkSegments(
      member,
      window,
      attendanceRecords,
      workCalendarRows,
      annualExceptionRows
    ).reduce((total, segment) => total + (segment.end.getTime() - segment.start.getTime()) / (60 * 60 * 1000), 0);

    if (availableHours < plannedDurationHours) {
      warnings.push(`日历可用约 ${availableHours} 小时，低于任务计划 ${plannedDurationHours} 小时`);
    }
  }

  return {
    blockers,
    calendarName: calendarResult.calendarName,
    currentTaskCount,
    performancePeriod: performanceSummary.period,
    performanceScore,
    warnings
  };
}

function toCandidate(member: PeopleMember, base: ReturnType<typeof buildBaseCandidate>, extraBlockers: string[] = []): TaskAssignmentCandidate {
  const blockers = [...base.blockers, ...extraBlockers];
  const selectable = blockers.length === 0;
  const kind: TaskAssignmentCandidateKind = !selectable ? '不可选' : base.warnings.length > 0 ? '可选' : '推荐';
  const kindScore = kind === '推荐' ? 30 : kind === '可选' ? 15 : 0;
  const taskLoadPenalty = Math.min(base.currentTaskCount * 3, 18);
  const performanceBonus = base.performanceScore === null
    ? 0
    : Math.max(0, base.performanceScore - 70) / 10;

  return {
    blockers,
    calendarName: base.calendarName,
    currentTaskCount: base.currentTaskCount,
    kind,
    member,
    performancePeriod: base.performancePeriod,
    performanceScore: base.performanceScore,
    reasons: selectable ? base.warnings : blockers,
    selectable,
    sortScore: kindScore + performanceBonus - taskLoadPenalty
  };
}

function sortCandidates(candidates: TaskAssignmentCandidate[]) {
  return [...candidates].sort(
    (left, right) =>
      right.sortScore - left.sortScore ||
      left.currentTaskCount - right.currentTaskCount ||
      (right.performanceScore ?? Number.NEGATIVE_INFINITY)
        - (left.performanceScore ?? Number.NEGATIVE_INFINITY) ||
      left.member.name.localeCompare(right.member.name)
  );
}

export function buildTaskExecutorCandidates({
  attendanceRecords,
  annualExceptionRows,
  peopleRows,
  plannedDurationHours,
  publishedPerformanceRecords,
  storeTaskRows,
  taskConfigId,
  window,
  workCalendarRows
}: BuildExecutorCandidatesInput) {
  return sortCandidates(
    peopleRows.map((member) => {
      const base = buildBaseCandidate({
        attendanceRecords,
        annualExceptionRows,
        member,
        publishedPerformanceRecords,
        plannedDurationHours,
        storeTaskRows,
        window,
        workCalendarRows
      });
      const extraBlockers = taskConfigId && !member.taskCapabilityIds.includes(taskConfigId) ? ['未配置该任务能力'] : [];

      return toCandidate(member, base, extraBlockers);
    })
  );
}

export function buildTaskAcceptorCandidates({
  attendanceRecords,
  annualExceptionRows,
  executorId,
  peopleRows,
  plannedDurationHours,
  publishedPerformanceRecords,
  storeTaskRows,
  window,
  workCalendarRows
}: BuildAcceptorCandidatesInput) {
  return sortCandidates(
    peopleRows.map((member) => {
      const base = buildBaseCandidate({
        attendanceRecords,
        annualExceptionRows,
        member,
        publishedPerformanceRecords,
        plannedDurationHours,
        storeTaskRows,
        window,
        workCalendarRows
      });
      const extraBlockers: string[] = [];

      if (member.personnelType !== '全职') {
        extraBlockers.push('验收人需为全职');
      }

      if (executorId && member.id === executorId) {
        extraBlockers.push('不能与执行人相同');
      }

      return toCandidate(member, base, extraBlockers);
    })
  );
}

export function getFirstSelectableCandidateId(candidates: TaskAssignmentCandidate[]) {
  return candidates.find((candidate) => candidate.selectable)?.member.id ?? '';
}

export function formatCandidateWindow(window: TaskAssignmentWindow | undefined) {
  if (!window) {
    return '填写计划时效后生成';
  }

  return `${window.startAt} - ${window.endAt} / ${formatTaskDuration(
    Math.max(0, Math.round(((parseDateTime(window.endAt)?.getTime() ?? 0) - (parseDateTime(window.startAt)?.getTime() ?? 0)) / (60 * 60 * 1000)))
  )}`;
}

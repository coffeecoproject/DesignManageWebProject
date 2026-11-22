import type {
  AnnualExceptionConfigRow,
  AnnualExceptionItem,
  WorkCalendarRow,
  WorkCalendarRuleVersion,
  WorkCalendarWeekday
} from './WorkCalendarState';
import { resolveAnnualExceptionRevision } from './annualExceptionModel';

const weekdayNames: WorkCalendarWeekday[] = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const dayMilliseconds = 24 * 60 * 60 * 1000;

export type AnnualExceptionSummary = {
  configCount: number;
  enabledYearCount: number;
  restDayCount: number;
  specialWorkdayCount: number;
};

export type EffectiveTimelinePeriod = {
  effectiveFrom: string;
  effectiveTo?: string;
};

export type EffectiveTimelineValidation = {
  message?: string;
  success: boolean;
};

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDateText(value: string) {
  if (!calendarDatePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateEffectiveTimeline(periods: EffectiveTimelinePeriod[]): EffectiveTimelineValidation {
  const sortedPeriods = [...periods].sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));

  for (let index = 0; index < sortedPeriods.length; index += 1) {
    const period = sortedPeriods[index];
    const previousPeriod = sortedPeriods[index - 1];

    if (!isValidCalendarDateText(period.effectiveFrom) || (period.effectiveTo && !isValidCalendarDateText(period.effectiveTo))) {
      return { message: '生效时间轴包含无效日期', success: false };
    }
    if (period.effectiveTo && period.effectiveFrom > period.effectiveTo) {
      return { message: '生效时间轴的结束日期不能早于开始日期', success: false };
    }
    if (previousPeriod && (!previousPeriod.effectiveTo || previousPeriod.effectiveTo >= period.effectiveFrom)) {
      return { message: '生效时间轴存在重叠区间', success: false };
    }
  }

  return { success: true };
}

export function getLatestWorkCalendarVersion(calendar: WorkCalendarRow | undefined) {
  return calendar?.versions?.length
    ? [...calendar.versions].sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]
    : undefined;
}

export function formatCalendarDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getAnnualExceptionSummary(rows: AnnualExceptionConfigRow[], date = new Date()): AnnualExceptionSummary {
  const enabledRows = rows.filter((row) => row.status === '已启用');
  const revisions = enabledRows
    .map((row) => resolveAnnualExceptionRevision(row, date))
    .filter((revision) => revision !== undefined);

  return {
    configCount: rows.length,
    enabledYearCount: new Set(enabledRows.map((row) => row.year)).size,
    restDayCount: revisions.reduce((total, revision) => total + revision.items.filter((item) => item.type === '休息日').length, 0),
    specialWorkdayCount: revisions.reduce((total, revision) => total + revision.items.filter((item) => item.type === '特殊工作日').length, 0)
  };
}

export function getAnnualExceptionForDate(rows: AnnualExceptionConfigRow[], date: Date): AnnualExceptionItem | undefined {
  const dateKey = formatCalendarDateKey(date);
  const year = date.getFullYear();

  const revisions = rows
    .filter((row) => row.year === year)
    .map((row) => resolveAnnualExceptionRevision(row, date))
    .filter((revision) => revision !== undefined);

  if (revisions.length !== 1) {
    return undefined;
  }

  return revisions[0].items.find((item) => item.date === dateKey);
}

export function resolveWorkCalendarRule(
  calendar: WorkCalendarRow | undefined,
  date: Date
): WorkCalendarRuleVersion | undefined {
  if (!calendar) {
    return undefined;
  }

  const dateKey = formatCalendarDateKey(date);
  if (!calendar.versions?.length) {
    return {
      alternateWorkdays: calendar.alternateWorkdays,
      anchorDate: calendar.anchorDate,
      createdAt: calendar.updatedAt,
      effectiveFrom: calendar.effectiveFrom ?? '0001-01-01',
      fixedWorkdays: calendar.fixedWorkdays,
      id: calendar.currentVersionId ?? `${calendar.id}-legacy`,
      note: calendar.note,
      startMode: calendar.startMode,
      type: calendar.type,
      version: 1
    };
  }

  return [...calendar.versions]
    .filter((version) => version.effectiveFrom <= dateKey && (!version.effectiveTo || version.effectiveTo >= dateKey))
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0];
}

export function resolveWorkCalendarStatus(calendar: WorkCalendarRow | undefined, date: Date) {
  if (!calendar) {
    return undefined;
  }

  if (!calendar.statusPeriods?.length) {
    return calendar.status;
  }

  const dateKey = formatCalendarDateKey(date);
  return [...calendar.statusPeriods]
    .filter((period) => period.effectiveFrom <= dateKey && (!period.effectiveTo || period.effectiveTo >= dateKey))
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]?.status;
}

export function isWorkCalendarActiveOnDate(calendar: WorkCalendarRow | undefined, date: Date) {
  return resolveWorkCalendarStatus(calendar, date) === '启用';
}

export function resolveDefaultWorkCalendar(workCalendarRows: WorkCalendarRow[], date: Date) {
  const dateKey = formatCalendarDateKey(date);
  const hasEffectiveDefaultRecords = workCalendarRows.some((calendar) => calendar.defaultPeriods?.length);

  if (!hasEffectiveDefaultRecords) {
    const legacyCandidates = workCalendarRows.filter((calendar) => calendar.isDefault);
    return legacyCandidates.length === 1 ? legacyCandidates[0] : undefined;
  }

  const candidates = workCalendarRows
    .flatMap((calendar) => (calendar.defaultPeriods ?? []).map((period) => ({ calendar, period })))
    .filter(({ period }) => period.effectiveFrom <= dateKey && (!period.effectiveTo || period.effectiveTo >= dateKey))
    .sort((left, right) => right.period.effectiveFrom.localeCompare(left.period.effectiveFrom));

  return candidates.length === 1 ? candidates[0].calendar : undefined;
}

export function getWorkCalendarSourceSignature(
  calendar: WorkCalendarRow | undefined,
  annualExceptionRows: AnnualExceptionConfigRow[],
  date: Date
) {
  const rule = resolveWorkCalendarRule(calendar, date);
  const annualConfig = annualExceptionRows.find((row) => row.year === date.getFullYear());
  const annualRevision = resolveAnnualExceptionRevision(annualConfig, date);

  return `${calendar?.id ?? 'none'}:${rule?.id ?? 'none'}:${annualRevision?.id ?? 'none'}`;
}

function getWeekday(date: Date) {
  return weekdayNames[date.getDay()];
}

function getWeeksBetween(anchorDateText: string | undefined, date: Date) {
  if (!anchorDateText) {
    return 0;
  }

  const anchor = new Date(`${anchorDateText}T00:00:00`);

  if (Number.isNaN(anchor.getTime())) {
    return 0;
  }

  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  return Math.floor((current.getTime() - anchor.getTime()) / (7 * dayMilliseconds));
}

function isBaseCalendarWorkday(calendar: WorkCalendarRuleVersion, date: Date) {
  const weekday = getWeekday(date);

  if (calendar.type === '大小周') {
    const weekOffset = getWeeksBetween(calendar.anchorDate, date);
    const anchorIsSingleWeekendWeek = calendar.startMode !== '双休周开始';
    const useAlternateWorkdays = Math.abs(weekOffset) % 2 === 0 ? anchorIsSingleWeekendWeek : !anchorIsSingleWeekendWeek;
    const workdays = useAlternateWorkdays ? [...calendar.fixedWorkdays, ...calendar.alternateWorkdays] : calendar.fixedWorkdays;

    return workdays.includes(weekday);
  }

  return calendar.fixedWorkdays.includes(weekday);
}

export function isWorkCalendarDateWorkday(
  calendar: WorkCalendarRow | undefined,
  date: Date,
  annualExceptionRows: AnnualExceptionConfigRow[] = []
) {
  if (!calendar || !isWorkCalendarActiveOnDate(calendar, date)) {
    return false;
  }

  const rule = resolveWorkCalendarRule(calendar, date);

  if (!rule) {
    return false;
  }

  const annualException = getAnnualExceptionForDate(annualExceptionRows, date);

  if (annualException?.type === '特殊工作日') {
    return true;
  }

  if (annualException?.type === '休息日') {
    return false;
  }

  return isBaseCalendarWorkday(rule, date);
}

import type {
  AnnualExceptionConfigRow,
  AnnualExceptionItem,
  WorkCalendarRow,
  WorkCalendarRuleVersion,
  WorkCalendarWeekday
} from './WorkCalendarState';

const weekdayNames: WorkCalendarWeekday[] = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const dayMilliseconds = 24 * 60 * 60 * 1000;

export type AnnualExceptionSummary = {
  configCount: number;
  enabledYearCount: number;
  restDayCount: number;
  specialWorkdayCount: number;
};

export function formatCalendarDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getAnnualExceptionSummary(rows: AnnualExceptionConfigRow[]): AnnualExceptionSummary {
  const enabledRows = rows.filter((row) => row.status === '已启用');

  return {
    configCount: rows.length,
    enabledYearCount: new Set(enabledRows.map((row) => row.year)).size,
    restDayCount: enabledRows.reduce((total, row) => total + row.items.filter((item) => item.type === '休息日').length, 0),
    specialWorkdayCount: enabledRows.reduce((total, row) => total + row.items.filter((item) => item.type === '特殊工作日').length, 0)
  };
}

export function getAnnualExceptionForDate(rows: AnnualExceptionConfigRow[], date: Date): AnnualExceptionItem | undefined {
  const dateKey = formatCalendarDateKey(date);
  const year = date.getFullYear();

  return rows
    .filter((row) => row.status === '已启用' && row.year === year)
    .flatMap((row) => row.items)
    .find((item) => item.date === dateKey);
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

export function getWorkCalendarSourceSignature(
  calendar: WorkCalendarRow | undefined,
  annualExceptionRows: AnnualExceptionConfigRow[],
  date: Date
) {
  const rule = resolveWorkCalendarRule(calendar, date);
  const annualConfig = annualExceptionRows.find(
    (row) => row.status === '已启用' && row.year === date.getFullYear()
  );

  return `${calendar?.id ?? 'none'}:${rule?.id ?? 'none'}:${annualConfig?.currentRevisionId ?? 'none'}`;
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

import type { AnnualExceptionConfigRow, WorkCalendarRow } from '../system/WorkCalendarState';
import { isWorkCalendarActiveOnDate, isWorkCalendarDateWorkday, resolveDefaultWorkCalendar } from '../system/workCalendarRules';
import { formatTaskHour, normalizeTaskHourText } from './TaskManagementState';

export const taskWorkdayStartHour = 10;
export const taskWorkdayEndHour = 18;
const maxScheduleSearchDays = 3660;

function parseTaskDateTime(value: string) {
  const normalizedValue = normalizeTaskHourText(value, taskWorkdayStartHour);
  const match = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):00$/);

  if (!match) {
    return undefined;
  }

  const [, year, month, day, hour] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), 0, 0, 0);
}

function getDefaultTaskCalendar(workCalendarRows: WorkCalendarRow[], date: Date) {
  const calendar = resolveDefaultWorkCalendar(workCalendarRows, date);

  return isWorkCalendarActiveOnDate(calendar, date) ? calendar : undefined;
}

function moveToNextWorkdayStart(
  date: Date,
  workCalendarRows: WorkCalendarRow[],
  annualExceptionRows: AnnualExceptionConfigRow[]
) {
  const cursor = new Date(date);
  cursor.setHours(taskWorkdayStartHour, 0, 0, 0);

  for (let offset = 0; offset <= maxScheduleSearchDays; offset += 1) {
    const calendar = getDefaultTaskCalendar(workCalendarRows, cursor);
    if (calendar && isWorkCalendarDateWorkday(calendar, cursor, annualExceptionRows)) {
      return cursor;
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(taskWorkdayStartHour, 0, 0, 0);
  }

  return undefined;
}

function normalizeScheduleCursor(
  date: Date,
  workCalendarRows: WorkCalendarRow[],
  annualExceptionRows: AnnualExceptionConfigRow[]
) {
  const cursor = new Date(date);
  const calendar = getDefaultTaskCalendar(workCalendarRows, cursor);

  if (!calendar || !isWorkCalendarDateWorkday(calendar, cursor, annualExceptionRows)) {
    return moveToNextWorkdayStart(cursor, workCalendarRows, annualExceptionRows);
  }

  if (cursor.getHours() < taskWorkdayStartHour) {
    cursor.setHours(taskWorkdayStartHour, 0, 0, 0);
    return cursor;
  }

  if (cursor.getHours() >= taskWorkdayEndHour) {
    cursor.setDate(cursor.getDate() + 1);
    return moveToNextWorkdayStart(cursor, workCalendarRows, annualExceptionRows);
  }

  cursor.setMinutes(0, 0, 0);
  return cursor;
}

export function addTaskWorkingHours(
  dateText: string,
  hours: number,
  workCalendarRows: WorkCalendarRow[],
  annualExceptionRows: AnnualExceptionConfigRow[]
) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return '';
  }

  const startDate = parseTaskDateTime(dateText);
  if (!startDate) {
    return '';
  }

  let cursor = normalizeScheduleCursor(startDate, workCalendarRows, annualExceptionRows);
  if (!cursor) {
    return '';
  }
  let remainingHours = Math.ceil(hours);

  while (remainingHours > 0) {
    const calendar = getDefaultTaskCalendar(workCalendarRows, cursor);
    if (!isWorkCalendarDateWorkday(calendar, cursor, annualExceptionRows)) {
      const nextCursor = moveToNextWorkdayStart(cursor, workCalendarRows, annualExceptionRows);
      if (!nextCursor) {
        return '';
      }
      cursor = nextCursor;
      continue;
    }

    const availableHoursToday = Math.max(0, taskWorkdayEndHour - cursor.getHours());

    if (availableHoursToday <= 0) {
      cursor.setDate(cursor.getDate() + 1);
      const nextCursor = moveToNextWorkdayStart(cursor, workCalendarRows, annualExceptionRows);
      if (!nextCursor) {
        return '';
      }
      cursor = nextCursor;
      continue;
    }

    const hoursToUse = Math.min(remainingHours, availableHoursToday);
    cursor.setHours(cursor.getHours() + hoursToUse);
    remainingHours -= hoursToUse;

    if (remainingHours > 0) {
      cursor.setDate(cursor.getDate() + 1);
      const nextCursor = moveToNextWorkdayStart(cursor, workCalendarRows, annualExceptionRows);
      if (!nextCursor) {
        return '';
      }
      cursor = nextCursor;
    }
  }

  return formatTaskHour(cursor);
}

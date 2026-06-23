import { defaultWorkCalendarId, type AnnualExceptionConfigRow, type WorkCalendarRow } from '../system/WorkCalendarState';
import { isWorkCalendarDateWorkday } from '../system/workCalendarRules';
import { formatTaskHour, normalizeTaskHourText } from './TaskManagementState';

export const taskWorkdayStartHour = 10;
export const taskWorkdayEndHour = 18;

function parseTaskDateTime(value: string) {
  const normalizedValue = normalizeTaskHourText(value, taskWorkdayStartHour);
  const match = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):00$/);

  if (!match) {
    return undefined;
  }

  const [, year, month, day, hour] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), 0, 0, 0);
}

function getDefaultTaskCalendar(workCalendarRows: WorkCalendarRow[]) {
  return (
    workCalendarRows.find((calendar) => calendar.id === defaultWorkCalendarId && calendar.status === '启用') ??
    workCalendarRows.find((calendar) => calendar.isDefault && calendar.status === '启用') ??
    workCalendarRows.find((calendar) => calendar.status === '启用')
  );
}

function moveToNextWorkdayStart(date: Date, calendar: WorkCalendarRow, annualExceptionRows: AnnualExceptionConfigRow[]) {
  const cursor = new Date(date);
  cursor.setHours(taskWorkdayStartHour, 0, 0, 0);

  while (!isWorkCalendarDateWorkday(calendar, cursor, annualExceptionRows)) {
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(taskWorkdayStartHour, 0, 0, 0);
  }

  return cursor;
}

function normalizeScheduleCursor(date: Date, calendar: WorkCalendarRow, annualExceptionRows: AnnualExceptionConfigRow[]) {
  const cursor = new Date(date);

  if (!isWorkCalendarDateWorkday(calendar, cursor, annualExceptionRows)) {
    return moveToNextWorkdayStart(cursor, calendar, annualExceptionRows);
  }

  if (cursor.getHours() < taskWorkdayStartHour) {
    cursor.setHours(taskWorkdayStartHour, 0, 0, 0);
    return cursor;
  }

  if (cursor.getHours() >= taskWorkdayEndHour) {
    cursor.setDate(cursor.getDate() + 1);
    return moveToNextWorkdayStart(cursor, calendar, annualExceptionRows);
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

  const calendar = getDefaultTaskCalendar(workCalendarRows);
  const startDate = parseTaskDateTime(dateText);

  if (!calendar || !startDate) {
    return '';
  }

  let cursor = normalizeScheduleCursor(startDate, calendar, annualExceptionRows);
  let remainingHours = Math.ceil(hours);

  while (remainingHours > 0) {
    if (!isWorkCalendarDateWorkday(calendar, cursor, annualExceptionRows)) {
      cursor = moveToNextWorkdayStart(cursor, calendar, annualExceptionRows);
      continue;
    }

    const availableHoursToday = Math.max(0, taskWorkdayEndHour - cursor.getHours());

    if (availableHoursToday <= 0) {
      cursor.setDate(cursor.getDate() + 1);
      cursor = moveToNextWorkdayStart(cursor, calendar, annualExceptionRows);
      continue;
    }

    const hoursToUse = Math.min(remainingHours, availableHoursToday);
    cursor.setHours(cursor.getHours() + hoursToUse);
    remainingHours -= hoursToUse;

    if (remainingHours > 0) {
      cursor.setDate(cursor.getDate() + 1);
      cursor = moveToNextWorkdayStart(cursor, calendar, annualExceptionRows);
    }
  }

  return formatTaskHour(cursor);
}

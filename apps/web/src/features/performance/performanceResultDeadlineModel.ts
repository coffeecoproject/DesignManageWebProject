import type { PeopleMember } from '../people/peopleTypes';
import { getMemberWorkCalendar } from '../people/peopleDomain';
import {
  type AnnualExceptionConfigRow,
  type AnnualExceptionItem,
  type WorkCalendarRow
} from '../system/WorkCalendarState';
import {
  formatCalendarDateKey,
  getAnnualExceptionForDate,
  isWorkCalendarActiveOnDate,
  isWorkCalendarDateWorkday,
  resolveWorkCalendarRule
} from '../system/workCalendarRules';

export type PerformanceResponseCalendarSnapshot = Pick<
  WorkCalendarRow,
  'alternateWorkdays' | 'anchorDate' | 'code' | 'fixedWorkdays' | 'id' | 'name' | 'startMode' | 'type' | 'updatedAt'
> & {
  exceptionItems: AnnualExceptionItem[];
  ruleVersionIds: string[];
};

export type PerformanceResponseDeadline = {
  calendarSnapshot: PerformanceResponseCalendarSnapshot;
  deadlineAt: string;
  deadlineDate: string;
  deliveredDate: string;
  workingDates: string[];
};

type BuildPerformanceResponseDeadlineInput = {
  annualExceptionRows: AnnualExceptionConfigRow[];
  deliveredAt: string;
  member: PeopleMember;
  requiredWorkingDays?: number;
  workCalendarRows: WorkCalendarRow[];
};

const maxSearchDays = 370;

function parseDeliveredDate(deliveredAt: string) {
  const dateText = deliveredAt.slice(0, 10);
  const date = new Date(`${dateText}T00:00:00`);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function buildPerformanceResponseDeadline({
  annualExceptionRows,
  deliveredAt,
  member,
  requiredWorkingDays = 3,
  workCalendarRows
}: BuildPerformanceResponseDeadlineInput): PerformanceResponseDeadline | undefined {
  const deliveredDate = parseDeliveredDate(deliveredAt);
  const calendar = deliveredDate
    ? getMemberWorkCalendar(member, workCalendarRows, formatCalendarDateKey(deliveredDate))
    : undefined;
  const deliveredRule = deliveredDate ? resolveWorkCalendarRule(calendar, deliveredDate) : undefined;

  if (!deliveredDate || !calendar || !deliveredRule || !isWorkCalendarActiveOnDate(calendar, deliveredDate) || requiredWorkingDays < 1) {
    return undefined;
  }

  const workingDates: string[] = [];
  const exceptionItems: AnnualExceptionItem[] = [];
  const ruleVersionIds = new Set<string>();

  for (let offset = 1; offset <= maxSearchDays && workingDates.length < requiredWorkingDays; offset += 1) {
    const cursor = new Date(deliveredDate);
    cursor.setDate(deliveredDate.getDate() + offset);
    const exception = getAnnualExceptionForDate(annualExceptionRows, cursor);

    if (exception) {
      exceptionItems.push({ ...exception });
    }

    if (isWorkCalendarDateWorkday(calendar, cursor, annualExceptionRows)) {
      const appliedRule = resolveWorkCalendarRule(calendar, cursor);
      if (appliedRule) {
        ruleVersionIds.add(appliedRule.id);
      }
      workingDates.push(formatCalendarDateKey(cursor));
    }
  }

  if (workingDates.length !== requiredWorkingDays) {
    return undefined;
  }

  const deadlineDate = workingDates.at(-1)!;

  return {
    calendarSnapshot: {
      alternateWorkdays: [...deliveredRule.alternateWorkdays],
      anchorDate: deliveredRule.anchorDate,
      code: calendar.code,
      exceptionItems,
      fixedWorkdays: [...deliveredRule.fixedWorkdays],
      id: calendar.id,
      name: calendar.name,
      ruleVersionIds: [...ruleVersionIds],
      startMode: deliveredRule.startMode,
      type: deliveredRule.type,
      updatedAt: calendar.updatedAt
    },
    deadlineAt: `${deadlineDate} 23:59:59`,
    deadlineDate,
    deliveredDate: formatCalendarDateKey(deliveredDate),
    workingDates
  };
}

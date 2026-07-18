import type { AnnualExceptionConfigRow, WorkCalendarRow } from '../system/WorkCalendarState';
import { isWorkCalendarDateWorkday } from '../system/workCalendarRules';
import { getMemberWorkCalendar, type PeopleAttendanceRecord } from './peopleDomain';
import {
  payrollAttendanceMonthlyContractVersion,
  type PayrollAttendanceDeductionEntry,
  type PayrollAttendanceMonthlyContract,
  type PayrollAttendanceMonthlyReportStatus,
  type PayrollAttendanceSalarySettlementStatus
} from './peopleAttendanceSalaryContract';
import type { PeopleMember } from './peopleTypes';

export type AttendanceMonthlyReportStatus = PayrollAttendanceMonthlyReportStatus;
export type AttendanceMonthlySalarySettlementStatus = PayrollAttendanceSalarySettlementStatus;
export type AttendanceMonthlyAdjustmentType = '增加计薪出勤' | '扣减计薪出勤' | '备注修正';
export type AttendanceMonthlyAdjustmentDirection = '增加' | '扣减' | '备注';

export type AttendanceMonthlyAdjustmentRecord = {
  actor: string;
  createdAt: string;
  direction: AttendanceMonthlyAdjustmentDirection;
  hours: number;
  id: string;
  memberId: string;
  month: string;
  reason: string;
  type: AttendanceMonthlyAdjustmentType;
};

export type AttendanceMonthlyConfirmationRecord = {
  actor: string;
  confirmedAt: string;
  memberId: string;
  month: string;
  note: string;
};

export type AttendanceMonthlySalarySettlementRecord = {
  actor: string;
  memberId: string;
  month: string;
  note: string;
  settledAt: string;
  settlementNo: string;
  status: AttendanceMonthlySalarySettlementStatus;
};

export type AttendanceMonthlyPayrollDeductionEntry = PayrollAttendanceDeductionEntry;

export type AttendanceMonthlyExceptionSummary = {
  leaveDays: number;
  leaveHours: number;
  makeupWorkDays: number;
  makeupWorkHours: number;
  restDays: number;
  restHours: number;
  temporaryUnavailableDays: number;
  temporaryUnavailableHours: number;
};

export type AttendanceMonthlyReport = AttendanceMonthlyExceptionSummary & {
  adjustmentDays: number;
  adjustmentHours: number;
  canAdjust: boolean;
  confirmation?: AttendanceMonthlyConfirmationRecord;
  expectedWorkdayDates: string[];
  expectedWorkdays: number;
  expectedWorkHours: number;
  id: string;
  member: PeopleMember;
  month: string;
  payableAttendanceDays: number;
  payableAttendanceHours: number;
  payrollDeductionEntries: AttendanceMonthlyPayrollDeductionEntry[];
  payrollDeductionDays: number;
  payrollDeductionHours: number;
  payrollIncreaseDays: number;
  payrollIncreaseHours: number;
  restBalanceDays: number;
  restBalanceHours: number;
  restCoveredDays: number;
  restCoveredHours: number;
  restUncoveredDays: number;
  restUncoveredHours: number;
  relatedAdjustments: AttendanceMonthlyAdjustmentRecord[];
  relatedExceptions: PeopleAttendanceRecord[];
  salarySettlement?: AttendanceMonthlySalarySettlementRecord;
  salarySettlementStatus: AttendanceMonthlySalarySettlementStatus;
  status: AttendanceMonthlyReportStatus;
  workCalendarName: string;
};

type BuildAttendanceMonthlyReportsInput = {
  adjustments: AttendanceMonthlyAdjustmentRecord[];
  annualExceptionRows: AnnualExceptionConfigRow[];
  attendanceRecords: PeopleAttendanceRecord[];
  confirmations: AttendanceMonthlyConfirmationRecord[];
  month: string;
  peopleRows: PeopleMember[];
  salarySettlements: AttendanceMonthlySalarySettlementRecord[];
  workCalendarRows: WorkCalendarRow[];
};

const dayMilliseconds = 24 * 60 * 60 * 1000;
const standardPayrollDayHours = 8;

function parseDate(dateText: string) {
  return new Date(`${dateText}T00:00:00`);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addMinuteToTimestamp(timestamp: string) {
  const date = new Date(`${timestamp.replace(' ', 'T')}:00Z`);
  date.setUTCMinutes(date.getUTCMinutes() + 1);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function getAttendanceMonthlyConfirmationTimestamp(
  baseTimestamp: string,
  adjustments: Pick<AttendanceMonthlyAdjustmentRecord, 'createdAt'>[]
) {
  const latestAdjustmentTimestamp = adjustments.reduce(
    (latestTimestamp, adjustment) => adjustment.createdAt > latestTimestamp ? adjustment.createdAt : latestTimestamp,
    baseTimestamp
  );

  return latestAdjustmentTimestamp === baseTimestamp
    ? baseTimestamp
    : addMinuteToTimestamp(latestAdjustmentTimestamp);
}

export function getAttendanceMonthRange(month: string) {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 0);

  return {
    endDate,
    endDateText: formatDateKey(endDate),
    startDate,
    startDateText: formatDateKey(startDate)
  };
}

function isMemberInMonthlyScope(member: PeopleMember, month: string) {
  if (member.personnelType !== '全职') {
    return false;
  }

  const { endDateText, startDateText } = getAttendanceMonthRange(month);
  const activeStart = member.joinedAt;
  const activeEnd = member.status === '离职' ? member.contractEndAt ?? member.archiveUpdatedAt : undefined;

  if (activeStart > endDateText) {
    return false;
  }

  return !activeEnd || activeEnd >= startDateText;
}

export function getPayrollAttendanceDaysFromHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return 0;
  }

  return Math.round((hours / standardPayrollDayHours) * 100) / 100;
}

export function getSignedPayrollAttendanceDaysFromHours(hours: number) {
  const days = getPayrollAttendanceDaysFromHours(Math.abs(hours));

  return hours < 0 ? -days : days;
}

function roundPayrollHours(hours: number) {
  if (!Number.isFinite(hours)) {
    return 0;
  }

  return Math.round(hours * 100) / 100;
}

function getExpectedWorkdayDates(
  member: PeopleMember,
  month: string,
  workCalendarRows: WorkCalendarRow[],
  annualExceptionRows: AnnualExceptionConfigRow[]
) {
  const { endDate, startDate } = getAttendanceMonthRange(month);
  const memberStartDate = parseDate(member.joinedAt);
  const memberEndDate = member.status === '离职' ? parseDate(member.contractEndAt ?? member.archiveUpdatedAt) : endDate;
  const effectiveStartTime = Math.max(startDate.getTime(), memberStartDate.getTime());
  const effectiveEndTime = Math.min(endDate.getTime(), memberEndDate.getTime());

  if (effectiveEndTime < effectiveStartTime) {
    return [];
  }

  const calendar = getMemberWorkCalendar(member, workCalendarRows);
  const workdayDates: string[] = [];

  for (let cursorTime = effectiveStartTime; cursorTime <= effectiveEndTime; cursorTime += dayMilliseconds) {
    const cursor = new Date(cursorTime);

    if (isWorkCalendarDateWorkday(calendar, cursor, annualExceptionRows)) {
      workdayDates.push(formatDateKey(cursor));
    }
  }

  return workdayDates;
}

function getRecordDateRange(record: PeopleAttendanceRecord) {
  return {
    endDate: parseDate(record.endAt.slice(0, 10)),
    startDate: parseDate(record.startAt.slice(0, 10))
  };
}

function isRecordInMonth(record: PeopleAttendanceRecord, month: string) {
  if (record.status === '已取消') {
    return false;
  }

  const monthRange = getAttendanceMonthRange(month);
  const recordRange = getRecordDateRange(record);

  return recordRange.endDate >= monthRange.startDate && recordRange.startDate <= monthRange.endDate;
}

function getExceptionDays(record: PeopleAttendanceRecord, month: string) {
  return getPayrollAttendanceDaysFromHours(getExceptionHours(record, month));
}

function getExceptionHours(record: PeopleAttendanceRecord, month: string) {
  const monthRange = getAttendanceMonthRange(month);
  const recordRange = getRecordDateRange(record);
  const rangeStartTime = Math.max(recordRange.startDate.getTime(), monthRange.startDate.getTime());
  const rangeEndTime = Math.min(recordRange.endDate.getTime(), monthRange.endDate.getTime());

  if (rangeEndTime < rangeStartTime) {
    return 0;
  }

  const coveredCalendarDays = Math.floor((rangeEndTime - rangeStartTime) / dayMilliseconds) + 1;
  const maxCoveredHours = coveredCalendarDays * standardPayrollDayHours;

  return roundPayrollHours(Math.min(Math.max(record.durationHours, 0), maxCoveredHours));
}

function getExceptionDateHourEntries(record: PeopleAttendanceRecord, month: string) {
  const monthRange = getAttendanceMonthRange(month);
  const recordRange = getRecordDateRange(record);
  const rangeStartTime = Math.max(recordRange.startDate.getTime(), monthRange.startDate.getTime());
  const rangeEndTime = Math.min(recordRange.endDate.getTime(), monthRange.endDate.getTime());

  if (rangeEndTime < rangeStartTime) {
    return [];
  }

  let remainingHours = getExceptionHours(record, month);
  const entries: { dateText: string; hours: number }[] = [];

  for (let cursorTime = rangeStartTime; cursorTime <= rangeEndTime && remainingHours > 0; cursorTime += dayMilliseconds) {
    const hours = Math.min(standardPayrollDayHours, remainingHours);
    entries.push({
      dateText: formatDateKey(new Date(cursorTime)),
      hours
    });
    remainingHours = roundPayrollHours(remainingHours - hours);
  }

  return entries;
}

function getUncoveredRestDeductionEntries(record: PeopleAttendanceRecord, month: string, coveredHours: number) {
  let remainingCoveredHours = coveredHours;

  return getExceptionDateHourEntries(record, month).flatMap<AttendanceMonthlyPayrollDeductionEntry>((entry) => {
    if (remainingCoveredHours >= entry.hours) {
      remainingCoveredHours = roundPayrollHours(remainingCoveredHours - entry.hours);
      return [];
    }

    const uncoveredHours = roundPayrollHours(entry.hours - Math.max(0, remainingCoveredHours));
    remainingCoveredHours = 0;

    return uncoveredHours > 0
      ? [{
          dateText: entry.dateText,
          hours: uncoveredHours,
          recordId: record.id,
          type: '调休超额'
        }]
      : [];
  });
}

function buildLeaveDeductionEntries(records: PeopleAttendanceRecord[], month: string): AttendanceMonthlyPayrollDeductionEntry[] {
  return records
    .filter((record) => record.type === '请假')
    .flatMap((record) =>
      getExceptionDateHourEntries(record, month).map((entry) => ({
        dateText: entry.dateText,
        hours: entry.hours,
        recordId: record.id,
        type: '请假' as const
      }))
    );
}

function summarizeCompensatoryRest(records: PeopleAttendanceRecord[], month: string) {
  let availableCreditHours = 0;
  let coveredHours = 0;
  let creditHours = 0;
  let uncoveredHours = 0;
  const deductionEntries: AttendanceMonthlyPayrollDeductionEntry[] = [];

  records
    .filter((record) => record.type === '补班' || record.type === '调休')
    .sort((left, right) => left.startAt.localeCompare(right.startAt) || left.id.localeCompare(right.id))
    .forEach((record) => {
      const hours = getExceptionHours(record, month);

      if (record.type === '补班') {
        creditHours = roundPayrollHours(creditHours + hours);
        availableCreditHours = roundPayrollHours(availableCreditHours + hours);
        return;
      }

      const recordCoveredHours = Math.min(availableCreditHours, hours);
      const recordUncoveredHours = roundPayrollHours(hours - recordCoveredHours);
      availableCreditHours = roundPayrollHours(availableCreditHours - recordCoveredHours);
      coveredHours = roundPayrollHours(coveredHours + recordCoveredHours);
      uncoveredHours = roundPayrollHours(uncoveredHours + recordUncoveredHours);
      deductionEntries.push(...getUncoveredRestDeductionEntries(record, month, recordCoveredHours));
    });

  return {
    balanceHours: availableCreditHours,
    coveredHours,
    creditHours,
    deductionEntries,
    uncoveredHours
  };
}

export function summarizeMonthlyExceptions(records: PeopleAttendanceRecord[], month: string): AttendanceMonthlyExceptionSummary {
  return records.reduce<AttendanceMonthlyExceptionSummary>(
    (summary, record) => {
      const hours = getExceptionHours(record, month);
      const days = getExceptionDays(record, month);

      if (record.type === '请假') {
        summary.leaveDays += days;
        summary.leaveHours += hours;
      }

      if (record.type === '调休') {
        summary.restDays += days;
        summary.restHours += hours;
      }

      if (record.type === '补班') {
        summary.makeupWorkDays += days;
        summary.makeupWorkHours += hours;
      }

      if (record.type === '临时不可用') {
        summary.temporaryUnavailableDays += days;
        summary.temporaryUnavailableHours += hours;
      }

      return summary;
    },
    {
      leaveDays: 0,
      leaveHours: 0,
      makeupWorkDays: 0,
      makeupWorkHours: 0,
      restDays: 0,
      restHours: 0,
      temporaryUnavailableDays: 0,
      temporaryUnavailableHours: 0
    }
  );
}

export function getMonthlyAdjustmentSignedHours(record: Pick<AttendanceMonthlyAdjustmentRecord, 'direction' | 'hours'>) {
  if (record.direction === '增加') {
    return record.hours;
  }

  if (record.direction === '扣减') {
    return -record.hours;
  }

  return 0;
}

export function getMonthlyAdjustmentSignedDays(record: Pick<AttendanceMonthlyAdjustmentRecord, 'direction' | 'hours'>) {
  return getSignedPayrollAttendanceDaysFromHours(getMonthlyAdjustmentSignedHours(record));
}

export function getAdjustmentDirectionFromType(type: AttendanceMonthlyAdjustmentType): AttendanceMonthlyAdjustmentDirection {
  if (type === '增加计薪出勤') {
    return '增加';
  }

  if (type === '扣减计薪出勤') {
    return '扣减';
  }

  return '备注';
}

function getWorkCalendarName(member: PeopleMember, workCalendarRows: WorkCalendarRow[]) {
  const calendar = getMemberWorkCalendar(member, workCalendarRows);

  if (!calendar) {
    return '未匹配工作日历';
  }

  return `${calendar.name} / ${calendar.type}`;
}

function getEffectiveConfirmation(
  confirmation: AttendanceMonthlyConfirmationRecord | undefined,
  adjustments: AttendanceMonthlyAdjustmentRecord[]
) {
  if (!confirmation) {
    return undefined;
  }

  const hasLaterAdjustment = adjustments.some((record) => record.createdAt > confirmation.confirmedAt);

  return hasLaterAdjustment ? undefined : confirmation;
}

export function buildAttendanceMonthlyReports({
  adjustments,
  annualExceptionRows,
  attendanceRecords,
  confirmations,
  month,
  peopleRows,
  salarySettlements,
  workCalendarRows
}: BuildAttendanceMonthlyReportsInput): AttendanceMonthlyReport[] {
  return peopleRows
    .filter((member) => isMemberInMonthlyScope(member, month))
    .map((member) => {
      const relatedExceptions = attendanceRecords
        .filter((record) => record.memberId === member.id && isRecordInMonth(record, month))
        .sort((left, right) => left.startAt.localeCompare(right.startAt));
      const relatedAdjustments = adjustments
        .filter((record) => record.memberId === member.id && record.month === month)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const exceptionSummary = summarizeMonthlyExceptions(relatedExceptions, month);
      const compensatoryRestSummary = summarizeCompensatoryRest(relatedExceptions, month);
      const expectedWorkdayDates = getExpectedWorkdayDates(member, month, workCalendarRows, annualExceptionRows);
      const expectedWorkdays = expectedWorkdayDates.length;
      const expectedWorkHours = expectedWorkdays * standardPayrollDayHours;
      const payrollDeductionEntries = [
        ...buildLeaveDeductionEntries(relatedExceptions, month),
        ...compensatoryRestSummary.deductionEntries
      ];
      const payrollDeductionHours = roundPayrollHours(exceptionSummary.leaveHours + compensatoryRestSummary.uncoveredHours);
      const payrollDeductionDays = getPayrollAttendanceDaysFromHours(payrollDeductionHours);
      const payrollIncreaseDays = 0;
      const payrollIncreaseHours = 0;
      const adjustmentHours = relatedAdjustments.reduce((total, record) => total + getMonthlyAdjustmentSignedHours(record), 0);
      const adjustmentDays = getSignedPayrollAttendanceDaysFromHours(adjustmentHours);
      const confirmation = getEffectiveConfirmation(
        confirmations.find((record) => record.memberId === member.id && record.month === month),
        relatedAdjustments
      );
      const salarySettlement = salarySettlements.find((record) => record.memberId === member.id && record.month === month);
      const salarySettlementStatus = salarySettlement?.status ?? '未结算';
      const payableAttendanceHours = Math.max(
        0,
        expectedWorkHours - payrollDeductionHours + adjustmentHours
      );
      const payableAttendanceDays = Math.max(
        0,
        getPayrollAttendanceDaysFromHours(payableAttendanceHours)
      );

      return {
        ...exceptionSummary,
        adjustmentDays,
        adjustmentHours,
        canAdjust: salarySettlementStatus !== '已结算',
        confirmation,
        expectedWorkdayDates,
        expectedWorkdays,
        expectedWorkHours,
        id: `${month}-${member.id}`,
        member,
        month,
        payableAttendanceDays,
        payableAttendanceHours,
        payrollDeductionEntries,
        payrollDeductionDays,
        payrollDeductionHours,
        payrollIncreaseDays,
        payrollIncreaseHours,
        restBalanceDays: getPayrollAttendanceDaysFromHours(compensatoryRestSummary.balanceHours),
        restBalanceHours: compensatoryRestSummary.balanceHours,
        restCoveredDays: getPayrollAttendanceDaysFromHours(compensatoryRestSummary.coveredHours),
        restCoveredHours: compensatoryRestSummary.coveredHours,
        restUncoveredDays: getPayrollAttendanceDaysFromHours(compensatoryRestSummary.uncoveredHours),
        restUncoveredHours: compensatoryRestSummary.uncoveredHours,
        relatedAdjustments,
        relatedExceptions,
        salarySettlement,
        salarySettlementStatus,
        status: confirmation ? '已确认' : '待确认',
        workCalendarName: getWorkCalendarName(member, workCalendarRows)
      };
    });
}

export function toPayrollAttendanceMonthlyContract(report: AttendanceMonthlyReport): PayrollAttendanceMonthlyContract {
  return {
    adjustmentHours: report.adjustmentHours,
    contractVersion: payrollAttendanceMonthlyContractVersion,
    expectedWorkdayDates: [...report.expectedWorkdayDates],
    expectedWorkHours: report.expectedWorkHours,
    leaveHours: report.leaveHours,
    makeupWorkHours: report.makeupWorkHours,
    memberId: report.member.id,
    month: report.month,
    payableAttendanceHours: report.payableAttendanceHours,
    payrollDeductionEntries: report.payrollDeductionEntries.map((entry) => ({ ...entry })),
    payrollDeductionHours: report.payrollDeductionHours,
    payrollIncreaseHours: report.payrollIncreaseHours,
    reportId: report.id,
    reportStatus: report.status,
    restBalanceHours: report.restBalanceHours,
    restCoveredHours: report.restCoveredHours,
    restHours: report.restHours,
    restUncoveredHours: report.restUncoveredHours,
    salarySettlementStatus: report.salarySettlementStatus,
    sourceModule: '考勤月报'
  };
}

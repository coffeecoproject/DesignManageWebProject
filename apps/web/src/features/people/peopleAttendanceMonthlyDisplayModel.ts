import { normalizeDateString } from './peopleAttendanceDisplayModel';
import {
  getAdjustmentDirectionFromType,
  getMonthlyAdjustmentSignedHours,
  type AttendanceMonthlyAdjustmentRecord,
  type AttendanceMonthlyAdjustmentType,
  type AttendanceMonthlyReport
} from './peopleAttendanceMonthlyDomain';

export type MonthlyReportStatusFilter = '全部' | AttendanceMonthlyReport['status'];

export type MonthlyReportFilters = {
  keyword: string;
  month: string;
  status: MonthlyReportStatusFilter;
};

export type AttendanceMonthlyAdjustmentFormValue = {
  hours: number | null;
  memberId?: string;
  month: string;
  reason: string;
  type: AttendanceMonthlyAdjustmentType;
};

export type AttendanceMonthlyMetrics = {
  adjustmentCount: number;
  confirmed: number;
  expectedWorkdays: number;
  payableAttendanceDays: number;
  restUncoveredDays: number;
  total: number;
};

export const defaultAttendanceMonthlyFilters: MonthlyReportFilters = {
  keyword: '',
  month: '2026-06',
  status: '全部'
};

export const reportStatusTone = {
  待确认: 'amber',
  已确认: 'green'
} as const;

export const exceptionTypeTone = {
  请假: 'amber',
  调休: 'blue',
  补班: 'green',
  临时不可用: 'amber'
} as const;

export const adjustmentDirectionTone = {
  增加: 'green',
  扣减: 'amber',
  备注: 'gray'
} as const;

export const adjustmentTypeOptions: AttendanceMonthlyAdjustmentType[] = ['增加计薪出勤', '扣减计薪出勤', '备注修正'];

export const attendanceMonthlyStatusOptions: MonthlyReportStatusFilter[] = ['全部', '待确认', '已确认'];

export function formatDays(days: number) {
  if (!Number.isFinite(days) || days === 0) {
    return days === 0 ? '0 天' : '-';
  }

  return `${Number.isInteger(days) ? days : days.toFixed(2).replace(/0$/, '')} 天`;
}

export function formatHours(hours: number) {
  if (!Number.isFinite(hours) || hours === 0) {
    return hours === 0 ? '0 小时' : '-';
  }

  return `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/0$/, '')} 小时`;
}

export function formatPayrollTime(days: number, hours: number) {
  return `${formatHours(hours)} / ${formatDays(days)}`;
}

export function formatSignedHours(hours: number) {
  if (hours > 0) {
    return `+${formatHours(hours)}`;
  }

  if (hours < 0) {
    return `-${formatHours(Math.abs(hours))}`;
  }

  return '0 小时';
}

export function getAdjustmentSignedText(record: AttendanceMonthlyAdjustmentRecord) {
  return formatSignedHours(getMonthlyAdjustmentSignedHours(record));
}

export function createAttendanceMonthlyAdjustmentForm(
  month = defaultAttendanceMonthlyFilters.month
): AttendanceMonthlyAdjustmentFormValue {
  return {
    hours: 4,
    memberId: undefined,
    month,
    reason: '',
    type: '增加计薪出勤'
  };
}

export function createAttendanceMonthlyAdjustmentFormFromRecord(
  record: AttendanceMonthlyAdjustmentRecord
): AttendanceMonthlyAdjustmentFormValue {
  return {
    hours: record.direction === '备注' ? 0 : record.hours,
    memberId: record.memberId,
    month: record.month,
    reason: record.reason,
    type: record.type
  };
}

export function resolveAttendanceMonthlyFormMonth(dateString: string | string[], fallbackMonth: string) {
  return normalizeDateString(dateString) || fallbackMonth;
}

export function setAttendanceMonthlyAdjustmentFormMonth(
  form: AttendanceMonthlyAdjustmentFormValue,
  month: string
): AttendanceMonthlyAdjustmentFormValue {
  return {
    ...form,
    memberId: undefined,
    month
  };
}

export function getAttendanceMonthlyAdjustmentDirection(form: AttendanceMonthlyAdjustmentFormValue) {
  return getAdjustmentDirectionFromType(form.type);
}

export function getAttendanceMonthlyAdjustmentSelectedReport(
  reports: AttendanceMonthlyReport[],
  form: AttendanceMonthlyAdjustmentFormValue
) {
  return reports.find((report) => report.member.id === form.memberId);
}

export function getAttendanceMonthlyAdjustmentMemberOptions(reports: AttendanceMonthlyReport[]) {
  return reports
    .filter((report) => report.canAdjust)
    .map((report) => ({
      label: `${report.member.name} / ${report.member.id} / ${report.member.position}`,
      value: report.member.id
    }));
}

export function isAttendanceMonthlyAdjustmentFormValid(
  form: AttendanceMonthlyAdjustmentFormValue,
  selectedReport: AttendanceMonthlyReport | undefined
) {
  const direction = getAttendanceMonthlyAdjustmentDirection(form);

  if (!selectedReport || !selectedReport.canAdjust || !form.reason.trim()) {
    return false;
  }

  return direction === '备注' || Boolean(form.hours && form.hours > 0);
}

export function buildAttendanceMonthlyAdjustmentRecord({
  actor,
  createdAt,
  form,
  selectedReport
}: {
  actor: string;
  createdAt: string;
  form: AttendanceMonthlyAdjustmentFormValue;
  selectedReport: AttendanceMonthlyReport;
}): AttendanceMonthlyAdjustmentRecord {
  const direction = getAttendanceMonthlyAdjustmentDirection(form);

  return {
    actor,
    createdAt,
    direction,
    hours: direction === '备注' ? 0 : Number(form.hours ?? 0),
    id: `attendance-monthly-adjust-${selectedReport.member.id}-${Date.now()}`,
    memberId: selectedReport.member.id,
    month: selectedReport.month,
    reason: form.reason.trim(),
    type: form.type
  };
}

export function filterAttendanceMonthlyReports(reports: AttendanceMonthlyReport[], filters: MonthlyReportFilters) {
  return reports.filter((report) => {
    const keyword = filters.keyword.trim().toLowerCase();
    const searchableText = `${report.member.name} ${report.member.id} ${report.member.position} ${report.status}`.toLowerCase();

    if (filters.status !== '全部' && report.status !== filters.status) {
      return false;
    }

    return !keyword || searchableText.includes(keyword);
  });
}

export function getAttendanceMonthlyMetrics(reports: AttendanceMonthlyReport[]): AttendanceMonthlyMetrics {
  return {
    adjustmentCount: reports.reduce((total, report) => total + report.relatedAdjustments.length, 0),
    confirmed: reports.filter((report) => report.status === '已确认').length,
    expectedWorkdays: reports.reduce((total, report) => total + report.expectedWorkdays, 0),
    payableAttendanceDays: reports.reduce((total, report) => total + report.payableAttendanceDays, 0),
    restUncoveredDays: reports.reduce((total, report) => total + report.restUncoveredDays, 0),
    total: reports.length
  };
}

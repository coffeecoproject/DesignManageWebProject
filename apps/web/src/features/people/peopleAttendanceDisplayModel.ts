import type { OperationRecord } from '../../components/OperationRecordTable';
import {
  getPeopleAttendanceDurationHours,
  getPeopleAttendanceEffect,
  getPeopleAttendanceStatus,
  type PeopleAttendanceMode,
  type PeopleAttendanceRecord,
  type PeopleAttendanceStatus,
  type PeopleAttendanceType
} from './peopleDomain';
import { peopleAttendanceToday } from './PeopleOrganizationState';
import type { PeopleMember } from './peopleTypes';

export type AttendanceFormValue = {
  endAt: string;
  memberId: string;
  mode: PeopleAttendanceMode;
  reason: string;
  startAt: string;
  type: PeopleAttendanceType;
};

export type AttendanceFormSnapshot = Omit<AttendanceFormValue, 'mode'>;

export const attendanceDateTimeFormat = 'YYYY-MM-DD HH:mm';
export const attendanceNow = `${peopleAttendanceToday} 10:00`;
export const disabledAttendanceMinutes = Array.from({ length: 59 }, (_, index) => index + 1);
export const attendanceTypeOptions: PeopleAttendanceType[] = ['请假', '调休', '补班', '临时不可用'];
export const attendanceStatusOptions: Array<'全部' | PeopleAttendanceStatus> = ['全部', '待生效', '生效中', '已结束', '已取消'];
export const attendanceModeOptions: PeopleAttendanceMode[] = ['日常记录', '历史补录'];

export const attendanceTypeTone = {
  请假: 'amber',
  调休: 'blue',
  补班: 'green',
  临时不可用: 'amber'
} as const;

export const attendanceStatusTone = {
  待生效: 'amber',
  生效中: 'blue',
  已结束: 'green',
  已取消: 'gray'
} as const;

export const attendanceModeTone = {
  历史补录: 'purple',
  日常记录: 'blue'
} as const;

export function normalizeDateString(dateString: string | string[]) {
  return Array.isArray(dateString) ? dateString[0] ?? '' : dateString;
}

export function formatAttendanceDuration(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return '-';
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days === 0) {
    return `${hours} 小时`;
  }

  if (remainingHours === 0) {
    return `${days} 天`;
  }

  return `${days} 天 ${remainingHours} 小时`;
}

export function createAttendanceForm(memberId = ''): AttendanceFormValue {
  return {
    endAt: '',
    memberId,
    mode: '日常记录',
    reason: '',
    startAt: '',
    type: '请假'
  };
}

export function createAttendanceFormFromRecord(record: PeopleAttendanceRecord): AttendanceFormValue {
  return {
    endAt: record.endAt,
    memberId: record.memberId,
    mode: record.mode,
    reason: record.reason,
    startAt: record.startAt,
    type: record.type
  };
}

export function getAttendanceFormSnapshot(form: AttendanceFormValue): AttendanceFormSnapshot {
  return {
    endAt: form.endAt,
    memberId: form.memberId,
    reason: form.reason.trim(),
    startAt: form.startAt,
    type: form.type
  };
}

export function isSameAttendanceFormSnapshot(left: AttendanceFormSnapshot, right: AttendanceFormSnapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function getAttendanceFormDurationHours(form: AttendanceFormValue) {
  return getPeopleAttendanceDurationHours(form.startAt, form.endAt);
}

export function getAttendanceFormStatus(form: AttendanceFormValue) {
  return getPeopleAttendanceStatus(form.startAt, form.endAt, form.mode, attendanceNow);
}

export function getAttendanceFormDerivedStatus(form: AttendanceFormValue) {
  if (!form.startAt || !form.endAt || getAttendanceFormDurationHours(form) <= 0) {
    return undefined;
  }

  return getAttendanceFormStatus(form);
}

export function isHistoricalAttendanceInFuture(form: AttendanceFormValue) {
  return form.mode === '历史补录' && Boolean(form.endAt) && form.endAt > attendanceNow;
}

export function isAttendanceFormValid(form: AttendanceFormValue, selectedMember: PeopleMember | undefined) {
  return Boolean(
    selectedMember &&
      form.startAt &&
      form.endAt &&
      getAttendanceFormDurationHours(form) > 0 &&
      form.reason.trim() &&
      !isHistoricalAttendanceInFuture(form)
  );
}

export function buildAttendanceRecord({
  form,
  record,
  selectedMember
}: {
  form: AttendanceFormValue;
  record?: PeopleAttendanceRecord;
  selectedMember: PeopleMember;
}): PeopleAttendanceRecord {
  const isEditingExistingRecord = Boolean(record);

  return {
    cancelActor: record?.cancelActor,
    cancelReason: record?.cancelReason,
    canceledAt: record?.canceledAt,
    durationHours: getAttendanceFormDurationHours(form),
    editedAt: isEditingExistingRecord ? peopleAttendanceToday : record?.editedAt,
    editor: isEditingExistingRecord ? '李明' : record?.editor,
    effect: getPeopleAttendanceEffect(form.type),
    endAt: form.endAt,
    id: record?.id ?? `attendance-${String(Date.now()).slice(-8)}`,
    memberId: selectedMember.id,
    mode: record?.mode ?? form.mode,
    recordedAt: record?.recordedAt ?? peopleAttendanceToday,
    reason: form.reason.trim(),
    recorder: record?.recorder ?? '李明',
    startAt: form.startAt,
    status: record?.status === '已取消' ? '已取消' : getAttendanceFormStatus(form),
    type: form.type,
    updatedAt: peopleAttendanceToday
  };
}

export function buildCanceledAttendanceRecord(record: PeopleAttendanceRecord, cancelReason: string): PeopleAttendanceRecord {
  return {
    ...record,
    cancelActor: '李明',
    cancelReason,
    canceledAt: peopleAttendanceToday,
    status: '已取消',
    updatedAt: peopleAttendanceToday
  };
}

export function getAttendanceOperationRecords(record: PeopleAttendanceRecord, member: PeopleMember): OperationRecord[] {
  const recordedAt = record.recordedAt || record.updatedAt;
  const records: OperationRecord[] = [
    {
      action: record.mode === '历史补录' ? '补录假勤' : '记录假勤',
      actor: record.recorder,
      id: `${record.id}-record`,
      object: member.name,
      summary: `${record.type} / ${record.startAt} 至 ${record.endAt}`,
      time: recordedAt
    }
  ];

  if (record.editedAt) {
    records.unshift({
      action: '编辑记录',
      actor: record.editor ?? '李明',
      id: `${record.id}-edit`,
      object: member.name,
      summary: `${record.type} / ${record.startAt} 至 ${record.endAt}`,
      time: record.editedAt
    });
  }

  if (record.status === '已取消') {
    records.unshift({
      action: '取消记录',
      actor: record.cancelActor ?? '李明',
      id: `${record.id}-cancel`,
      object: member.name,
      summary: record.cancelReason ?? '未填写取消原因',
      time: record.canceledAt ?? record.updatedAt
    });
  }

  return records;
}

import { defaultWorkCalendarId, type AnnualExceptionConfigRow, type WorkCalendarRow } from '../system/WorkCalendarState';
import { isWorkCalendarDateWorkday } from '../system/workCalendarRules';
import type { PeopleArchiveFile, PeopleHousingFundStatus, PeopleMember, PeopleStatus, PersonnelType } from './peopleTypes';
import { getPositionId, type AccessRole } from './rolePermissionModel';
import type { PositionDataScope } from '../auth/authorizationModel';

export type PositionManagementStatus = '启用' | '停用';
export type PositionManagementFileStatus = '生效中';
export type PeopleMovementType = '转正' | '岗位调整' | '工作日历变更' | '薪资标准调整' | '续签' | '离职' | '结束合作' | '暂停任务参与' | '恢复任务参与';
export type PeopleAttendanceType = '请假' | '调休' | '补班' | '临时不可用';
export type PeopleAttendanceEffect = '不可用' | '可用';
export type PeopleAttendanceStatus = '待生效' | '生效中' | '已结束' | '已取消';
export type PeopleAttendanceMode = '日常记录' | '历史补录';
export type PeopleArchiveListStatus = '已齐全' | '待补充';
export type PeopleSalaryMode = '月薪制' | '任务制';
export type PeopleHousingFundDisplayStatus = PeopleHousingFundStatus | '不适用';
export type PeopleOverviewAvailabilityStatus = '在岗' | '休息' | '-';
export type PeopleSemanticTone = 'green' | 'gray' | 'amber' | 'blue' | 'purple';
const salaryAffectingMovementTypes = new Set<PeopleMovementType>(['转正', '岗位调整', '工作日历变更', '薪资标准调整', '离职']);

function getPreviousCalendarDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export type PositionManagementFile = {
  id: string;
  name: string;
  category: '岗位说明书' | '任职要求' | '补充资料';
  status: PositionManagementFileStatus;
  updatedAt: string;
  updatedBy: string;
};

export type PositionManagementRow = {
  id: string;
  position: string;
  code: string;
  roleBindings: AccessRole[];
  extraPermissions: string[];
  dataScopes: PositionDataScope;
  files: PositionManagementFile[];
  memberCount: number;
  status: PositionManagementStatus;
  updatedAt: string;
};

export type PositionManagementRecord = Omit<PositionManagementRow, 'memberCount'>;

export type PeopleMovementEffect = {
  memberId: string;
  type: PeopleMovementType;
  effectiveAt: string;
  newContractEndAt?: string;
  newPositions?: string[];
  newPrimaryPosition?: string;
  newSalaryText?: string;
  newWorkCalendarId?: string;
  newWorkCalendarMode?: '跟随公司默认日历' | '指定工作日历';
};

export type PeopleMovementSnapshot = {
  archiveStatus: PeopleMember['archiveStatus'];
  contractEndAt: PeopleMember['contractEndAt'];
  contractStatus: PeopleMember['contractStatus'];
  cooperationEndAt: PeopleMember['cooperationEndAt'];
  probationEndAt: PeopleMember['probationEndAt'];
  position: PeopleMember['position'];
  positionAssignments: PeopleMember['positionAssignments'];
  salaryProfile: PeopleMember['salaryProfile'];
  status: PeopleMember['status'];
  taskAccessStatus: PeopleMember['taskAccessStatus'];
  workCalendarAssignments: NonNullable<PeopleMember['workCalendarAssignments']>;
  workCalendarId: PeopleMember['workCalendarId'];
};

export type RestorePeopleMovementSnapshotOptions = {
  actor?: string;
  effectiveAt: string;
  reason: string;
  sourceRecordId: string;
  today: string;
};

export type PeopleAttendanceRecord = {
  cancelActor?: string;
  cancelReason?: string;
  canceledAt?: string;
  editedAt?: string;
  editor?: string;
  id: string;
  memberId: string;
  type: PeopleAttendanceType;
  effect: PeopleAttendanceEffect;
  startAt: string;
  endAt: string;
  durationHours: number;
  status: PeopleAttendanceStatus;
  reason: string;
  mode: PeopleAttendanceMode;
  recordedAt: string;
  recorder: string;
  updatedAt: string;
};

export function getPeopleAttendanceRecordMonths(
  record: Pick<PeopleAttendanceRecord, 'endAt' | 'startAt'>
) {
  const startMonth = record.startAt.slice(0, 7);
  const endMonth = record.endAt.slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth) || startMonth > endMonth) {
    return [];
  }

  const [startYear, startMonthNumber] = startMonth.split('-').map(Number);
  const [endYear, endMonthNumber] = endMonth.split('-').map(Number);
  const months: string[] = [];
  let year = startYear;
  let month = startMonthNumber;

  while (year < endYear || (year === endYear && month <= endMonthNumber)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;

    if (month === 13) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

export type PeopleOverviewAvailabilitySummary = {
  status: PeopleOverviewAvailabilityStatus;
  tone: PeopleSemanticTone;
};

export type PeopleTaskCountSource = {
  executorId?: string;
  status: string;
};

export const peopleOverviewAvailabilityTone: Record<PeopleOverviewAvailabilityStatus, PeopleSemanticTone> = {
  在岗: 'green',
  休息: 'gray',
  '-': 'gray'
};

const defaultOngoingTaskStatuses = new Set(['进行中']);

export function normalizePeopleText(value?: string) {
  return value?.trim() ?? '';
}

export function normalizeTaskCapabilityIds(taskCapabilityIds: string[]) {
  return Array.from(new Set(taskCapabilityIds)).sort();
}

export function getMovementAffectedSalaryMonths(effect: PeopleMovementEffect, salaryMonths: string[]) {
  if (!salaryAffectingMovementTypes.has(effect.type)) {
    return [];
  }

  const effectiveMonth = effect.effectiveAt.slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(effectiveMonth)) {
    return [];
  }

  return salaryMonths.filter((month) => month >= effectiveMonth);
}

export function isPeopleRelationshipEnded(member: Pick<PeopleMember, 'status'>) {
  return member.status === '离职' || member.status === '结束合作';
}

export function isPeopleRelationshipActive(member: Pick<PeopleMember, 'status'>) {
  return !isPeopleRelationshipEnded(member);
}

export function getPeopleRelationshipDateRange(
  member: Pick<PeopleMember, 'contractEndAt' | 'cooperationEndAt' | 'cooperationStartAt' | 'joinedAt' | 'personnelType'>
) {
  return member.personnelType === '兼职'
    ? {
        endAt: normalizePeopleText(member.cooperationEndAt ?? member.contractEndAt),
        startAt: normalizePeopleText(member.cooperationStartAt ?? member.joinedAt)
      }
    : {
        endAt: normalizePeopleText(member.contractEndAt),
        startAt: normalizePeopleText(member.joinedAt)
      };
}

export function getPeopleRelationshipRangeBlockers(
  member: Pick<PeopleMember, 'contractEndAt' | 'cooperationEndAt' | 'cooperationStartAt' | 'joinedAt' | 'personnelType'>,
  startAt: string,
  endAt: string
) {
  const relationshipRange = getPeopleRelationshipDateRange(member);
  const taskStartDate = startAt.slice(0, 10);
  const taskEndDate = endAt.slice(0, 10);
  const blockers: string[] = [];

  if (relationshipRange.startAt && taskStartDate && taskStartDate < relationshipRange.startAt.slice(0, 10)) {
    blockers.push(member.personnelType === '兼职' ? '任务开始早于合作日期' : '任务开始早于入职日期');
  }

  if (relationshipRange.endAt && taskEndDate && taskEndDate > relationshipRange.endAt.slice(0, 10)) {
    blockers.push(member.personnelType === '兼职' ? '任务结束晚于合作截止日期' : '任务结束晚于合同截止日期');
  }

  return blockers;
}

export function isFulltimePeopleMember(member: Pick<PeopleMember, 'personnelType'>) {
  return member.personnelType === '全职';
}

export function isAttendanceEligiblePeopleMember(member: Pick<PeopleMember, 'personnelType'>) {
  return isFulltimePeopleMember(member);
}

export function getPeopleHousingFundStatus(
  member: Pick<PeopleMember, 'housingFundStatus' | 'personnelType'>
): PeopleHousingFundDisplayStatus {
  if (member.personnelType !== '全职') {
    return '不适用';
  }

  return member.housingFundStatus ?? '暂不缴存';
}

export function isPeopleHousingFundContributionEnabled(member: Pick<PeopleMember, 'housingFundStatus' | 'personnelType'>) {
  return getPeopleHousingFundStatus(member) === '缴存';
}

export function isPeopleHousingFundContributionApplicable(
  member: Pick<PeopleMember, 'housingFundEffectiveMonth' | 'housingFundStatus' | 'personnelType'>,
  month: string
) {
  if (!isPeopleHousingFundContributionEnabled(member)) {
    return false;
  }

  return !member.housingFundEffectiveMonth || member.housingFundEffectiveMonth <= month;
}

export function inferCreatePeopleStatus(personnelType: PersonnelType): PeopleStatus {
  return personnelType === '全职' ? '试用期' : '合作中';
}

export function getNextPeopleWorkNo(rows: Array<Pick<PeopleMember, 'id'>>, year = '2026') {
  const sequence = rows.reduce((maxSequence, row) => {
    const matched = row.id.match(new RegExp(`^${year}(\\d{4})$`));

    if (!matched) {
      return maxSequence;
    }

    const currentSequence = Number.parseInt(matched[1], 10);
    return Number.isFinite(currentSequence) ? Math.max(maxSequence, currentSequence) : maxSequence;
  }, 0) + 1;

  return `${year}${String(sequence).padStart(4, '0')}`;
}

export function inferPeopleSalaryMode(personnelType: PersonnelType): PeopleSalaryMode {
  return personnelType === '兼职' ? '任务制' : '月薪制';
}

export function getPeopleTaskAccessStatusFromArchive(status: PeopleStatus, taskCapabilityIds: string[]): PeopleMember['taskAccessStatus'] {
  if (status === '离职' || status === '结束合作') {
    return '已关闭';
  }

  return taskCapabilityIds.length > 0 ? '可参与任务' : '暂停参与';
}

export function getPeopleSalaryModeText(member: PeopleMember): PeopleSalaryMode {
  if (member.personnelType === '兼职' || member.salaryProfile.taskRateRule) {
    return '任务制';
  }

  return '月薪制';
}

export function getPeopleArchiveListStatus(member: Pick<PeopleMember, 'archiveStatus'>): PeopleArchiveListStatus {
  return member.archiveStatus === '待补充' ? '待补充' : '已齐全';
}

export function getPeoplePendingArchiveFiles(member: Pick<PeopleMember, 'archiveFiles'>) {
  return member.archiveFiles.filter((file) => file.status === '待补充');
}

export function getPeopleEmployeeCategoryText(member: Pick<PeopleMember, 'personnelType' | 'status'>) {
  if (member.personnelType === '全职') {
    return member.status === '试用期' ? '全职/试用期' : '全职/正式';
  }

  return `兼职/${member.status}`;
}

export function getPeopleBaseSalaryText(member: PeopleMember) {
  if (member.personnelType === '兼职') {
    return member.salaryProfile.taskRateRule ? '按任务规则' : '-';
  }

  if (member.status === '试用期') {
    return member.salaryProfile.probationSalary ?? member.salaryProfile.regularSalary ?? '-';
  }

  return member.salaryProfile.regularSalary ?? member.salaryProfile.probationSalary ?? '-';
}

export function getPeopleArchiveStartDateInfo(member: PeopleMember) {
  if (member.personnelType === '兼职') {
    return {
      label: '合作起始日期',
      value: member.cooperationStartAt ?? member.joinedAt
    };
  }

  return {
    label: '入职日期',
    value: member.joinedAt
  };
}

export function getPeopleArchiveEndDateInfo(member: PeopleMember) {
  if (member.personnelType === '兼职') {
    return {
      label: '终止合作日期',
      value: member.status === '结束合作' ? member.cooperationEndAt ?? member.archiveUpdatedAt : member.cooperationEndAt ?? '-'
    };
  }

  return {
    label: '离职日期',
    value: member.status === '离职' ? member.contractEndAt ?? member.archiveUpdatedAt : '-'
  };
}

export function getPeopleRelationPeriodText(member: PeopleMember) {
  if (member.personnelType === '全职') {
    return member.probationEndAt ? `试用至 ${member.probationEndAt}` : member.contractStatus;
  }

  return member.cooperationEndAt ? `合作至 ${member.cooperationEndAt}` : member.contractStatus;
}

export function getPeopleAttendanceEffect(type: PeopleAttendanceType): PeopleAttendanceEffect {
  return type === '补班' ? '可用' : '不可用';
}

export function parsePeopleAttendanceTime(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);

  if (!match) {
    return Number.NaN;
  }

  const [, year, month, day, hour, minute] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0).getTime();
}

export function getPeopleAttendanceStatus(startAt: string, endAt: string, recordMode: PeopleAttendanceMode, nowText: string): PeopleAttendanceStatus {
  if (recordMode === '历史补录') {
    return '已结束';
  }

  if (endAt && endAt < nowText) {
    return '已结束';
  }

  if (startAt && startAt <= nowText && endAt >= nowText) {
    return '生效中';
  }

  return '待生效';
}

export function getPeopleAttendanceDurationHours(startAt: string, endAt: string) {
  const startTime = parsePeopleAttendanceTime(startAt);
  const endTime = parsePeopleAttendanceTime(endAt);

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return 0;
  }

  return Math.max(1, Math.ceil((endTime - startTime) / (1000 * 60 * 60)));
}

export function isAfterPeopleAttendanceTime(value: string, nowText: string) {
  const valueTime = parsePeopleAttendanceTime(value);
  const nowTime = parsePeopleAttendanceTime(nowText);

  return Number.isFinite(valueTime) && Number.isFinite(nowTime) && valueTime > nowTime;
}

export function getPeopleMemberDisplay(member: Pick<PeopleMember, 'personnelType' | 'status'>) {
  return `${member.personnelType} / ${member.status}`;
}

export function getWorkCalendarDisplayName(workCalendarId: string | undefined, workCalendarRows: WorkCalendarRow[], options?: { includeStatus?: boolean }) {
  const resolvedWorkCalendarId = workCalendarId || defaultWorkCalendarId;
  const calendar = workCalendarRows.find((row) => row.id === resolvedWorkCalendarId);

  if (!calendar) {
    return '未匹配工作日历';
  }

  const statusText = options?.includeStatus && calendar.status === '停用' ? ' / 停用' : '';
  return `${calendar.name} / ${calendar.type}${statusText}`;
}

export function getAttendanceWorkCalendarDisplayName(member: PeopleMember, workCalendarRows: WorkCalendarRow[]) {
  if (!isAttendanceEligiblePeopleMember(member)) {
    return '不适用';
  }

  return getWorkCalendarDisplayName(member.workCalendarId, workCalendarRows);
}

export function getWorkCalendarOptions(workCalendarRows: WorkCalendarRow[], selectedWorkCalendarId: string) {
  const availableRows = workCalendarRows.filter((row) => row.status === '启用' || row.id === selectedWorkCalendarId);
  const options = availableRows.map((row) => ({
    disabled: row.status !== '启用',
    label: getWorkCalendarDisplayName(row.id, workCalendarRows, { includeStatus: true }),
    value: row.id
  }));

  if (selectedWorkCalendarId && !options.some((option) => option.value === selectedWorkCalendarId)) {
    return [
      ...options,
      {
        disabled: true,
        label: '未匹配工作日历',
        value: selectedWorkCalendarId
      }
    ];
  }

  return options;
}

export function getArchiveWorkCalendarId(personnelType: PersonnelType, workCalendarId?: string) {
  return personnelType === '全职' ? normalizePeopleText(workCalendarId || defaultWorkCalendarId) : '';
}

export function getMemberWorkCalendar(
  member: PeopleMember,
  workCalendarRows: WorkCalendarRow[],
  dateText = '9999-12-31'
) {
  const assignments = member.workCalendarAssignments ?? [];
  const assignment = [...assignments]
    .filter((item) => item.effectiveFrom <= dateText && (!item.effectiveTo || item.effectiveTo >= dateText))
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0];

  if (assignments.length > 0 && !assignment) {
    return undefined;
  }
  const mode = assignment?.mode ?? (
    member.workCalendarId && member.workCalendarId !== defaultWorkCalendarId
      ? '指定工作日历'
      : '跟随公司默认日历'
  );
  const assignedCalendarId = assignment?.workCalendarId ?? member.workCalendarId;

  if (mode === '指定工作日历') {
    return workCalendarRows.find((calendar) => calendar.id === assignedCalendarId);
  }

  return workCalendarRows.find((calendar) => calendar.isDefault || calendar.id === defaultWorkCalendarId);
}

export function getCurrentPeopleAttendanceRecord(member: PeopleMember, attendanceRecords: PeopleAttendanceRecord[]) {
  const activeRecords = attendanceRecords.filter((record) => record.memberId === member.id && record.status === '生效中');

  return activeRecords.find((record) => record.effect === '不可用') ?? activeRecords.find((record) => record.effect === '可用');
}

export function getPeopleOverviewAvailabilitySummary(
  member: PeopleMember,
  attendanceRecords: PeopleAttendanceRecord[],
  workCalendarRows: WorkCalendarRow[],
  annualExceptionRows: AnnualExceptionConfigRow[],
  overviewDateText: string
): PeopleOverviewAvailabilitySummary {
  if (member.personnelType !== '全职' || isPeopleRelationshipEnded(member)) {
    return {
      status: '-',
      tone: peopleOverviewAvailabilityTone['-']
    };
  }

  const currentAttendanceRecord = getCurrentPeopleAttendanceRecord(member, attendanceRecords);

  if (currentAttendanceRecord) {
    const status: PeopleOverviewAvailabilityStatus =
      currentAttendanceRecord.effect === '可用' || currentAttendanceRecord.type === '补班' ? '在岗' : '休息';

    return {
      status,
      tone: peopleOverviewAvailabilityTone[status]
    };
  }

  const calendar = getMemberWorkCalendar(member, workCalendarRows, overviewDateText);
  const overviewDate = new Date(`${overviewDateText}T00:00:00`);
  const isWorkday = isWorkCalendarDateWorkday(calendar, overviewDate, annualExceptionRows);
  const status: PeopleOverviewAvailabilityStatus = isWorkday ? '在岗' : '休息';

  return {
    status,
    tone: peopleOverviewAvailabilityTone[status]
  };
}

export function getPeopleOngoingTaskCount(memberId: string, taskRows: PeopleTaskCountSource[], ongoingStatuses = defaultOngoingTaskStatuses) {
  return taskRows.filter((task) => task.executorId === memberId && ongoingStatuses.has(task.status)).length;
}

export function toPositionManagementRecord(row: PositionManagementRow): PositionManagementRecord {
  return {
    code: row.code,
    files: row.files,
    id: row.id,
    position: row.position,
    extraPermissions: row.extraPermissions,
    dataScopes: { ...row.dataScopes },
    roleBindings: row.roleBindings,
    status: row.status,
    updatedAt: row.updatedAt
  };
}

export function getPositionRowsWithMemberCount(records: PositionManagementRecord[], members: PeopleMember[]): PositionManagementRow[] {
  return records.map((record) => ({
    ...record,
    memberCount: members.filter((member) => getPeopleMemberPositions(member).includes(record.position)).length
  }));
}

export function getPeopleMemberPositions(member: Pick<PeopleMember, 'position' | 'positionAssignments'>) {
  return [...new Set(
    member.positionAssignments
      .filter((assignment) => assignment.status === '生效中')
      .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))
      .map((assignment) => assignment.positionName.trim())
      .filter(Boolean)
  )];
}

export function getPeoplePositionSummary(member: Pick<PeopleMember, 'position' | 'positionAssignments'>) {
  const positions = getPeopleMemberPositions(member);

  if (positions.length <= 1) {
    return positions[0] ?? '-';
  }

  return `${positions[0]} 等 ${positions.length} 个岗位`;
}

export function createPeopleMovementSnapshot(member: PeopleMember): PeopleMovementSnapshot {
  return {
    archiveStatus: member.archiveStatus,
    contractEndAt: member.contractEndAt,
    contractStatus: member.contractStatus,
    cooperationEndAt: member.cooperationEndAt,
    probationEndAt: member.probationEndAt,
    position: member.position,
    positionAssignments: member.positionAssignments.map((assignment) => ({ ...assignment })),
    salaryProfile: { ...member.salaryProfile },
    status: member.status,
    taskAccessStatus: member.taskAccessStatus,
    workCalendarAssignments: (member.workCalendarAssignments ?? []).map((assignment) => ({ ...assignment })),
    workCalendarId: member.workCalendarId
  };
}

export function isPeopleMovementSnapshotEqual(member: PeopleMember, snapshot: PeopleMovementSnapshot) {
  const currentSnapshot = createPeopleMovementSnapshot(member);
  return JSON.stringify(currentSnapshot) === JSON.stringify(snapshot);
}

export function restorePeopleMovementSnapshot(
  member: PeopleMember,
  snapshot: PeopleMovementSnapshot,
  options: RestorePeopleMovementSnapshotOptions
): PeopleMember {
  const reason = normalizePeopleText(options.reason) || '未填写原因';

  return {
    ...member,
    archiveStatus: snapshot.archiveStatus,
    archiveUpdatedAt: options.today,
    auditRecords: [
      {
        time: `${options.effectiveAt} 00:00`,
        actor: options.actor ?? '李明',
        action: '冲正',
        result: '成功',
        note: `冲正原异动 ${options.sourceRecordId}：${reason}`
      },
      ...member.auditRecords
    ],
    contractEndAt: snapshot.contractEndAt,
    contractStatus: snapshot.contractStatus,
    cooperationEndAt: snapshot.cooperationEndAt,
    probationEndAt: snapshot.probationEndAt,
    position: snapshot.position,
    positionAssignments: snapshot.positionAssignments.map((assignment) => ({ ...assignment })),
    salaryProfile: { ...snapshot.salaryProfile },
    status: snapshot.status,
    taskAccessStatus: snapshot.taskAccessStatus,
    workCalendarAssignments: snapshot.workCalendarAssignments.map((assignment) => ({ ...assignment })),
    workCalendarId: snapshot.workCalendarId
  };
}

export function applyPeopleMovementEffect(
  member: PeopleMember,
  effect: PeopleMovementEffect,
  options: { actor?: string; today: string }
): PeopleMember {
  if (member.id !== effect.memberId) {
    return member;
  }

  const baseAuditRecord = {
    time: `${effect.effectiveAt} 00:00`,
    actor: options.actor ?? '李明',
    action: effect.type,
    result: '成功' as const,
    note: '人事异动生效后同步人员档案'
  };

  if (effect.type === '转正') {
    return {
      ...member,
      archiveUpdatedAt: options.today,
      auditRecords: [baseAuditRecord, ...member.auditRecords],
      contractStatus: '正式合同',
      probationEndAt: effect.effectiveAt,
      status: '在职'
    };
  }

  if (effect.type === '岗位调整') {
    const positions = Array.from(new Set((effect.newPositions ?? []).map(normalizePeopleText).filter(Boolean)));
    const primaryPosition = normalizePeopleText(effect.newPrimaryPosition);

    if (positions.length === 0 || !positions.includes(primaryPosition)) {
      return member;
    }

    return {
      ...member,
      archiveUpdatedAt: options.today,
      auditRecords: [baseAuditRecord, ...member.auditRecords],
      position: primaryPosition,
      positionAssignments: [
        ...member.positionAssignments.map((assignment) => assignment.status === '生效中'
          ? { ...assignment, effectiveTo: getPreviousCalendarDate(effect.effectiveAt), status: '已结束' as const }
          : { ...assignment }),
        ...positions.map((positionName, index) => ({
          effectiveFrom: effect.effectiveAt,
          id: `${member.id}-${effect.effectiveAt}-${index + 1}`,
          isPrimary: positionName === primaryPosition,
          positionId: getPositionId(positionName),
          positionName,
          status: '生效中' as const
        }))
      ]
    };
  }

  if (effect.type === '工作日历变更') {
    const mode = effect.newWorkCalendarMode ?? '跟随公司默认日历';
    const workCalendarId = mode === '指定工作日历' ? normalizePeopleText(effect.newWorkCalendarId) : undefined;

    if (mode === '指定工作日历' && !workCalendarId) {
      return member;
    }

    const existingAssignments = member.workCalendarAssignments ?? [
      {
        effectiveFrom: member.joinedAt,
        id: `${member.id}-calendar-initial`,
        mode: member.workCalendarId && member.workCalendarId !== defaultWorkCalendarId
          ? '指定工作日历' as const
          : '跟随公司默认日历' as const,
        status: '生效中' as const,
        workCalendarId: member.workCalendarId
      }
    ];

    return {
      ...member,
      archiveUpdatedAt: options.today,
      auditRecords: [baseAuditRecord, ...member.auditRecords],
      workCalendarAssignments: [
        ...existingAssignments.map((assignment) => assignment.status === '生效中'
          ? { ...assignment, effectiveTo: getPreviousCalendarDate(effect.effectiveAt), status: '已结束' as const }
          : assignment),
        {
          effectiveFrom: effect.effectiveAt,
          id: `${member.id}-calendar-${effect.effectiveAt}`,
          mode,
          status: '生效中',
          workCalendarId
        }
      ],
      workCalendarId
    };
  }

  if (effect.type === '离职') {
    return {
      ...member,
      archiveStatus: member.archiveStatus === '待补充' ? '待补充' : '已归档',
      archiveUpdatedAt: options.today,
      auditRecords: [baseAuditRecord, ...member.auditRecords],
      contractEndAt: effect.effectiveAt,
      contractStatus: '已离职',
      salaryProfile: {
        ...member.salaryProfile,
        status: '已停用'
      },
      status: '离职',
      positionAssignments: member.positionAssignments.map((assignment) =>
        assignment.status === '生效中'
          ? { ...assignment, effectiveTo: effect.effectiveAt, status: '已结束' as const }
          : assignment
      ),
      taskAccessStatus: '已关闭'
    };
  }

  if (effect.type === '结束合作') {
    return {
      ...member,
      archiveStatus: member.archiveStatus === '待补充' ? '待补充' : '已归档',
      archiveUpdatedAt: options.today,
      auditRecords: [baseAuditRecord, ...member.auditRecords],
      contractEndAt: effect.effectiveAt,
      contractStatus: '合作已结束',
      cooperationEndAt: effect.effectiveAt,
      salaryProfile: {
        ...member.salaryProfile,
        status: '已停用'
      },
      status: '结束合作',
      positionAssignments: member.positionAssignments.map((assignment) =>
        assignment.status === '生效中'
          ? { ...assignment, effectiveTo: effect.effectiveAt, status: '已结束' as const }
          : assignment
      ),
      taskAccessStatus: '已关闭'
    };
  }

  if (effect.type === '续签') {
    const nextEndAt = effect.newContractEndAt || member.contractEndAt || member.cooperationEndAt;

    return {
      ...member,
      archiveUpdatedAt: options.today,
      auditRecords: [baseAuditRecord, ...member.auditRecords],
      contractEndAt: nextEndAt,
      contractStatus: member.personnelType === '兼职' ? '合作协议有效' : '劳动合同有效',
      cooperationEndAt: member.personnelType === '兼职' ? nextEndAt : member.cooperationEndAt
    };
  }

  if (effect.type === '薪资标准调整') {
    const nextSalaryText = effect.newSalaryText?.trim();

    return {
      ...member,
      archiveUpdatedAt: options.today,
      auditRecords: [baseAuditRecord, ...member.auditRecords],
      salaryProfile: {
        ...member.salaryProfile,
        effectiveAt: effect.effectiveAt,
        regularSalary: member.personnelType === '全职' ? nextSalaryText || member.salaryProfile.regularSalary : member.salaryProfile.regularSalary,
        status: '已配置',
        taskRateRule: member.personnelType === '兼职' ? nextSalaryText || member.salaryProfile.taskRateRule : member.salaryProfile.taskRateRule
      }
    };
  }

  if (effect.type === '暂停任务参与') {
    return {
      ...member,
      archiveUpdatedAt: options.today,
      auditRecords: [baseAuditRecord, ...member.auditRecords],
      taskAccessStatus: '暂停参与'
    };
  }

  if (effect.type === '恢复任务参与') {
    return {
      ...member,
      archiveUpdatedAt: options.today,
      auditRecords: [baseAuditRecord, ...member.auditRecords],
      taskAccessStatus: isPeopleRelationshipEnded(member) ? '已关闭' : '可参与任务'
    };
  }

  return member;
}

export function clonePeopleArchiveFile(file: PeopleArchiveFile): PeopleArchiveFile {
  return { ...file };
}

export function clonePeopleMember(member: PeopleMember): PeopleMember {
  return {
    ...member,
    archiveFiles: member.archiveFiles.map(clonePeopleArchiveFile),
    auditRecords: member.auditRecords.map((record) => ({ ...record })),
    paymentProfile: { ...member.paymentProfile },
    salaryProfile: { ...member.salaryProfile },
    positionAssignments: member.positionAssignments.map((assignment) => ({ ...assignment })),
    workCalendarAssignments: member.workCalendarAssignments?.map((assignment) => ({ ...assignment })),
    taskCapabilityIds: [...member.taskCapabilityIds],
    taskRecords: member.taskRecords.map((record) => ({ ...record }))
  };
}

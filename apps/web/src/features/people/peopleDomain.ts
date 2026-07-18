import { defaultWorkCalendarId, type AnnualExceptionConfigRow, type WorkCalendarRow, type WorkCalendarWeekday } from '../system/WorkCalendarState';
import { isWorkCalendarDateWorkday } from '../system/workCalendarRules';
import type { PeopleArchiveFile, PeopleHousingFundStatus, PeopleMember, PeopleStatus, PersonnelType } from './peopleTypes';
import type { AccessRole } from './rolePermissionModel';

export type PositionManagementStatus = '启用' | '停用';
export type PositionManagementFileStatus = '生效中';
export type PeopleMovementType = '转正' | '薪资标准调整' | '续签' | '离职' | '结束合作' | '暂停任务参与' | '恢复任务参与';
export type PeopleAttendanceType = '请假' | '调休' | '补班' | '临时不可用';
export type PeopleAttendanceEffect = '不可用' | '可用';
export type PeopleAttendanceStatus = '待生效' | '生效中' | '已结束' | '已取消';
export type PeopleAttendanceMode = '日常记录' | '历史补录';
export type PeopleArchiveListStatus = '已齐全' | '待补充';
export type PeopleSalaryMode = '月薪制' | '任务制';
export type PeopleHousingFundDisplayStatus = PeopleHousingFundStatus | '不适用';
export type PeopleOverviewAvailabilityStatus = '在岗' | '休息' | '-';
export type PeopleSemanticTone = 'green' | 'gray' | 'amber' | 'blue' | 'purple';

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
  newSalaryText?: string;
};

export type PeopleMovementSnapshot = {
  archiveStatus: PeopleMember['archiveStatus'];
  contractEndAt: PeopleMember['contractEndAt'];
  contractStatus: PeopleMember['contractStatus'];
  cooperationEndAt: PeopleMember['cooperationEndAt'];
  probationEndAt: PeopleMember['probationEndAt'];
  salaryProfile: PeopleMember['salaryProfile'];
  status: PeopleMember['status'];
  taskAccessStatus: PeopleMember['taskAccessStatus'];
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

const calendarWeekdayNames: WorkCalendarWeekday[] = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const dayMilliseconds = 24 * 60 * 60 * 1000;
const defaultOngoingTaskStatuses = new Set(['进行中']);

export function normalizePeopleText(value?: string) {
  return value?.trim() ?? '';
}

export function normalizeTaskCapabilityIds(taskCapabilityIds: string[]) {
  return Array.from(new Set(taskCapabilityIds)).sort();
}

export function isPeopleRelationshipEnded(member: Pick<PeopleMember, 'status'>) {
  return member.status === '离职' || member.status === '结束合作';
}

export function isPeopleRelationshipActive(member: Pick<PeopleMember, 'status'>) {
  return !isPeopleRelationshipEnded(member);
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

export function isWorkCalendarWorkday(calendar: WorkCalendarRow | undefined, date: Date) {
  if (!calendar || calendar.status !== '启用') {
    return false;
  }

  const weekday = calendarWeekdayNames[date.getDay()];

  if (calendar.type === '大小周') {
    const weekOffset = getWeeksBetween(calendar.anchorDate, date);
    const anchorIsSingleWeekendWeek = calendar.startMode !== '双休周开始';
    const useAlternateWorkdays = Math.abs(weekOffset) % 2 === 0 ? anchorIsSingleWeekendWeek : !anchorIsSingleWeekendWeek;
    const workdays = useAlternateWorkdays ? [...calendar.fixedWorkdays, ...calendar.alternateWorkdays] : calendar.fixedWorkdays;

    return workdays.includes(weekday);
  }

  return calendar.fixedWorkdays.includes(weekday);
}

export function getMemberWorkCalendar(member: PeopleMember, workCalendarRows: WorkCalendarRow[]) {
  return (
    workCalendarRows.find((calendar) => calendar.id === member.workCalendarId) ??
    workCalendarRows.find((calendar) => calendar.id === defaultWorkCalendarId) ??
    workCalendarRows[0]
  );
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

  const calendar = getMemberWorkCalendar(member, workCalendarRows);
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
    roleBindings: row.roleBindings,
    status: row.status,
    updatedAt: row.updatedAt
  };
}

export function getPositionRowsWithMemberCount(records: PositionManagementRecord[], members: PeopleMember[]): PositionManagementRow[] {
  return records.map((record) => ({
    ...record,
    memberCount: members.filter((member) => member.position === record.position).length
  }));
}

export function createPeopleMovementSnapshot(member: PeopleMember): PeopleMovementSnapshot {
  return {
    archiveStatus: member.archiveStatus,
    contractEndAt: member.contractEndAt,
    contractStatus: member.contractStatus,
    cooperationEndAt: member.cooperationEndAt,
    probationEndAt: member.probationEndAt,
    salaryProfile: { ...member.salaryProfile },
    status: member.status,
    taskAccessStatus: member.taskAccessStatus
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
    salaryProfile: { ...snapshot.salaryProfile },
    status: snapshot.status,
    taskAccessStatus: snapshot.taskAccessStatus
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
    taskCapabilityIds: [...member.taskCapabilityIds],
    taskRecords: member.taskRecords.map((record) => ({ ...record }))
  };
}

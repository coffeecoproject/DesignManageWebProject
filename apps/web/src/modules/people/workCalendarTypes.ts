export const workCalendarTypes = ['双休', '单休', '大小周', '自定义'] as const;
export const workCalendarWeekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;
export const bigSmallWeekModes = ['单休周开始', '双休周开始'] as const;
export const annualExceptionTypes = ['休息日', '特殊工作日'] as const;
export const annualExceptionStatuses = ['草稿', '已启用'] as const;
export const statutoryHolidayGroups = [
  { id: 'new-year', name: '元旦' },
  { id: 'spring-festival', name: '春节' },
  { id: 'qingming', name: '清明节' },
  { id: 'labor-day', name: '劳动节' },
  { id: 'dragon-boat', name: '端午节' },
  { id: 'national-mid-autumn', name: '国庆/中秋' }
] as const;

export type WorkCalendarType = (typeof workCalendarTypes)[number];
export type WorkCalendarStatus = '启用' | '停用';
export type WorkCalendarStatusPeriod = {
  effectiveFrom: string;
  effectiveTo?: string;
  status: WorkCalendarStatus;
};
export type WorkCalendarDefaultPeriod = {
  effectiveFrom: string;
  effectiveTo?: string;
};
export type WorkCalendarWeekday = (typeof workCalendarWeekdays)[number];
export type BigSmallWeekMode = (typeof bigSmallWeekModes)[number];
export type AnnualExceptionType = (typeof annualExceptionTypes)[number];
export type AnnualExceptionStatus = (typeof annualExceptionStatuses)[number];
export type AnnualExceptionStatusPeriod = {
  effectiveFrom: string;
  effectiveTo?: string;
  status: AnnualExceptionStatus;
};
export type StatutoryHolidayGroupId = (typeof statutoryHolidayGroups)[number]['id'];

export type AnnualExceptionItem = {
  date: string;
  groupId: StatutoryHolidayGroupId;
  groupName: string;
  id: string;
  name: string;
  note: string;
  type: AnnualExceptionType;
};

export type AnnualExceptionRevision = {
  createdAt: string;
  createdBy: string;
  effectiveFrom: string;
  effectiveTo?: string;
  id: string;
  items: AnnualExceptionItem[];
  revision: number;
  source: string;
};

export type AnnualExceptionConfigRow = {
  code: string;
  currentRevisionId?: string;
  id: string;
  revisions: AnnualExceptionRevision[];
  status: AnnualExceptionStatus;
  statusPeriods?: AnnualExceptionStatusPeriod[];
  updatedAt: string;
  updatedBy: string;
  year: number;
};

export type WorkCalendarRuleVersion = {
  alternateWorkdays: WorkCalendarWeekday[];
  anchorDate?: string;
  createdAt: string;
  effectiveFrom: string;
  effectiveTo?: string;
  fixedWorkdays: WorkCalendarWeekday[];
  id: string;
  note: string;
  startMode?: BigSmallWeekMode;
  type: WorkCalendarType;
  version: number;
};

export type AnnualExceptionConfigFormValue = {
  effectiveFrom: string;
  items: AnnualExceptionItem[];
  source: string;
  year: number;
};

export type WorkCalendarRow = {
  alternateWorkdays: WorkCalendarWeekday[];
  anchorDate?: string;
  code: string;
  currentVersionId?: string;
  defaultPeriods?: WorkCalendarDefaultPeriod[];
  effectiveFrom?: string;
  fixedWorkdays: WorkCalendarWeekday[];
  id: string;
  isDefault: boolean;
  name: string;
  note: string;
  startMode?: BigSmallWeekMode;
  status: WorkCalendarStatus;
  statusPeriods?: WorkCalendarStatusPeriod[];
  type: WorkCalendarType;
  updatedAt: string;
  versions?: WorkCalendarRuleVersion[];
};

export type WorkCalendarFormValue = Pick<
  WorkCalendarRow,
  'alternateWorkdays' | 'anchorDate' | 'fixedWorkdays' | 'name' | 'note' | 'startMode' | 'type'
> & { effectiveFrom: string };

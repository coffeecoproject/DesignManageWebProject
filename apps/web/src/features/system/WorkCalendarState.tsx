import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  validateDefaultMasterDataStatusChange,
  type MasterDataMutationResult
} from './masterDataLifecycleModel';

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
export type WorkCalendarWeekday = (typeof workCalendarWeekdays)[number];
export type BigSmallWeekMode = (typeof bigSmallWeekModes)[number];
export type AnnualExceptionType = (typeof annualExceptionTypes)[number];
export type AnnualExceptionStatus = (typeof annualExceptionStatuses)[number];
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
  id: string;
  items: AnnualExceptionItem[];
  revision: number;
  source: string;
};

export type AnnualExceptionConfigRow = {
  code: string;
  id: string;
  items: AnnualExceptionItem[];
  currentRevisionId?: string;
  revisions?: AnnualExceptionRevision[];
  source: string;
  status: AnnualExceptionStatus;
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

export type AnnualExceptionConfigFormValue = Pick<AnnualExceptionConfigRow, 'items' | 'source' | 'year'>;

export type WorkCalendarRow = {
  alternateWorkdays: WorkCalendarWeekday[];
  anchorDate?: string;
  code: string;
  currentVersionId?: string;
  effectiveFrom?: string;
  fixedWorkdays: WorkCalendarWeekday[];
  id: string;
  isDefault: boolean;
  name: string;
  note: string;
  startMode?: BigSmallWeekMode;
  status: WorkCalendarStatus;
  type: WorkCalendarType;
  updatedAt: string;
  versions?: WorkCalendarRuleVersion[];
};

export type WorkCalendarFormValue = Pick<
  WorkCalendarRow,
  'alternateWorkdays' | 'anchorDate' | 'fixedWorkdays' | 'name' | 'note' | 'startMode' | 'type'
> & { effectiveFrom: string };

type WorkCalendarStateValue = {
  annualExceptionRows: AnnualExceptionConfigRow[];
  createAnnualExceptionConfig: (nextValue: AnnualExceptionConfigFormValue) => AnnualExceptionConfigRow;
  createWorkCalendar: (nextValue: WorkCalendarFormValue) => void;
  updateAnnualExceptionConfig: (id: string, nextValue: AnnualExceptionConfigFormValue) => void;
  updateAnnualExceptionStatus: (id: string, status: AnnualExceptionStatus) => void;
  updateWorkCalendar: (id: string, nextValue: WorkCalendarFormValue) => void;
  updateWorkCalendarStatus: (id: string, status: WorkCalendarStatus, activeMemberCount?: number) => MasterDataMutationResult;
  workCalendarRows: WorkCalendarRow[];
};

export const defaultDoubleWeekendWorkdays: WorkCalendarWeekday[] = ['周一', '周二', '周三', '周四', '周五'];
export const defaultSingleWeekendWorkdays: WorkCalendarWeekday[] = ['周一', '周二', '周三', '周四', '周五', '周六'];
export const defaultBigSmallFixedWorkdays: WorkCalendarWeekday[] = ['周一', '周二', '周三', '周四', '周五'];
export const defaultBigSmallAlternateWorkdays: WorkCalendarWeekday[] = ['周六'];

const prototypeToday = '2026-06-16';
export const defaultWorkCalendarId = 'calendar-big-small-week';

function createStatutoryHolidayItem(
  sequence: number,
  groupId: StatutoryHolidayGroupId,
  date: string,
  type: AnnualExceptionType
): AnnualExceptionItem {
  const group = statutoryHolidayGroups.find((candidate) => candidate.id === groupId) ?? statutoryHolidayGroups[0];
  const suffix = String(sequence).padStart(3, '0');

  return {
    date,
    groupId: group.id,
    groupName: group.name,
    id: `annual-2026-${suffix}`,
    name: type === '休息日' ? group.name : `${group.name}工作日调整`,
    note: '',
    type
  };
}

export const statutoryHolidayItems2026: AnnualExceptionItem[] = [
  createStatutoryHolidayItem(1, 'new-year', '2026-01-01', '休息日'),
  createStatutoryHolidayItem(2, 'new-year', '2026-01-02', '休息日'),
  createStatutoryHolidayItem(3, 'new-year', '2026-01-03', '休息日'),
  createStatutoryHolidayItem(4, 'new-year', '2026-01-04', '特殊工作日'),
  createStatutoryHolidayItem(5, 'spring-festival', '2026-02-14', '特殊工作日'),
  createStatutoryHolidayItem(6, 'spring-festival', '2026-02-15', '休息日'),
  createStatutoryHolidayItem(7, 'spring-festival', '2026-02-16', '休息日'),
  createStatutoryHolidayItem(8, 'spring-festival', '2026-02-17', '休息日'),
  createStatutoryHolidayItem(9, 'spring-festival', '2026-02-18', '休息日'),
  createStatutoryHolidayItem(10, 'spring-festival', '2026-02-19', '休息日'),
  createStatutoryHolidayItem(11, 'spring-festival', '2026-02-20', '休息日'),
  createStatutoryHolidayItem(12, 'spring-festival', '2026-02-21', '休息日'),
  createStatutoryHolidayItem(13, 'spring-festival', '2026-02-22', '休息日'),
  createStatutoryHolidayItem(14, 'spring-festival', '2026-02-23', '休息日'),
  createStatutoryHolidayItem(15, 'spring-festival', '2026-02-28', '特殊工作日'),
  createStatutoryHolidayItem(16, 'qingming', '2026-04-04', '休息日'),
  createStatutoryHolidayItem(17, 'qingming', '2026-04-05', '休息日'),
  createStatutoryHolidayItem(18, 'qingming', '2026-04-06', '休息日'),
  createStatutoryHolidayItem(19, 'labor-day', '2026-05-01', '休息日'),
  createStatutoryHolidayItem(20, 'labor-day', '2026-05-02', '休息日'),
  createStatutoryHolidayItem(21, 'labor-day', '2026-05-03', '休息日'),
  createStatutoryHolidayItem(22, 'labor-day', '2026-05-04', '休息日'),
  createStatutoryHolidayItem(23, 'labor-day', '2026-05-05', '休息日'),
  createStatutoryHolidayItem(24, 'labor-day', '2026-05-09', '特殊工作日'),
  createStatutoryHolidayItem(25, 'dragon-boat', '2026-06-19', '休息日'),
  createStatutoryHolidayItem(26, 'dragon-boat', '2026-06-20', '休息日'),
  createStatutoryHolidayItem(27, 'dragon-boat', '2026-06-21', '休息日'),
  createStatutoryHolidayItem(28, 'national-mid-autumn', '2026-09-20', '特殊工作日'),
  createStatutoryHolidayItem(29, 'national-mid-autumn', '2026-09-25', '休息日'),
  createStatutoryHolidayItem(30, 'national-mid-autumn', '2026-09-26', '休息日'),
  createStatutoryHolidayItem(31, 'national-mid-autumn', '2026-09-27', '休息日'),
  createStatutoryHolidayItem(32, 'national-mid-autumn', '2026-10-01', '休息日'),
  createStatutoryHolidayItem(33, 'national-mid-autumn', '2026-10-02', '休息日'),
  createStatutoryHolidayItem(34, 'national-mid-autumn', '2026-10-03', '休息日'),
  createStatutoryHolidayItem(35, 'national-mid-autumn', '2026-10-04', '休息日'),
  createStatutoryHolidayItem(36, 'national-mid-autumn', '2026-10-05', '休息日'),
  createStatutoryHolidayItem(37, 'national-mid-autumn', '2026-10-06', '休息日'),
  createStatutoryHolidayItem(38, 'national-mid-autumn', '2026-10-07', '休息日'),
  createStatutoryHolidayItem(39, 'national-mid-autumn', '2026-10-10', '特殊工作日')
];

const seedAnnualExceptionRows: AnnualExceptionConfigRow[] = [
  {
    code: 'EXC-2026-001',
    id: 'annual-exception-2026',
    items: statutoryHolidayItems2026,
    currentRevisionId: 'annual-exception-2026-r1',
    revisions: [
      {
        createdAt: prototypeToday,
        createdBy: '李明',
        id: 'annual-exception-2026-r1',
        items: statutoryHolidayItems2026,
        revision: 1,
        source: '国务院办公厅通知 / 前端全年配置'
      }
    ],
    source: '国务院办公厅通知 / 前端全年配置',
    status: '已启用',
    updatedAt: prototypeToday,
    updatedBy: '李明',
    year: 2026
  }
];

const seedWorkCalendarRows: WorkCalendarRow[] = [
  {
    alternateWorkdays: [],
    code: 'CAL-2026-001',
    currentVersionId: 'calendar-default-double-weekend-v1',
    effectiveFrom: '2026-01-01',
    fixedWorkdays: defaultDoubleWeekendWorkdays,
    id: 'calendar-default-double-weekend',
    isDefault: false,
    name: '双休工作制',
    note: '适用于周末双休人员或阶段性任务安排。',
    status: '启用',
    type: '双休',
    updatedAt: prototypeToday,
    versions: [{
      alternateWorkdays: [],
      createdAt: prototypeToday,
      effectiveFrom: '2026-01-01',
      fixedWorkdays: defaultDoubleWeekendWorkdays,
      id: 'calendar-default-double-weekend-v1',
      note: '适用于周末双休人员或阶段性任务安排。',
      type: '双休',
      version: 1
    }]
  },
  {
    alternateWorkdays: [],
    code: 'CAL-2026-002',
    currentVersionId: 'calendar-single-weekend-v1',
    effectiveFrom: '2026-01-01',
    fixedWorkdays: defaultSingleWeekendWorkdays,
    id: 'calendar-single-weekend',
    isDefault: false,
    name: '单休工作制',
    note: '适用于周六正常工作的人员或阶段性任务安排。',
    status: '启用',
    type: '单休',
    updatedAt: prototypeToday,
    versions: [{
      alternateWorkdays: [],
      createdAt: prototypeToday,
      effectiveFrom: '2026-01-01',
      fixedWorkdays: defaultSingleWeekendWorkdays,
      id: 'calendar-single-weekend-v1',
      note: '适用于周六正常工作的人员或阶段性任务安排。',
      type: '单休',
      version: 1
    }]
  },
  {
    alternateWorkdays: defaultBigSmallAlternateWorkdays,
    anchorDate: '2026-06-01',
    code: 'CAL-2026-003',
    currentVersionId: 'calendar-big-small-week-v1',
    effectiveFrom: '2026-01-01',
    fixedWorkdays: defaultBigSmallFixedWorkdays,
    id: defaultWorkCalendarId,
    isDefault: true,
    name: '公司默认大小周',
    note: '默认适用于未单独指定工作日历的人员，以基准周开始交替计算周六是否工作。',
    startMode: '单休周开始',
    status: '启用',
    type: '大小周',
    updatedAt: prototypeToday,
    versions: [{
      alternateWorkdays: defaultBigSmallAlternateWorkdays,
      anchorDate: '2026-06-01',
      createdAt: prototypeToday,
      effectiveFrom: '2026-01-01',
      fixedWorkdays: defaultBigSmallFixedWorkdays,
      id: 'calendar-big-small-week-v1',
      note: '默认适用于未单独指定工作日历的人员，以基准周开始交替计算周六是否工作。',
      startMode: '单休周开始',
      type: '大小周',
      version: 1
    }]
  }
];

function getNextWorkCalendarSequence(rows: WorkCalendarRow[]) {
  return (
    rows.reduce((maxSequence, row) => {
      const sequence = Number.parseInt(row.code.replace(/^CAL-\d{4}-/, ''), 10);
      return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
    }, 0) + 1
  );
}

function normalizeWorkCalendarValue(nextValue: WorkCalendarFormValue): WorkCalendarFormValue {
  return {
    alternateWorkdays: Array.from(new Set(nextValue.alternateWorkdays)),
    anchorDate: nextValue.type === '大小周' ? nextValue.anchorDate : undefined,
    effectiveFrom: nextValue.effectiveFrom,
    fixedWorkdays: Array.from(new Set(nextValue.fixedWorkdays)),
    name: nextValue.name.trim(),
    note: nextValue.note.trim(),
    startMode: nextValue.type === '大小周' ? nextValue.startMode ?? '单休周开始' : undefined,
    type: nextValue.type
  };
}

function getPreviousDate(dateText: string) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function createWorkCalendarVersion(
  rowId: string,
  value: WorkCalendarFormValue,
  version: number
): WorkCalendarRuleVersion {
  return {
    alternateWorkdays: value.alternateWorkdays,
    anchorDate: value.anchorDate,
    createdAt: prototypeToday,
    effectiveFrom: value.effectiveFrom,
    fixedWorkdays: value.fixedWorkdays,
    id: `${rowId}-v${version}`,
    note: value.note,
    startMode: value.startMode,
    type: value.type,
    version
  };
}

function normalizeAnnualExceptionValue(nextValue: AnnualExceptionConfigFormValue): AnnualExceptionConfigFormValue {
  const items = nextValue.items
    .map((item) => ({
      ...item,
      date: item.date.trim(),
      groupName: item.groupName.trim(),
      name: item.name.trim(),
      note: item.note.trim()
    }))
    .filter((item) => item.date && item.groupId && item.groupName && item.name);

  return {
    items,
    source: nextValue.source.trim(),
    year: nextValue.year
  };
}

function getNextAnnualExceptionSequence(rows: AnnualExceptionConfigRow[], year: number) {
  return (
    rows.reduce((maxSequence, row) => {
      if (row.year !== year) {
        return maxSequence;
      }

      const sequence = Number.parseInt(row.code.replace(/^EXC-\d{4}-/, ''), 10);
      return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
    }, 0) + 1
  );
}

const WorkCalendarStateContext = createContext<WorkCalendarStateValue | undefined>(undefined);

export function WorkCalendarProvider({ children }: { children: ReactNode }) {
  const [workCalendarRows, setWorkCalendarRows] = useState<WorkCalendarRow[]>(() => seedWorkCalendarRows);
  const [annualExceptionRows, setAnnualExceptionRows] = useState<AnnualExceptionConfigRow[]>(() => seedAnnualExceptionRows);

  const value = useMemo<WorkCalendarStateValue>(
    () => ({
      annualExceptionRows,
      createAnnualExceptionConfig(nextValue) {
        const normalizedValue = normalizeAnnualExceptionValue(nextValue);
        const sequence = getNextAnnualExceptionSequence(annualExceptionRows, normalizedValue.year);
        const paddedSequence = String(sequence).padStart(3, '0');
        const nextRow: AnnualExceptionConfigRow = {
          ...normalizedValue,
          code: `EXC-${normalizedValue.year}-${paddedSequence}`,
          currentRevisionId: `annual-exception-${normalizedValue.year}-${paddedSequence}-r1`,
          id: `annual-exception-${normalizedValue.year}-${paddedSequence}`,
          revisions: [
            {
              createdAt: prototypeToday,
              createdBy: '李明',
              id: `annual-exception-${normalizedValue.year}-${paddedSequence}-r1`,
              items: normalizedValue.items,
              revision: 1,
              source: normalizedValue.source
            }
          ],
          status: '草稿',
          updatedAt: prototypeToday,
          updatedBy: '李明'
        };

        setAnnualExceptionRows((currentRows) => [...currentRows, nextRow]);
        return nextRow;
      },
      createWorkCalendar(nextValue) {
        setWorkCalendarRows((currentRows) => {
          const sequence = getNextWorkCalendarSequence(currentRows);
          const paddedSequence = String(sequence).padStart(3, '0');
          const normalizedValue = normalizeWorkCalendarValue(nextValue);
          const id = `calendar-custom-${paddedSequence}`;
          const version = createWorkCalendarVersion(id, normalizedValue, 1);
          const nextRow: WorkCalendarRow = {
            ...normalizedValue,
            code: `CAL-2026-${paddedSequence}`,
            currentVersionId: version.id,
            id,
            isDefault: false,
            status: '启用',
            updatedAt: prototypeToday,
            versions: [version]
          };

          return [...currentRows, nextRow];
        });
      },
      updateAnnualExceptionConfig(id, nextValue) {
        setAnnualExceptionRows((currentRows) =>
          currentRows.map((row) => {
            if (row.id !== id) {
              return row;
            }

            const normalizedValue = normalizeAnnualExceptionValue(nextValue);
            const revisionNumber = (row.revisions?.length ?? 0) + 1;
            const revision: AnnualExceptionRevision = {
              createdAt: prototypeToday,
              createdBy: '李明',
              id: `${row.id}-r${revisionNumber}`,
              items: normalizedValue.items,
              revision: revisionNumber,
              source: normalizedValue.source
            };

            return {
              ...row,
              ...normalizedValue,
              currentRevisionId: revision.id,
              revisions: [...(row.revisions ?? []), revision],
              updatedAt: prototypeToday,
              updatedBy: '李明'
            };
          })
        );
      },
      updateAnnualExceptionStatus(id, status) {
        setAnnualExceptionRows((currentRows) =>
          currentRows.map((row) =>
            row.id === id
              ? {
                  ...row,
                  status,
                  updatedAt: prototypeToday,
                  updatedBy: '李明'
                }
              : row
          )
        );
      },
      updateWorkCalendar(id, nextValue) {
        setWorkCalendarRows((currentRows) =>
          currentRows.map((row) => {
            if (row.id !== id) {
              return row;
            }

            const normalizedValue = normalizeWorkCalendarValue(nextValue);
            const version = createWorkCalendarVersion(row.id, normalizedValue, (row.versions?.length ?? 0) + 1);
            const versions = (row.versions ?? []).map((item) =>
              item.id === row.currentVersionId && item.effectiveFrom < version.effectiveFrom
                ? { ...item, effectiveTo: getPreviousDate(version.effectiveFrom) }
                : item
            );

            return {
              ...row,
              ...normalizedValue,
              currentVersionId: version.id,
              updatedAt: prototypeToday,
              versions: [...versions, version]
            };
          })
        );
      },
      updateWorkCalendarStatus(id, status, activeMemberCount = 0) {
        const target = workCalendarRows.find((row) => row.id === id);
        const validation = validateDefaultMasterDataStatusChange(
          status,
          Boolean(target?.isDefault),
          '默认工作日历不可停用'
        );
        if (!validation.success) {
          return validation;
        }
        if (status === '停用' && activeMemberCount > 0) {
          return {
            message: `仍有 ${activeMemberCount} 名在职人员使用该工作日历`,
            success: false
          };
        }

        setWorkCalendarRows((currentRows) =>
          currentRows.map((row) =>
            row.id === id
              ? {
                  ...row,
                  status,
                  updatedAt: prototypeToday
                }
              : row
          )
        );
        return validation;
      },
      workCalendarRows
    }),
    [annualExceptionRows, workCalendarRows]
  );

  return <WorkCalendarStateContext.Provider value={value}>{children}</WorkCalendarStateContext.Provider>;
}

export function useWorkCalendarState() {
  const value = useContext(WorkCalendarStateContext);

  if (!value) {
    throw new Error('useWorkCalendarState must be used within WorkCalendarProvider');
  }

  return value;
}

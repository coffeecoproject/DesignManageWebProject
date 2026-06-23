import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

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

export type AnnualExceptionConfigRow = {
  code: string;
  id: string;
  items: AnnualExceptionItem[];
  source: string;
  status: AnnualExceptionStatus;
  updatedAt: string;
  updatedBy: string;
  year: number;
};

export type AnnualExceptionConfigFormValue = Pick<AnnualExceptionConfigRow, 'items' | 'source' | 'year'>;

export type WorkCalendarRow = {
  alternateWorkdays: WorkCalendarWeekday[];
  anchorDate?: string;
  code: string;
  fixedWorkdays: WorkCalendarWeekday[];
  id: string;
  isDefault: boolean;
  name: string;
  note: string;
  startMode?: BigSmallWeekMode;
  status: WorkCalendarStatus;
  type: WorkCalendarType;
  updatedAt: string;
};

export type WorkCalendarFormValue = Pick<
  WorkCalendarRow,
  'alternateWorkdays' | 'anchorDate' | 'fixedWorkdays' | 'name' | 'note' | 'startMode' | 'type'
>;

type WorkCalendarStateValue = {
  annualExceptionRows: AnnualExceptionConfigRow[];
  createAnnualExceptionConfig: (nextValue: AnnualExceptionConfigFormValue) => AnnualExceptionConfigRow;
  createWorkCalendar: (nextValue: WorkCalendarFormValue) => void;
  updateAnnualExceptionConfig: (id: string, nextValue: AnnualExceptionConfigFormValue) => void;
  updateAnnualExceptionStatus: (id: string, status: AnnualExceptionStatus) => void;
  updateWorkCalendar: (id: string, nextValue: WorkCalendarFormValue) => void;
  updateWorkCalendarStatus: (id: string, status: WorkCalendarStatus) => void;
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

const seedAnnualExceptionItems2026: AnnualExceptionItem[] = [
  createStatutoryHolidayItem(1, 'new-year', '2026-01-01', '休息日'),
  createStatutoryHolidayItem(2, 'new-year', '2026-01-02', '休息日'),
  createStatutoryHolidayItem(3, 'new-year', '2026-01-03', '休息日'),
  createStatutoryHolidayItem(4, 'new-year', '2026-01-04', '特殊工作日'),
  createStatutoryHolidayItem(5, 'spring-festival', '2026-02-14', '特殊工作日'),
  createStatutoryHolidayItem(6, 'spring-festival', '2026-02-16', '休息日'),
  createStatutoryHolidayItem(7, 'spring-festival', '2026-02-17', '休息日'),
  createStatutoryHolidayItem(8, 'spring-festival', '2026-02-18', '休息日'),
  createStatutoryHolidayItem(9, 'spring-festival', '2026-02-19', '休息日'),
  createStatutoryHolidayItem(10, 'spring-festival', '2026-02-20', '休息日'),
  createStatutoryHolidayItem(11, 'spring-festival', '2026-02-21', '休息日'),
  createStatutoryHolidayItem(12, 'spring-festival', '2026-02-22', '休息日'),
  createStatutoryHolidayItem(13, 'spring-festival', '2026-02-23', '休息日'),
  createStatutoryHolidayItem(14, 'spring-festival', '2026-02-28', '特殊工作日'),
  createStatutoryHolidayItem(15, 'qingming', '2026-04-04', '休息日'),
  createStatutoryHolidayItem(16, 'qingming', '2026-04-05', '休息日'),
  createStatutoryHolidayItem(17, 'qingming', '2026-04-06', '休息日'),
  createStatutoryHolidayItem(18, 'labor-day', '2026-04-26', '特殊工作日'),
  createStatutoryHolidayItem(19, 'labor-day', '2026-05-01', '休息日'),
  createStatutoryHolidayItem(20, 'labor-day', '2026-05-02', '休息日'),
  createStatutoryHolidayItem(21, 'labor-day', '2026-05-03', '休息日'),
  createStatutoryHolidayItem(22, 'labor-day', '2026-05-04', '休息日'),
  createStatutoryHolidayItem(23, 'labor-day', '2026-05-05', '休息日'),
  createStatutoryHolidayItem(24, 'labor-day', '2026-05-09', '特殊工作日'),
  createStatutoryHolidayItem(25, 'dragon-boat', '2026-06-19', '休息日'),
  createStatutoryHolidayItem(26, 'dragon-boat', '2026-06-20', '休息日'),
  createStatutoryHolidayItem(27, 'dragon-boat', '2026-06-21', '休息日'),
  createStatutoryHolidayItem(28, 'national-mid-autumn', '2026-09-27', '特殊工作日'),
  createStatutoryHolidayItem(29, 'national-mid-autumn', '2026-10-01', '休息日'),
  createStatutoryHolidayItem(30, 'national-mid-autumn', '2026-10-02', '休息日'),
  createStatutoryHolidayItem(31, 'national-mid-autumn', '2026-10-03', '休息日'),
  createStatutoryHolidayItem(32, 'national-mid-autumn', '2026-10-04', '休息日'),
  createStatutoryHolidayItem(33, 'national-mid-autumn', '2026-10-05', '休息日'),
  createStatutoryHolidayItem(34, 'national-mid-autumn', '2026-10-06', '休息日'),
  createStatutoryHolidayItem(35, 'national-mid-autumn', '2026-10-07', '休息日'),
  createStatutoryHolidayItem(36, 'national-mid-autumn', '2026-10-08', '休息日'),
  createStatutoryHolidayItem(37, 'national-mid-autumn', '2026-10-10', '特殊工作日')
];

const seedAnnualExceptionRows: AnnualExceptionConfigRow[] = [
  {
    code: 'EXC-2026-001',
    id: 'annual-exception-2026',
    items: seedAnnualExceptionItems2026,
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
    fixedWorkdays: defaultDoubleWeekendWorkdays,
    id: 'calendar-default-double-weekend',
    isDefault: false,
    name: '双休工作制',
    note: '适用于周末双休人员或阶段性任务安排。',
    status: '启用',
    type: '双休',
    updatedAt: prototypeToday
  },
  {
    alternateWorkdays: [],
    code: 'CAL-2026-002',
    fixedWorkdays: defaultSingleWeekendWorkdays,
    id: 'calendar-single-weekend',
    isDefault: false,
    name: '单休工作制',
    note: '适用于周六正常工作的人员或阶段性任务安排。',
    status: '启用',
    type: '单休',
    updatedAt: prototypeToday
  },
  {
    alternateWorkdays: defaultBigSmallAlternateWorkdays,
    anchorDate: '2026-06-01',
    code: 'CAL-2026-003',
    fixedWorkdays: defaultBigSmallFixedWorkdays,
    id: defaultWorkCalendarId,
    isDefault: true,
    name: '公司默认大小周',
    note: '默认适用于未单独指定工作日历的人员，以基准周开始交替计算周六是否工作。',
    startMode: '单休周开始',
    status: '启用',
    type: '大小周',
    updatedAt: prototypeToday
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
    fixedWorkdays: Array.from(new Set(nextValue.fixedWorkdays)),
    name: nextValue.name.trim(),
    note: nextValue.note.trim(),
    startMode: nextValue.type === '大小周' ? nextValue.startMode ?? '单休周开始' : undefined,
    type: nextValue.type
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
          id: `annual-exception-${normalizedValue.year}-${paddedSequence}`,
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
          const nextRow: WorkCalendarRow = {
            ...normalizedValue,
            code: `CAL-2026-${paddedSequence}`,
            id: `calendar-custom-${paddedSequence}`,
            isDefault: false,
            status: '启用',
            updatedAt: prototypeToday
          };

          return [...currentRows, nextRow];
        });
      },
      updateAnnualExceptionConfig(id, nextValue) {
        setAnnualExceptionRows((currentRows) =>
          currentRows.map((row) =>
            row.id === id
              ? {
                  ...row,
                  ...normalizeAnnualExceptionValue(nextValue),
                  updatedAt: prototypeToday,
                  updatedBy: '李明'
                }
              : row
          )
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
          currentRows.map((row) =>
            row.id === id
              ? {
                  ...row,
                  ...normalizeWorkCalendarValue(nextValue),
                  updatedAt: prototypeToday
                }
              : row
          )
        );
      },
      updateWorkCalendarStatus(id, status) {
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

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  applyPeopleMovementEffect,
  getPositionRowsWithMemberCount,
  restorePeopleMovementSnapshot,
  toPositionManagementRecord,
  type PeopleAttendanceRecord,
  type PeopleMovementEffect,
  type PeopleMovementSnapshot,
  type RestorePeopleMovementSnapshotOptions,
  type PositionManagementRecord,
  type PositionManagementRow
} from './peopleDomain';
import { peopleMockRepository } from './peopleRepository';
import type { PeopleMember } from './peopleTypes';
import type {
  AttendanceMonthlyAdjustmentRecord,
  AttendanceMonthlyConfirmationRecord,
  AttendanceMonthlySalarySettlementRecord
} from './peopleAttendanceMonthlyDomain';
import { useSalaryManagementState } from '../salary/SalaryManagementState';
export type {
  PeopleAttendanceEffect,
  PeopleAttendanceMode,
  PeopleAttendanceRecord,
  PeopleAttendanceStatus,
  PeopleAttendanceType,
  PeopleMovementEffect,
  PeopleMovementSnapshot,
  PeopleMovementType,
  RestorePeopleMovementSnapshotOptions,
  PositionManagementFile,
  PositionManagementFileStatus,
  PositionManagementRow,
  PositionManagementStatus
} from './peopleDomain';
export type {
  AttendanceMonthlyAdjustmentRecord,
  AttendanceMonthlyAdjustmentType,
  AttendanceMonthlyConfirmationRecord,
  AttendanceMonthlyReport,
  AttendanceMonthlyReportStatus,
  AttendanceMonthlySalarySettlementRecord,
  AttendanceMonthlySalarySettlementStatus
} from './peopleAttendanceMonthlyDomain';

type PeopleOrganizationStateValue = {
  activePositionOptions: string[];
  attendanceMonthlyAdjustments: AttendanceMonthlyAdjustmentRecord[];
  attendanceMonthlyConfirmations: AttendanceMonthlyConfirmationRecord[];
  attendanceMonthlySalarySettlements: AttendanceMonthlySalarySettlementRecord[];
  attendanceRecords: PeopleAttendanceRecord[];
  peopleRows: PeopleMember[];
  positionRows: PositionManagementRow[];
  applyMovementEffect: (effect: PeopleMovementEffect) => void;
  cancelAttendanceRecord: (recordId: string, cancelReason: string) => void;
  confirmAttendanceMonthlyReport: (memberId: string, month: string, note?: string) => void;
  restoreMovementSnapshot: (memberId: string, snapshot: PeopleMovementSnapshot, options: Omit<RestorePeopleMovementSnapshotOptions, 'today'>) => void;
  saveAttendanceMonthlyAdjustment: (record: AttendanceMonthlyAdjustmentRecord) => void;
  saveAttendanceRecord: (record: PeopleAttendanceRecord) => void;
  savePeopleMember: (member: PeopleMember) => void;
  savePosition: (record: PositionManagementRow) => PositionManagementRow[];
};

export const peopleOrganizationToday = '2026-06-13';
export const peopleAttendanceToday = '2026-06-16';
const initialPeopleSnapshot = peopleMockRepository.getInitialSnapshot();

const initialPositionRecords: PositionManagementRecord[] = [
  {
    id: 'position-ceo',
    code: 'POS-2026-001',
    position: 'CEO',
    roleBindings: ['经营管理角色'],
    extraPermissions: ['人员总览查看', '人员档案查看'],
    files: [
      { id: 'POSFILE-CEO-001', name: 'CEO岗位说明书.pdf', category: '岗位说明书', status: '生效中', updatedAt: '2026-06-10', updatedBy: '李明' },
      { id: 'POSFILE-CEO-002', name: 'CEO任职要求.pdf', category: '任职要求', status: '生效中', updatedAt: '2026-06-10', updatedBy: '李明' }
    ],
    status: '启用',
    updatedAt: '2026-06-10'
  },
  {
    id: 'position-finance',
    code: 'POS-2026-002',
    position: '财务专员',
    roleBindings: ['财务角色'],
    extraPermissions: [],
    files: [
      { id: 'POSFILE-FIN-001', name: '财务专员岗位说明书.pdf', category: '岗位说明书', status: '生效中', updatedAt: '2026-06-09', updatedBy: '李明' },
      { id: 'POSFILE-FIN-002', name: '财务专员任职要求.pdf', category: '任职要求', status: '生效中', updatedAt: '2026-06-09', updatedBy: '李明' }
    ],
    status: '启用',
    updatedAt: '2026-06-09'
  },
  {
    id: 'position-admin',
    code: 'POS-2026-003',
    position: '行政专员',
    roleBindings: ['行政人事角色'],
    extraPermissions: [],
    files: [
      { id: 'POSFILE-ADM-001', name: '行政专员岗位说明书.pdf', category: '岗位说明书', status: '生效中', updatedAt: '2026-06-08', updatedBy: '李明' },
      { id: 'POSFILE-ADM-002', name: '行政专员任职要求.pdf', category: '任职要求', status: '生效中', updatedAt: '2026-06-08', updatedBy: '李明' }
    ],
    status: '启用',
    updatedAt: '2026-06-08'
  },
  {
    id: 'position-space-designer',
    code: 'POS-2026-004',
    position: '空间设计师',
    roleBindings: ['设计执行角色'],
    extraPermissions: [],
    files: [
      { id: 'POSFILE-SPA-001', name: '空间设计师岗位说明书.pdf', category: '岗位说明书', status: '生效中', updatedAt: '2026-06-06', updatedBy: '李明' },
      { id: 'POSFILE-SPA-002', name: '空间设计师任职要求.pdf', category: '任职要求', status: '生效中', updatedAt: '2026-06-06', updatedBy: '李明' }
    ],
    status: '启用',
    updatedAt: '2026-06-06'
  },
  {
    id: 'position-lead-designer',
    code: 'POS-2026-005',
    position: '主案设计师',
    roleBindings: ['设计执行角色', '设计审核角色'],
    extraPermissions: [],
    files: [
      { id: 'POSFILE-LEAD-001', name: '主案设计师岗位说明书.pdf', category: '岗位说明书', status: '生效中', updatedAt: '2026-06-05', updatedBy: '李明' },
      { id: 'POSFILE-LEAD-002', name: '主案设计师任职要求.pdf', category: '任职要求', status: '生效中', updatedAt: '2026-06-05', updatedBy: '李明' }
    ],
    status: '启用',
    updatedAt: '2026-06-05'
  },
  {
    id: 'position-external-designer',
    code: 'POS-2026-006',
    position: '外协设计师',
    roleBindings: ['外协执行角色'],
    extraPermissions: [],
    files: [
      { id: 'POSFILE-EXT-001', name: '外协设计师岗位说明书.pdf', category: '岗位说明书', status: '生效中', updatedAt: '2026-06-04', updatedBy: '李明' },
      { id: 'POSFILE-EXT-002', name: '外协设计师任职要求.pdf', category: '任职要求', status: '生效中', updatedAt: '2026-06-04', updatedBy: '李明' }
    ],
    status: '启用',
    updatedAt: '2026-06-04'
  }
];

const initialAttendanceRecords: PeopleAttendanceRecord[] = [
  {
    durationHours: 9,
    effect: '不可用',
    endAt: '2026-06-18 18:00',
    id: 'attendance-20260001-leave',
    memberId: '20260001',
    mode: '日常记录',
    recordedAt: peopleAttendanceToday,
    reason: '个人事务请假一天',
    recorder: '李明',
    startAt: '2026-06-18 09:00',
    status: '待生效',
    type: '请假',
    updatedAt: peopleAttendanceToday
  },
  {
    durationHours: 9,
    effect: '不可用',
    endAt: '2026-06-16 18:00',
    id: 'attendance-20250018-rest',
    memberId: '20250018',
    mode: '日常记录',
    recordedAt: peopleAttendanceToday,
    reason: '前期项目加班后安排调休',
    recorder: '李明',
    startAt: '2026-06-16 09:00',
    status: '生效中',
    type: '调休',
    updatedAt: peopleAttendanceToday
  },
  {
    durationHours: 8,
    effect: '可用',
    endAt: '2026-06-13 18:00',
    id: 'attendance-20250018-workday',
    memberId: '20250018',
    mode: '历史补录',
    recordedAt: '2026-06-13',
    reason: '前期项目加班形成调休额度',
    recorder: '李明',
    startAt: '2026-06-13 10:00',
    status: '已结束',
    type: '补班',
    updatedAt: '2026-06-13'
  },
  {
    durationHours: 8,
    effect: '可用',
    endAt: '2026-06-14 18:00',
    id: 'attendance-20250011-workday',
    memberId: '20250011',
    mode: '历史补录',
    recordedAt: '2026-06-14',
    reason: '补齐上周工作支持窗口',
    recorder: '李明',
    startAt: '2026-06-14 10:00',
    status: '已结束',
    type: '补班',
    updatedAt: '2026-06-14'
  }
];

const initialAttendanceMonthlyAdjustments: AttendanceMonthlyAdjustmentRecord[] = [
  {
    actor: '周倩',
    createdAt: '2026-06-16 16:20',
    direction: '增加',
    hours: 4,
    id: 'attendance-monthly-adjust-20260001-001',
    memberId: '20260001',
    month: '2026-06',
    reason: '端午项目支持半天，计入本月薪酬考勤',
    type: '增加计薪出勤'
  }
];

const initialAttendanceMonthlyConfirmations: AttendanceMonthlyConfirmationRecord[] = [
  {
    actor: '李明',
    confirmedAt: '2026-06-17 09:40',
    memberId: '20250018',
    month: '2026-06',
    note: '财务岗六月考勤已核对'
  }
];

const PeopleOrganizationStateContext = createContext<PeopleOrganizationStateValue | undefined>(undefined);

export function PeopleOrganizationProvider({ children }: { children: ReactNode }) {
  const { attendanceMonthlySalarySettlements } = useSalaryManagementState();
  const [peopleRows, setPeopleRows] = useState<PeopleMember[]>(() => initialPeopleSnapshot.peopleRows);
  const [positionRecords, setPositionRecords] = useState<PositionManagementRecord[]>(() => initialPositionRecords);
  const [attendanceRecords, setAttendanceRecords] = useState<PeopleAttendanceRecord[]>(() => initialAttendanceRecords);
  const [attendanceMonthlyAdjustments, setAttendanceMonthlyAdjustments] = useState<AttendanceMonthlyAdjustmentRecord[]>(
    () => initialAttendanceMonthlyAdjustments
  );
  const [attendanceMonthlyConfirmations, setAttendanceMonthlyConfirmations] = useState<AttendanceMonthlyConfirmationRecord[]>(
    () => initialAttendanceMonthlyConfirmations
  );
  const positionRows = useMemo(() => getPositionRowsWithMemberCount(positionRecords, peopleRows), [peopleRows, positionRecords]);

  const activePositionOptions = useMemo(
    () => positionRecords.filter((record) => record.status === '启用').map((record) => record.position),
    [positionRecords]
  );

  const savePeopleMember = useCallback((member: PeopleMember) => {
    setPeopleRows((currentMembers) =>
      currentMembers.some((currentMember) => currentMember.id === member.id)
        ? currentMembers.map((currentMember) => (currentMember.id === member.id ? member : currentMember))
        : [member, ...currentMembers]
    );
  }, []);

  const savePosition = useCallback(
    (row: PositionManagementRow) => {
      const nextRecord = toPositionManagementRecord(row);
      const existingRecord = positionRecords.find((record) => record.id === nextRecord.id);
      const nextPositionRecords = existingRecord
        ? positionRecords.map((record) => (record.id === nextRecord.id ? nextRecord : record))
        : [nextRecord, ...positionRecords];
      const nextPeopleRows =
        existingRecord && existingRecord.position !== nextRecord.position
          ? peopleRows.map((member) => (member.position === existingRecord.position ? { ...member, position: nextRecord.position } : member))
          : peopleRows;

      setPositionRecords(nextPositionRecords);
      setPeopleRows(nextPeopleRows);

      return getPositionRowsWithMemberCount(nextPositionRecords, nextPeopleRows);
    },
    [peopleRows, positionRecords]
  );

  const applyMovementEffect = useCallback((effect: PeopleMovementEffect) => {
    setPeopleRows((currentPeopleRows) =>
      currentPeopleRows.map((member) => applyPeopleMovementEffect(member, effect, { today: peopleOrganizationToday }))
    );
  }, []);

  const restoreMovementSnapshot = useCallback(
    (memberId: string, snapshot: PeopleMovementSnapshot, options: Omit<RestorePeopleMovementSnapshotOptions, 'today'>) => {
      setPeopleRows((currentPeopleRows) =>
        currentPeopleRows.map((member) =>
          member.id === memberId ? restorePeopleMovementSnapshot(member, snapshot, { ...options, today: peopleOrganizationToday }) : member
        )
      );
    },
    []
  );

  const saveAttendanceRecord = useCallback((record: PeopleAttendanceRecord) => {
    setAttendanceRecords((currentRecords) =>
      currentRecords.some((currentRecord) => currentRecord.id === record.id)
        ? currentRecords.map((currentRecord) => (currentRecord.id === record.id ? record : currentRecord))
        : [record, ...currentRecords]
    );
  }, []);

  const saveAttendanceMonthlyAdjustment = useCallback(
    (record: AttendanceMonthlyAdjustmentRecord) => {
      const isSalarySettled = attendanceMonthlySalarySettlements.some(
        (settlement) => settlement.memberId === record.memberId && settlement.month === record.month && settlement.status === '已结算'
      );

      if (isSalarySettled) {
        return;
      }

      setAttendanceMonthlyAdjustments((currentRecords) =>
        currentRecords.some((currentRecord) => currentRecord.id === record.id)
          ? currentRecords.map((currentRecord) => (currentRecord.id === record.id ? record : currentRecord))
          : [record, ...currentRecords]
      );
      setAttendanceMonthlyConfirmations((currentRecords) =>
        currentRecords.filter((currentRecord) => !(currentRecord.memberId === record.memberId && currentRecord.month === record.month))
      );
    },
    [attendanceMonthlySalarySettlements]
  );

  const confirmAttendanceMonthlyReport = useCallback(
    (memberId: string, month: string, note = '考勤月报已确认') => {
      const isSalarySettled = attendanceMonthlySalarySettlements.some(
        (settlement) => settlement.memberId === memberId && settlement.month === month && settlement.status === '已结算'
      );

      if (isSalarySettled) {
        return;
      }

      setAttendanceMonthlyConfirmations((currentRecords) => {
        const nextRecord: AttendanceMonthlyConfirmationRecord = {
          actor: '李明',
          confirmedAt: `${peopleAttendanceToday} 10:30`,
          memberId,
          month,
          note
        };

        return currentRecords.some((record) => record.memberId === memberId && record.month === month)
          ? currentRecords.map((record) => (record.memberId === memberId && record.month === month ? nextRecord : record))
          : [nextRecord, ...currentRecords];
      });
    },
    [attendanceMonthlySalarySettlements]
  );

  const cancelAttendanceRecord = useCallback((recordId: string, cancelReason: string) => {
    setAttendanceRecords((currentRecords) =>
      currentRecords.map((record) =>
        record.id === recordId
          ? {
              ...record,
              cancelActor: '李明',
              cancelReason,
              canceledAt: peopleAttendanceToday,
              status: '已取消',
              updatedAt: peopleAttendanceToday
            }
          : record
      )
    );
  }, []);

  const value = useMemo<PeopleOrganizationStateValue>(
    () => ({
      activePositionOptions,
      attendanceMonthlyAdjustments,
      attendanceMonthlyConfirmations,
      attendanceMonthlySalarySettlements,
      attendanceRecords,
      applyMovementEffect,
      cancelAttendanceRecord,
      confirmAttendanceMonthlyReport,
      peopleRows,
      positionRows,
      restoreMovementSnapshot,
      saveAttendanceMonthlyAdjustment,
      saveAttendanceRecord,
      savePeopleMember,
      savePosition
    }),
    [
      activePositionOptions,
      attendanceMonthlyAdjustments,
      attendanceMonthlyConfirmations,
      attendanceMonthlySalarySettlements,
      attendanceRecords,
      applyMovementEffect,
      cancelAttendanceRecord,
      confirmAttendanceMonthlyReport,
      peopleRows,
      positionRows,
      restoreMovementSnapshot,
      saveAttendanceMonthlyAdjustment,
      saveAttendanceRecord,
      savePeopleMember,
      savePosition
    ]
  );

  return <PeopleOrganizationStateContext.Provider value={value}>{children}</PeopleOrganizationStateContext.Provider>;
}

export function usePeopleOrganizationState() {
  const value = useContext(PeopleOrganizationStateContext);

  if (!value) {
    throw new Error('usePeopleOrganizationState must be used within PeopleOrganizationProvider');
  }

  return value;
}

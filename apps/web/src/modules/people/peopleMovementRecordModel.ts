import {
  createPeopleMovementSnapshot,
  type PeopleMovementSnapshot,
  type PeopleMovementType
} from './peopleDomain';
import {
  getMovementRequiredFileSlots,
  type MovementRequiredFileSlot,
  type MovementRequiredFileSlotKey
} from './peopleFileSlotModel';
import type { PeopleArchiveFile, PeopleMember } from './peopleTypes';

export type PeopleMovementRecordType = PeopleMovementType | '冲正';
export type PeopleMovementRecordSource = '人事异动' | '系统生成' | '冲正';
export type PeopleMovementRecordStatus = '待生效' | '已生效' | '已作废' | '已冲正';

export type PeopleMovementAttachment = PeopleArchiveFile & {
  slotKey?: MovementRequiredFileSlotKey;
};

export type PeopleMovementRow = {
  id: string;
  member: PeopleMember;
  type: PeopleMovementRecordType;
  effectiveAt: string;
  beforeValue: string;
  afterValue: string;
  source: PeopleMovementRecordSource;
  recordStatus: PeopleMovementRecordStatus;
  recorder: string;
  updatedAt: string;
  summary: string;
  note: string;
  files: PeopleMovementAttachment[];
  afterMemberSnapshot?: PeopleMovementSnapshot;
  beforeMemberSnapshot?: PeopleMovementSnapshot;
  reversedAt?: string;
  reversedBy?: string;
  reversedById?: string;
  reversalReason?: string;
  reversesId?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
};

type PeopleMovementSeed = {
  afterValue: string;
  beforeSnapshot?: (member: PeopleMember) => PeopleMovementSnapshot;
  beforeValue: string;
  effectiveAt: string;
  id: string;
  memberId: string;
  note: string;
  recordStatus: PeopleMovementRecordStatus;
  recorder?: string;
  source: PeopleMovementRecordSource;
  summary: string;
  type: PeopleMovementType;
  updatedAt: string;
};

export function createPeopleMovementSnapshotOverride(
  member: PeopleMember,
  overrides: Partial<Omit<PeopleMovementSnapshot, 'salaryProfile'>> & {
    salaryProfile?: Partial<PeopleMovementSnapshot['salaryProfile']>;
  }
): PeopleMovementSnapshot {
  const currentSnapshot = createPeopleMovementSnapshot(member);

  return {
    ...currentSnapshot,
    ...overrides,
    salaryProfile: {
      ...currentSnapshot.salaryProfile,
      ...overrides.salaryProfile
    }
  };
}

export function createPeopleMovementRow({
  afterMemberSnapshot,
  afterValue,
  beforeMemberSnapshot,
  beforeValue,
  effectiveAt,
  files = [],
  id,
  member,
  note,
  recordStatus = '已生效',
  recorder = '李明',
  reversedAt,
  reversedBy,
  reversedById,
  reversalReason,
  reversesId,
  source = '人事异动',
  summary,
  type,
  voidedAt,
  voidedBy,
  voidReason,
  updatedAt = effectiveAt
}: Omit<PeopleMovementRow, 'files' | 'recordStatus' | 'recorder' | 'source' | 'updatedAt'> &
  Partial<Pick<PeopleMovementRow, 'files' | 'recordStatus' | 'recorder' | 'source' | 'updatedAt'>>): PeopleMovementRow {
  return {
    afterMemberSnapshot,
    afterValue,
    beforeMemberSnapshot,
    beforeValue,
    effectiveAt,
    files,
    id,
    member,
    note,
    recordStatus,
    recorder,
    reversedAt,
    reversedBy,
    reversedById,
    reversalReason,
    reversesId,
    source,
    summary,
    type,
    voidedAt,
    voidedBy,
    voidReason,
    updatedAt
  };
}

function createSampleMovementAttachment({
  member,
  recordId,
  slot,
  updatedAt
}: {
  member: PeopleMember;
  recordId: string;
  slot: MovementRequiredFileSlot;
  updatedAt: string;
}): PeopleMovementAttachment {
  return {
    category: slot.category,
    id: `MOVFILE-${recordId}-${slot.key}`,
    name: `${member.name}-${slot.label}.pdf`,
    slotKey: slot.key,
    status: '已上传',
    updatedAt
  };
}

export const initialPeopleMovementSeeds: PeopleMovementSeed[] = [
  {
    afterValue: '全职 / 正式',
    beforeSnapshot: (member) =>
      createPeopleMovementSnapshotOverride(member, {
        contractStatus: '试用合同',
        probationEndAt: '2026-02-28',
        salaryProfile: {
          effectiveAt: member.joinedAt,
          probationSalary: '10000 元/月',
          regularSalary: '12000 元/月',
          status: '已配置'
        },
        status: '试用期'
      }),
    beforeValue: '全职 / 试用期',
    effectiveAt: '2026-02-28',
    id: 'MOV-20250018-EARLY-REGULAR',
    memberId: '20250018',
    note: '提前完成试用期评估后转正',
    recordStatus: '已生效',
    source: '人事异动',
    summary: '提前转正',
    type: '转正',
    updatedAt: '2026-02-28'
  },
  {
    afterValue: '按任务类型与验收结果执行',
    beforeSnapshot: (member) =>
      createPeopleMovementSnapshotOverride(member, {
        salaryProfile: {
          effectiveAt: '2026-03-10',
          taskRateRule: '按基础任务报价执行'
        }
      }),
    beforeValue: '按基础任务报价执行',
    effectiveAt: '2026-05-30',
    id: 'MOV-20260006-TASK-RATE',
    memberId: '20260006',
    note: '5 月任务计价规则调整',
    recordStatus: '已生效',
    source: '人事异动',
    summary: '调整兼职任务计价规则',
    type: '薪资标准调整',
    updatedAt: '2026-05-30'
  },
  {
    afterValue: '全职 / 离职',
    beforeValue: '全职 / 试用期',
    effectiveAt: '2026-06-25',
    id: 'MOV-20260001-PENDING-LEAVE',
    memberId: '20260001',
    note: '试用期内协商解除，待生效前可作废',
    recordStatus: '待生效',
    source: '人事异动',
    summary: '待生效离职',
    type: '离职',
    updatedAt: '2026-06-10'
  }
];

export function createInitialPeopleMovementRows(members: PeopleMember[]): PeopleMovementRow[] {
  const memberById = new Map(members.map((member) => [member.id, member]));

  return initialPeopleMovementSeeds
    .map((seed) => {
      const member = memberById.get(seed.memberId);

      if (!member) {
        return undefined;
      }

      const beforeMemberSnapshot = seed.beforeSnapshot?.(member);
      const afterMemberSnapshot = seed.recordStatus === '已生效' ? createPeopleMovementSnapshot(member) : undefined;
      const files =
        seed.recordStatus === '待生效'
          ? getMovementRequiredFileSlots(member, seed.type).map((slot) =>
              createSampleMovementAttachment({
                member,
                recordId: seed.id,
                slot,
                updatedAt: seed.updatedAt
              })
            )
          : [];

      return createPeopleMovementRow({
        afterMemberSnapshot,
        afterValue: seed.afterValue,
        beforeMemberSnapshot,
        beforeValue: seed.beforeValue,
        effectiveAt: seed.effectiveAt,
        files,
        id: seed.id,
        member,
        note: seed.note,
        recordStatus: seed.recordStatus,
        recorder: seed.recorder,
        source: seed.source,
        summary: seed.summary,
        type: seed.type,
        updatedAt: seed.updatedAt
      });
    })
    .filter((row): row is PeopleMovementRow => Boolean(row))
    .sort((left, right) => right.effectiveAt.localeCompare(left.effectiveAt));
}

import type { PeopleMember, PersonnelType } from './peopleTypes';

export type PeopleExpiryType = '试用期到期' | '劳动合同到期' | '合作协议到期';

export type PeopleExpiryUrgency = '已逾期' | '7天内' | '30天内' | '90天内' | '远期';

export type PeopleExpiryStatus = '待处理' | '已逾期';

export type PeopleExpiryRow = {
  daysToDue: number;
  dueAt: string;
  id: string;
  member: PeopleMember;
  nextStep: string;
  owner: string;
  periodLabel: string;
  recommendedAction: string;
  relationType: PersonnelType;
  source: '人员档案';
  startAt: string;
  status: PeopleExpiryStatus;
  type: PeopleExpiryType;
  updatedAt: string;
  urgency: PeopleExpiryUrgency;
};

export type PeopleExpiryMetrics = {
  contractRelated: number;
  overdue: number;
  pending: number;
  total: number;
  within30Days: number;
};

type CreatePeopleExpiryRowsOptions = {
  today: string;
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;

const typeSortPriority: Record<PeopleExpiryType, number> = {
  试用期到期: 0,
  劳动合同到期: 1,
  合作协议到期: 2
};

const statusSortPriority: Record<PeopleExpiryStatus, number> = {
  已逾期: 0,
  待处理: 1
};

const urgencySortPriority: Record<PeopleExpiryUrgency, number> = {
  已逾期: 0,
  '7天内': 1,
  '30天内': 2,
  '90天内': 3,
  远期: 4
};

function toDateStartTime(dateText: string) {
  return new Date(`${dateText}T00:00:00`).getTime();
}

export function getPeopleExpiryDaysToDue(dueAt: string, today: string) {
  return Math.ceil((toDateStartTime(dueAt) - toDateStartTime(today)) / millisecondsPerDay);
}

export function getPeopleExpiryUrgency(daysToDue: number): PeopleExpiryUrgency {
  if (daysToDue < 0) {
    return '已逾期';
  }

  if (daysToDue <= 7) {
    return '7天内';
  }

  if (daysToDue <= 30) {
    return '30天内';
  }

  if (daysToDue <= 90) {
    return '90天内';
  }

  return '远期';
}

function getDefaultExpiryStatus(daysToDue: number): PeopleExpiryStatus {
  return daysToDue < 0 ? '已逾期' : '待处理';
}

function createRecordId(member: PeopleMember, type: PeopleExpiryType) {
  const suffix: Record<PeopleExpiryType, string> = {
    试用期到期: 'probation',
    劳动合同到期: 'labor-contract',
    合作协议到期: 'cooperation-contract'
  };

  return `EXP-${member.id}-${suffix[type]}`;
}

function createExpiryRow({
  dueAt,
  member,
  nextStep,
  periodLabel,
  recommendedAction,
  startAt,
  today,
  type
}: {
  dueAt: string;
  member: PeopleMember;
  nextStep: string;
  periodLabel: string;
  recommendedAction: string;
  startAt: string;
  today: string;
  type: PeopleExpiryType;
}): PeopleExpiryRow {
  const daysToDue = getPeopleExpiryDaysToDue(dueAt, today);
  const urgency = getPeopleExpiryUrgency(daysToDue);
  const defaultStatus = getDefaultExpiryStatus(daysToDue);

  return {
    daysToDue,
    dueAt,
    id: createRecordId(member, type),
    member,
    nextStep,
    owner: '行政人事',
    periodLabel,
    recommendedAction,
    relationType: member.personnelType,
    source: '人员档案',
    startAt,
    status: defaultStatus,
    type,
    updatedAt: member.archiveUpdatedAt,
    urgency
  };
}

function buildMemberExpiryRows(member: PeopleMember, today: string) {
  const rows: PeopleExpiryRow[] = [];

  if (member.personnelType === '全职' && member.status === '试用期' && member.probationEndAt) {
    const type: PeopleExpiryType = '试用期到期';
    rows.push(
      createExpiryRow({
        dueAt: member.probationEndAt,
        member,
        nextStep: '正常到期只做确认；提前转正、延期或不转正进入人事异动。',
        periodLabel: `${member.joinedAt} 至 ${member.probationEndAt}`,
        recommendedAction: '到期确认',
        startAt: member.joinedAt,
        today,
        type
      })
    );
  }

  if (member.personnelType === '全职' && member.status !== '离职' && member.contractEndAt) {
    const type: PeopleExpiryType = '劳动合同到期';
    rows.push(
      createExpiryRow({
        dueAt: member.contractEndAt,
        member,
        nextStep: '续签、终止或其他合同变化应进入人事异动，并保留合同文件。',
        periodLabel: `${member.contractStartAt} 至 ${member.contractEndAt}`,
        recommendedAction: '续签确认',
        startAt: member.contractStartAt,
        today,
        type
      })
    );
  }

  if (member.personnelType === '兼职' && member.status === '合作中') {
    const dueAt = member.cooperationEndAt ?? member.contractEndAt;

    if (dueAt) {
      const type: PeopleExpiryType = '合作协议到期';
      rows.push(
        createExpiryRow({
          dueAt,
          member,
          nextStep: '续签继续合作，或通过人事异动结束合作并关闭任务参与。',
          periodLabel: `${member.cooperationStartAt ?? member.contractStartAt} 至 ${dueAt}`,
          recommendedAction: '合作续签确认',
          startAt: member.cooperationStartAt ?? member.contractStartAt,
          today,
          type
        })
      );
    }
  }

  return rows;
}

export function createPeopleExpiryRows(members: PeopleMember[], { today }: CreatePeopleExpiryRowsOptions): PeopleExpiryRow[] {
  return members
    .flatMap((member) => buildMemberExpiryRows(member, today))
    .sort(
      (left, right) =>
        statusSortPriority[left.status] - statusSortPriority[right.status] ||
        urgencySortPriority[left.urgency] - urgencySortPriority[right.urgency] ||
        left.dueAt.localeCompare(right.dueAt) ||
        typeSortPriority[left.type] - typeSortPriority[right.type] ||
        left.member.id.localeCompare(right.member.id)
    );
}

export function getPeopleExpiryMetrics(rows: PeopleExpiryRow[]): PeopleExpiryMetrics {
  return {
    contractRelated: rows.filter((row) => row.type === '劳动合同到期' || row.type === '合作协议到期').length,
    overdue: rows.filter((row) => row.status === '已逾期').length,
    pending: rows.filter((row) => row.status === '待处理').length,
    total: rows.length,
    within30Days: rows.filter((row) => row.daysToDue >= 0 && row.daysToDue <= 30).length
  };
}

export function formatPeopleExpiryDays(row: Pick<PeopleExpiryRow, 'daysToDue'>) {
  if (row.daysToDue < 0) {
    return `已逾期 ${Math.abs(row.daysToDue)} 天`;
  }

  if (row.daysToDue === 0) {
    return '今天到期';
  }

  return `剩余 ${row.daysToDue} 天`;
}

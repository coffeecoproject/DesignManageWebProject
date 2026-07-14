import type { PeopleMember } from '../people/peopleTypes';
import type { StoreTaskRecord } from './TaskManagementState';

export type PartTimeLaborSettlementPerson = Pick<PeopleMember, 'id' | 'name' | 'personnelType' | 'taxIdentityProfile'>;

export type PartTimeLaborSettlementTask = Pick<
  StoreTaskRecord,
  'acceptedAt' | 'code' | 'executorId' | 'id' | 'name' | 'status'
>;

export type PartTimeLaborGrossAmountSource = {
  kind: '任务约定' | '验收确认';
  recordId: string;
  field: string;
};

export type PartTimeLaborAcceptanceRecord = {
  id: string;
  taskId: string;
  acceptedAt: string;
  grossAmount?: number;
  grossAmountSource?: PartTimeLaborGrossAmountSource;
  agreementVersion?: string;
  laborProjectId?: string;
};

export type PartTimeLaborSettlementSource = {
  id: string;
  acceptanceId: string;
  acceptedAt: string;
  agreementVersion: string;
  employeeName: string;
  employeeNo: string;
  grossAmount: number;
  grossAmountSource: PartTimeLaborGrossAmountSource;
  laborProjectId: string;
  settlementPeriod: string;
  taskId: string;
  taskName: string;
  taskNo: string;
};

export type PartTimeLaborSettlementBatch = {
  id: string;
  batchKey: string;
  employeeName: string;
  employeeNo: string;
  grossAmount: number;
  laborProjectId: string;
  settlementPeriod: string;
  sources: PartTimeLaborSettlementSource[];
  taxIdentityStatus: '居民个人';
};

export type PartTimeLaborSettlementBlockerCode =
  | 'INVALID_SETTLEMENT_PERIOD'
  | 'ACCEPTANCE_RECORD_MISSING'
  | 'ACCEPTANCE_RECORD_AMBIGUOUS'
  | 'ACCEPTANCE_TIME_MISSING'
  | 'ACCEPTANCE_PERIOD_MISMATCH'
  | 'EXECUTOR_ID_MISSING'
  | 'EXECUTOR_IDENTITY_MISSING'
  | 'EXECUTOR_IDENTITY_AMBIGUOUS'
  | 'EXECUTOR_IDENTITY_INCOMPLETE'
  | 'TAX_IDENTITY_UNCONFIRMED'
  | 'TAX_IDENTITY_UNSUPPORTED'
  | 'GROSS_AMOUNT_MISSING'
  | 'GROSS_AMOUNT_INVALID'
  | 'GROSS_AMOUNT_SOURCE_MISSING'
  | 'AGREEMENT_VERSION_MISSING'
  | 'LABOR_PROJECT_MISSING';

export type PartTimeLaborSettlementBlocker = {
  code: PartTimeLaborSettlementBlockerCode;
  employeeNo?: string;
  message: string;
  taskId?: string;
  taskNo?: string;
};

export type BuildPartTimeLaborSettlementBatchesInput = {
  acceptanceRecords: readonly PartTimeLaborAcceptanceRecord[];
  people: readonly PartTimeLaborSettlementPerson[];
  settlementPeriod: string;
  tasks: readonly PartTimeLaborSettlementTask[];
};

export type BuildPartTimeLaborSettlementBatchesResult = {
  batches: PartTimeLaborSettlementBatch[];
  blockers: PartTimeLaborSettlementBlocker[];
};

export type BuildPartTimeLaborAcceptanceResult =
  | { acceptanceRecord?: PartTimeLaborAcceptanceRecord; ready: true }
  | { message: string; ready: false };

const settlementPeriodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const moneyPrecisionTolerance = 1e-8;

function normalizeText(value: string | undefined) {
  return value?.trim() ?? '';
}

function getRecordPeriod(acceptedAt: string) {
  return acceptedAt.trim().slice(0, 7);
}

function hasMoneyPrecision(amount: number) {
  return Math.abs(amount * 100 - Math.round(amount * 100)) <= moneyPrecisionTolerance;
}

function toMoney(amountInCents: number) {
  return amountInCents / 100;
}

function createGroupedIndex<T>(rows: readonly T[], getKey: (row: T) => string) {
  const index = new Map<string, T[]>();

  for (const row of rows) {
    const key = getKey(row);
    const group = index.get(key) ?? [];
    group.push(row);
    index.set(key, group);
  }

  return index;
}

function createTaskBlocker(
  task: PartTimeLaborSettlementTask,
  code: PartTimeLaborSettlementBlockerCode,
  message: string,
  employeeNo?: string
): PartTimeLaborSettlementBlocker {
  return {
    code,
    employeeNo,
    message,
    taskId: task.id,
    taskNo: task.code
  };
}

export function createPartTimeLaborSettlementBatchKey(
  settlementPeriod: string,
  employeeNo: string,
  laborProjectId: string
) {
  return [
    'part-time-labor',
    encodeURIComponent(settlementPeriod.trim()),
    encodeURIComponent(employeeNo.trim()),
    encodeURIComponent(laborProjectId.trim())
  ].join(':');
}

export function buildPartTimeLaborAcceptanceRecord({
  person,
  task
}: {
  person?: PartTimeLaborSettlementPerson;
  task: StoreTaskRecord;
}): BuildPartTimeLaborAcceptanceResult {
  if (!task.executorId || !person || person.id !== task.executorId) {
    return { message: '任务执行人未关联有效人员档案', ready: false };
  }

  if (person.personnelType === '全职') {
    return { ready: true };
  }

  if (person.personnelType !== '兼职') {
    return { message: '任务执行人的人员类型不支持劳务结算', ready: false };
  }

  if (!person.taxIdentityProfile || person.taxIdentityProfile.status !== '已确认') {
    return { message: '兼职执行人的税务身份尚未确认', ready: false };
  }

  if (person.taxIdentityProfile.identityType !== '居民个人') {
    return { message: '当前仅支持居民个人劳务结算', ready: false };
  }

  if (!task.acceptedAt) {
    return { message: '任务缺少验收时间', ready: false };
  }

  const agreement = task.laborAgreement;
  if (!agreement?.projectId.trim() || !agreement.agreementVersion.trim()) {
    return { message: '兼职任务缺少劳务项目或协议版本', ready: false };
  }

  if (!Number.isFinite(agreement.agreedGrossAmount) || agreement.agreedGrossAmount <= 0 || !hasMoneyPrecision(agreement.agreedGrossAmount)) {
    return { message: '兼职任务税前约定金额无效', ready: false };
  }

  return {
    acceptanceRecord: {
      acceptedAt: task.acceptedAt,
      agreementVersion: agreement.agreementVersion.trim(),
      grossAmount: agreement.agreedGrossAmount,
      grossAmountSource: {
        field: 'agreedGrossAmount',
        kind: '任务约定',
        recordId: `${task.id}/labor-agreement`
      },
      id: `${task.id}/labor-acceptance`,
      laborProjectId: agreement.projectId.trim(),
      taskId: task.id
    },
    ready: true
  };
}

export function buildPartTimeLaborSettlementBatches(
  input: BuildPartTimeLaborSettlementBatchesInput
): BuildPartTimeLaborSettlementBatchesResult {
  const settlementPeriod = input.settlementPeriod.trim();

  if (!settlementPeriodPattern.test(settlementPeriod)) {
    return {
      batches: [],
      blockers: [
        {
          code: 'INVALID_SETTLEMENT_PERIOD',
          message: `结算周期 ${input.settlementPeriod || '(空)'} 不是 YYYY-MM 格式`
        }
      ]
    };
  }

  const acceptanceByTaskId = createGroupedIndex(input.acceptanceRecords, (record) => normalizeText(record.taskId));
  const peopleByEmployeeNo = createGroupedIndex(input.people, (person) => normalizeText(person.id));
  const blockers: PartTimeLaborSettlementBlocker[] = [];
  const sources: PartTimeLaborSettlementSource[] = [];

  for (const task of input.tasks) {
    if (task.status !== '已完成') {
      continue;
    }

    const taskAcceptedAt = normalizeText(task.acceptedAt);

    if (!taskAcceptedAt) {
      blockers.push(createTaskBlocker(task, 'ACCEPTANCE_TIME_MISSING', '已完成任务缺少验收时间'));
      continue;
    }

    if (getRecordPeriod(taskAcceptedAt) !== settlementPeriod) {
      continue;
    }

    const employeeNo = normalizeText(task.executorId);

    if (!employeeNo) {
      blockers.push(createTaskBlocker(task, 'EXECUTOR_ID_MISSING', '任务缺少可关联人员工号的执行人'));
      continue;
    }

    const matchedPeople = peopleByEmployeeNo.get(employeeNo) ?? [];

    if (matchedPeople.length === 0) {
      blockers.push(createTaskBlocker(task, 'EXECUTOR_IDENTITY_MISSING', '执行人员工号未匹配人员主数据', employeeNo));
      continue;
    }

    if (matchedPeople.length > 1) {
      blockers.push(createTaskBlocker(task, 'EXECUTOR_IDENTITY_AMBIGUOUS', '执行人员工号匹配到多条人员主数据', employeeNo));
      continue;
    }

    const person = matchedPeople[0];

    if (person.personnelType === '全职') {
      continue;
    }

    if (person.personnelType !== '兼职' || !normalizeText(person.name)) {
      blockers.push(createTaskBlocker(task, 'EXECUTOR_IDENTITY_INCOMPLETE', '执行人的兼职身份或姓名不完整', employeeNo));
      continue;
    }

    if (!person.taxIdentityProfile || person.taxIdentityProfile.status !== '已确认') {
      blockers.push(createTaskBlocker(task, 'TAX_IDENTITY_UNCONFIRMED', '兼职人员税务身份待确认，不能生成可结算批次', employeeNo));
      continue;
    }

    if (person.taxIdentityProfile.identityType !== '居民个人') {
      blockers.push(createTaskBlocker(task, 'TAX_IDENTITY_UNSUPPORTED', '当前领域仅支持居民个人普通劳务候选', employeeNo));
      continue;
    }

    const acceptanceRows = acceptanceByTaskId.get(task.id) ?? [];

    if (acceptanceRows.length === 0) {
      blockers.push(createTaskBlocker(task, 'ACCEPTANCE_RECORD_MISSING', '结算周期内已完成兼职任务缺少验收金额记录'));
      continue;
    }

    if (acceptanceRows.length > 1) {
      blockers.push(createTaskBlocker(task, 'ACCEPTANCE_RECORD_AMBIGUOUS', '任务存在多条验收金额记录，无法确定结算来源'));
      continue;
    }

    const acceptance = acceptanceRows[0];
    const acceptedAt = normalizeText(acceptance.acceptedAt);

    if (!acceptedAt) {
      blockers.push(createTaskBlocker(task, 'ACCEPTANCE_TIME_MISSING', '验收金额记录缺少验收时间'));
      continue;
    }

    if (getRecordPeriod(acceptedAt) !== settlementPeriod) {
      blockers.push(createTaskBlocker(task, 'ACCEPTANCE_PERIOD_MISMATCH', '任务与验收金额记录不属于同一结算周期'));
      continue;
    }

    if (acceptance.grossAmount === undefined || acceptance.grossAmount === null) {
      blockers.push(createTaskBlocker(task, 'GROSS_AMOUNT_MISSING', '验收记录缺少明确的税前金额', employeeNo));
      continue;
    }

    if (!Number.isFinite(acceptance.grossAmount) || acceptance.grossAmount <= 0 || !hasMoneyPrecision(acceptance.grossAmount)) {
      blockers.push(createTaskBlocker(task, 'GROSS_AMOUNT_INVALID', '税前金额必须为大于零且最多两位小数的有限数值', employeeNo));
      continue;
    }

    const amountSource = acceptance.grossAmountSource;

    if (!amountSource || !normalizeText(amountSource.recordId) || !normalizeText(amountSource.field)) {
      blockers.push(createTaskBlocker(task, 'GROSS_AMOUNT_SOURCE_MISSING', '验收税前金额缺少结构化来源', employeeNo));
      continue;
    }

    const agreementVersion = normalizeText(acceptance.agreementVersion);

    if (!agreementVersion) {
      blockers.push(createTaskBlocker(task, 'AGREEMENT_VERSION_MISSING', '验收税前金额缺少协议版本', employeeNo));
      continue;
    }

    const laborProjectId = normalizeText(acceptance.laborProjectId);

    if (!laborProjectId) {
      blockers.push(createTaskBlocker(task, 'LABOR_PROJECT_MISSING', '验收记录缺少劳务项目标识', employeeNo));
      continue;
    }

    sources.push({
      acceptanceId: acceptance.id,
      acceptedAt,
      agreementVersion,
      employeeName: person.name.trim(),
      employeeNo,
      grossAmount: acceptance.grossAmount,
      grossAmountSource: {
        field: amountSource.field.trim(),
        kind: amountSource.kind,
        recordId: amountSource.recordId.trim()
      },
      id: `part-time-labor-source:${encodeURIComponent(acceptance.id)}:${encodeURIComponent(task.id)}`,
      laborProjectId,
      settlementPeriod,
      taskId: task.id,
      taskName: task.name,
      taskNo: task.code
    });
  }

  sources.sort((left, right) => left.taskNo.localeCompare(right.taskNo) || left.taskId.localeCompare(right.taskId));

  const sourcesByBatchKey = createGroupedIndex(sources, (source) =>
    createPartTimeLaborSettlementBatchKey(
      source.settlementPeriod,
      source.employeeNo,
      source.laborProjectId
    )
  );
  const batches = Array.from(sourcesByBatchKey.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([batchKey, batchSources]): PartTimeLaborSettlementBatch => ({
      batchKey,
      employeeName: batchSources[0].employeeName,
      employeeNo: batchSources[0].employeeNo,
      grossAmount: toMoney(batchSources.reduce((total, source) => total + Math.round(source.grossAmount * 100), 0)),
      id: batchKey,
      laborProjectId: batchSources[0].laborProjectId,
      settlementPeriod,
      sources: batchSources,
      taxIdentityStatus: '居民个人'
    }));

  return { batches, blockers };
}

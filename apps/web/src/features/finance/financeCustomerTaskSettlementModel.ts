import type {
  BrandRecord,
  CustomerRecord,
  StoreRecord
} from '../customers/customerData';
import type {
  CustomerTaskBillingFact,
  CustomerTaskSettlementBatch
} from '../tasks/taskCustomerBillingModel';
import { getFinanceCategorySnapshot } from './financeData';
import type {
  FinanceCustomerTaskSettlementSnapshot,
  FinanceReceivablePayableRecord
} from './financeReceivablesPayablesData';
import { getReceivablePayableConfirmedAmount } from './financeReceivablesPayablesData';
import { getDefaultReceivablePayableTaxBasis } from './financeTaxBasisModel';

export type CustomerTaskSettlementMergeIssue = {
  batchId: string;
  differenceAmount: number;
  issueId: string;
  kind: '来源主数据缺失' | '来源快照缺失' | '来源更正待财务调整' | '来源撤销待财务更正' | '批次差异';
  message: string;
  recordId?: string;
  taskIds: string[];
};

export type CustomerTaskReversalReconciliationResult = {
  issues: CustomerTaskSettlementMergeIssue[];
  records: FinanceReceivablePayableRecord[];
};

export type CustomerTaskAcceptanceCorrectionReconciliationResult = CustomerTaskReversalReconciliationResult;

export type CustomerTaskSettlementCorrectionAction = '调整发票关联' | '处理发票更正' | '查看关联流水' | '处理会计凭证';

export function getCustomerTaskSettlementCorrectionActions({
  hasBookedVoucher,
  hasLinkedInvoice,
  hasLinkedTransaction,
  periodLocked
}: {
  hasBookedVoucher: boolean;
  hasLinkedInvoice: boolean;
  hasLinkedTransaction: boolean;
  periodLocked: boolean;
}): CustomerTaskSettlementCorrectionAction[] {
  const actions: CustomerTaskSettlementCorrectionAction[] = [];

  if (hasLinkedInvoice) {
    actions.push(hasBookedVoucher || periodLocked ? '处理发票更正' : '调整发票关联');
  }

  if (hasLinkedTransaction) {
    actions.push('查看关联流水');
  }

  if (hasBookedVoucher || periodLocked) {
    actions.push('处理会计凭证');
  }

  return actions;
}

export function getCustomerTaskSettlementIssueId({
  batchId,
  differenceAmount,
  kind,
  recordId,
  taskIds
}: Pick<CustomerTaskSettlementMergeIssue, 'batchId' | 'differenceAmount' | 'kind' | 'recordId' | 'taskIds'>) {
  return `task-settlement-issue-${createStableSuffix([
    kind,
    batchId,
    recordId ?? 'missing',
    differenceAmount.toFixed(2),
    [...taskIds].sort().join(',')
  ].join('|'))}`;
}

function createCustomerTaskSettlementIssue(
  issue: Omit<CustomerTaskSettlementMergeIssue, 'issueId'>
): CustomerTaskSettlementMergeIssue {
  return {
    ...issue,
    issueId: getCustomerTaskSettlementIssueId(issue)
  };
}

function createStableSuffix(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return String(hash % 10000).padStart(4, '0');
}

function buildTaskSettlementEvidenceFiles(lineItems: CustomerTaskSettlementBatch['lineItems']) {
  const filesById = new Map(
    lineItems.flatMap((line) => line.acceptanceEvidence).map((file) => [file.id, file])
  );

  return Array.from(filesById.values()).map((file) => ({ ...file }));
}

function buildTaskSettlementSnapshot({
  batch,
  brand,
  customer,
  lineItems,
  stores
}: {
  batch: CustomerTaskSettlementBatch;
  brand: BrandRecord;
  customer: CustomerRecord;
  lineItems: CustomerTaskSettlementBatch['lineItems'];
  stores: readonly StoreRecord[];
}): FinanceCustomerTaskSettlementSnapshot {
  const storeNameById = new Map(stores.map((store) => [store.id, store.name]));

  return {
    batchId: batch.id,
    brandId: brand.id,
    brandName: batch.brandName,
    contractCode: batch.contractCode,
    contractId: batch.contractId,
    contractName: batch.contractName,
    customerId: customer.id,
    customerName: batch.customerName,
    lineItems: lineItems.map((line) => ({
      ...line,
      storeName: storeNameById.get(line.storeId) ?? line.storeId
    })),
    recordKind: '原始结算',
    settlementMode: batch.settlementMode,
    settlementPeriod: batch.settlementPeriod
  };
}

export function buildCustomerTaskReceivablePayableRecord({
  batch,
  brand,
  customer,
  accountingPeriod = batch.settlementPeriod,
  confirmDate,
  lineItems = batch.lineItems,
  stores
}: {
  batch: CustomerTaskSettlementBatch;
  brand: BrandRecord;
  customer: CustomerRecord;
  accountingPeriod?: string;
  confirmDate?: string;
  lineItems?: CustomerTaskSettlementBatch['lineItems'];
  stores: readonly StoreRecord[];
}): FinanceReceivablePayableRecord {
  const latestCustomerAcceptedOn = lineItems.map((line) => line.customerAcceptedOn).sort().at(-1)
    ?? `${batch.settlementPeriod}-01`;
  const latestCustomerAcceptanceUpdatedAt = lineItems.map((line) => line.customerAcceptanceUpdatedAt).sort().at(-1)
    ?? `${latestCustomerAcceptedOn} 09:00`;
  const effectiveConfirmDate = confirmDate ?? latestCustomerAcceptedOn;
  const compactPeriod = accountingPeriod.replace('-', '');
  const sourceNo = batch.id;
  const documentNo = `AR-${compactPeriod}-T${createStableSuffix(sourceNo)}`;
  const amount = Number(lineItems.reduce((sum, line) => sum + line.amount, 0).toFixed(2));
  const category = '设计服务收入';
  const categorySnapshot = getFinanceCategorySnapshot(category);
  const taskSettlement = buildTaskSettlementSnapshot({ batch, brand, customer, lineItems, stores });
  const taxBasis = getDefaultReceivablePayableTaxBasis({
    amount,
    direction: '应收',
    sourceType: '任务结算'
  });
  const sourceTitleBase = batch.settlementMode === '按月汇总'
    ? `${batch.brandName} ${batch.settlementPeriod} 任务结算`
    : `${batch.brandName} ${batch.lineItems[0]?.taskName ?? '任务结算'}`;
  const sourceTitle = sourceTitleBase;

  return {
    accountingPeriod,
    amount,
    category,
    categorySnapshot,
    confirmDate: effectiveConfirmDate,
    confirmationStatus: '已确认',
    contractId: batch.contractId,
    counterparty: batch.customerName,
    counterpartyId: customer.id,
    counterpartyType: '客户',
    direction: '应收',
    documentNo,
    dueDate: batch.dueDate,
    files: buildTaskSettlementEvidenceFiles(lineItems),
    id: `ar-${sourceNo}`,
    linkedTransactionNos: [],
    note: batch.settlementMode === '按月汇总'
        ? `按甲方验收月份汇总 ${lineItems.length} 条任务。`
        : '根据甲方验收结果确认任务收入。',
    operationRecords: [
      {
        action: '生成应收',
        actor: '系统',
        id: `op-ar-${sourceNo}`,
        object: documentNo,
        summary: `根据 ${lineItems.length} 条甲方验收记录生成应收`,
        time: latestCustomerAcceptanceUpdatedAt
      }
    ],
    owner: '李明',
    reportAggregation: categorySnapshot.reportAggregation,
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo,
    sourceTitle,
    sourceType: '任务结算',
    taskSettlement,
    taxBasis,
    updatedAt: latestCustomerAcceptanceUpdatedAt
  };
}

function getTaskSettlementLineSignature(line: {
  amount: number;
  customerAcceptanceCorrectionReason?: string;
  customerAcceptanceRemark: string;
  customerAcceptedOn: string;
  customerScore: number;
  deductionRate: number;
  deductionAmount: number;
  qualityPenaltyPoints: number;
  standardAmount: number;
  taskId: string;
  timelinessPenaltyPoints: number;
  timelinessResult: string;
  totalPenaltyPoints: number;
}) {
  return [
    line.taskId,
    line.customerAcceptedOn,
    line.standardAmount.toFixed(2),
    line.deductionRate.toFixed(4),
    line.deductionAmount.toFixed(2),
    line.amount.toFixed(2),
    String(line.customerScore),
    String(line.qualityPenaltyPoints),
    String(line.timelinessPenaltyPoints),
    String(line.totalPenaltyPoints),
    line.timelinessResult,
    line.customerAcceptanceCorrectionReason ?? '',
    line.customerAcceptanceRemark
  ].join('|');
}

function hasTaskSettlementChanged(
  record: FinanceReceivablePayableRecord,
  batch: CustomerTaskSettlementBatch
) {
  const previousLines = record.taskSettlement?.lineItems ?? [];
  const nextLines = batch.lineItems;
  return record.taskSettlement?.batchId !== batch.id
    || record.accountingPeriod !== batch.settlementPeriod
    || record.dueDate !== batch.dueDate
    || previousLines.length !== nextLines.length
    || previousLines.map(getTaskSettlementLineSignature).sort().join('::')
      !== nextLines.map(getTaskSettlementLineSignature).sort().join('::');
}

function rebuildDirectlyCorrectableTaskSettlement({
  batch,
  brand,
  customer,
  previousRecords,
  stores
}: {
  batch: CustomerTaskSettlementBatch;
  brand: BrandRecord;
  customer: CustomerRecord;
  previousRecords: FinanceReceivablePayableRecord[];
  stores: readonly StoreRecord[];
}) {
  const rebuilt = buildCustomerTaskReceivablePayableRecord({ batch, brand, customer, stores });
  const latestCorrectedLine = [...batch.lineItems]
    .sort((left, right) => right.customerAcceptanceUpdatedAt.localeCompare(left.customerAcceptanceUpdatedAt))[0];
  const correctedAt = latestCorrectedLine?.customerAcceptanceUpdatedAt ?? rebuilt.updatedAt;
  const correctionReason = latestCorrectedLine?.customerAcceptanceCorrectionReason?.trim();
  const primaryRecord = previousRecords[0]!;
  return {
    ...rebuilt,
    documentNo: primaryRecord.documentNo,
    id: primaryRecord.id,
    linkedTransactionNos: Array.from(new Set(previousRecords.flatMap((record) => record.linkedTransactionNos))),
    operationRecords: [
      {
        action: '重算任务应收',
        actor: latestCorrectedLine?.customerAcceptanceUpdatedBy ?? '系统',
        id: `op-task-settlement-rebuild-${primaryRecord.id}-${correctedAt}`,
        object: primaryRecord.documentNo,
        summary: correctionReason
          ? `甲方验收结果更正：${correctionReason}；按最新业务日期、扣款和结算政策重算应收`
          : '甲方验收结果更正，按最新业务日期、扣款和结算政策重算应收',
        time: correctedAt
      },
      ...previousRecords.flatMap((record) => record.operationRecords)
    ],
    sourceNo: primaryRecord.sourceNo
  };
}

export function mergeCustomerTaskReceivablePayableRecords({
  batches,
  brands,
  customers,
  canDirectCorrect,
  records,
  stores
}: {
  batches: readonly CustomerTaskSettlementBatch[];
  brands: readonly BrandRecord[];
  customers: readonly CustomerRecord[];
  canDirectCorrect: (record: FinanceReceivablePayableRecord) => boolean;
  records: FinanceReceivablePayableRecord[];
  stores: readonly StoreRecord[];
}): FinanceReceivablePayableRecord[] {
  let nextRecords = [...records];

  for (const batch of batches) {
    const brand = brands.find((row) => row.id === batch.brandId);
    const customer = customers.find((row) => row.id === batch.customerId);

    if (!brand || !customer) {
      continue;
    }

    const batchTaskIds = new Set(batch.lineItems.map((line) => line.taskId));
    const batchRecords = nextRecords.filter(
      (record) =>
        record.sourceType === '任务结算' &&
        record.confirmationStatus !== '已作废' &&
        (
          record.taskSettlement?.batchId === batch.id
          || record.sourceNo === batch.id
          || record.taskSettlement?.lineItems.some((line) => batchTaskIds.has(line.taskId))
        )
    );

    if (batchRecords.length === 0) {
      nextRecords.push(buildCustomerTaskReceivablePayableRecord({ batch, brand, customer, stores }));
      continue;
    }

    const changedRecord = batchRecords.find((record) => hasTaskSettlementChanged(record, batch));
    if (changedRecord) {
      if (!batchRecords.every(canDirectCorrect)) {
        continue;
      }

      const replacedRecordIds = new Set(batchRecords.map((record) => record.id));
      nextRecords = [
        ...nextRecords.filter((record) => !replacedRecordIds.has(record.id)),
        rebuildDirectlyCorrectableTaskSettlement({ batch, brand, customer, previousRecords: batchRecords, stores })
      ];
      continue;
    }

    continue;
  }

  return nextRecords;
}

export function reconcileCustomerTaskReversals({
  canDirectCorrect,
  facts,
  records
}: {
  canDirectCorrect: (record: FinanceReceivablePayableRecord) => boolean;
  facts: readonly CustomerTaskBillingFact[];
  records: FinanceReceivablePayableRecord[];
}): CustomerTaskReversalReconciliationResult {
  const reversedFactsByTaskId = new Map(
    facts.filter((fact) => fact.status === '已冲销').map((fact) => [fact.taskId, fact])
  );
  const issues: CustomerTaskSettlementMergeIssue[] = [];

  const nextRecords = records.map((record) => {
    if (
      record.sourceType !== '任务结算'
      || record.confirmationStatus === '已作废'
      || !record.taskSettlement
    ) {
      return record;
    }

    const reversedLines = record.taskSettlement.lineItems.filter((line) => reversedFactsByTaskId.has(line.taskId));
    if (reversedLines.length === 0) {
      return record;
    }

    const reversalFacts = reversedLines
      .map((line) => reversedFactsByTaskId.get(line.taskId))
      .filter((fact): fact is CustomerTaskBillingFact => Boolean(fact));
    const latestReversal = [...reversalFacts].sort((left, right) =>
      (right.reversedAt ?? '').localeCompare(left.reversedAt ?? '')
    )[0];

    if (!canDirectCorrect(record)) {
      issues.push(createCustomerTaskSettlementIssue({
        batchId: record.taskSettlement.batchId,
        differenceAmount: -reversedLines.reduce((sum, line) => sum + line.amount, 0),
        kind: '来源撤销待财务更正',
        message: `${record.documentNo} 对应任务验收已撤销，已有财务后续，需通过冲销或后续调整更正`,
        recordId: record.id,
        taskIds: reversedLines.map((line) => line.taskId)
      }));
      return record;
    }

    const activeLines = record.taskSettlement.lineItems.filter((line) => !reversedFactsByTaskId.has(line.taskId));
    const occurredAt = latestReversal?.reversedAt ?? record.updatedAt;
    const reason = latestReversal?.reversalReason ?? '任务验收已撤销';
    const operation = {
      action: activeLines.length > 0 ? '调整任务应收' : '作废任务应收',
      actor: latestReversal?.reversedBy ?? '系统',
      id: `op-task-reversal-${record.id}-${occurredAt}`,
      object: record.documentNo,
      summary: `${reversedLines.map((line) => line.taskCode).join('、')} 验收撤销：${reason}`,
      time: occurredAt
    };

    if (activeLines.length === 0) {
      return {
        ...record,
        confirmationStatus: '已作废' as const,
        note: [record.note, `验收撤销：${reason}`].filter(Boolean).join('；'),
        operationRecords: [operation, ...record.operationRecords],
        updatedAt: occurredAt
      };
    }

    const filesById = new Map(
      activeLines.flatMap((line) => line.acceptanceEvidence).map((file) => [file.id, file])
    );

    return {
      ...record,
      amount: Number(activeLines.reduce((sum, line) => sum + line.amount, 0).toFixed(2)),
      files: Array.from(filesById.values()).map((file) => ({ ...file })),
      note: [record.note, `已移除撤销验收任务：${reversedLines.map((line) => line.taskCode).join('、')}`]
        .filter(Boolean)
        .join('；'),
      operationRecords: [operation, ...record.operationRecords],
      taskSettlement: {
        ...record.taskSettlement,
        lineItems: activeLines
      },
      updatedAt: occurredAt
    };
  });

  return { issues, records: nextRecords };
}

export function reconcileZeroNetCustomerTaskAcceptanceCorrections({
  canDirectCorrect,
  facts,
  records
}: {
  canDirectCorrect: (record: FinanceReceivablePayableRecord) => boolean;
  facts: readonly CustomerTaskBillingFact[];
  records: FinanceReceivablePayableRecord[];
}): CustomerTaskAcceptanceCorrectionReconciliationResult {
  const zeroNetFactsByTaskId = new Map(
    facts
      .filter((fact) => fact.status === '有效' && fact.billingSnapshot.billable && fact.amount === 0)
      .map((fact) => [fact.taskId, fact])
  );
  const issues: CustomerTaskSettlementMergeIssue[] = [];

  const nextRecords = records.map((record) => {
    if (
      record.sourceType !== '任务结算'
      || record.confirmationStatus === '已作废'
      || !record.taskSettlement
    ) {
      return record;
    }

    const zeroNetLines = record.taskSettlement.lineItems.filter((line) => zeroNetFactsByTaskId.has(line.taskId));
    if (zeroNetLines.length === 0) {
      return record;
    }

    if (!canDirectCorrect(record)) {
      issues.push(createCustomerTaskSettlementIssue({
        batchId: record.taskSettlement.batchId,
        differenceAmount: -zeroNetLines.reduce((sum, line) => sum + line.amount, 0),
        kind: '来源更正待财务调整',
        message: `${record.documentNo} 对应甲方验收净额已更正为 0，原应收已有财务后续，需通过冲销或后续调整处理`,
        recordId: record.id,
        taskIds: zeroNetLines.map((line) => line.taskId)
      }));
      return record;
    }

    const activeLines = record.taskSettlement.lineItems.filter((line) => !zeroNetFactsByTaskId.has(line.taskId));
    const latestFact = zeroNetLines
      .map((line) => zeroNetFactsByTaskId.get(line.taskId))
      .filter((fact): fact is CustomerTaskBillingFact => Boolean(fact))
      .sort((left, right) => (right.customerAcceptanceUpdatedAt ?? '').localeCompare(left.customerAcceptanceUpdatedAt ?? ''))[0];
    const occurredAt = latestFact?.customerAcceptanceUpdatedAt ?? record.updatedAt;
    const actor = latestFact?.customerAcceptanceUpdatedBy ?? '系统';
    const operation = {
      action: activeLines.length > 0 ? '重算任务应收' : '作废任务应收',
      actor,
      id: `op-task-zero-net-${record.id}-${occurredAt}`,
      object: record.documentNo,
      summary: `${zeroNetLines.map((line) => line.taskCode).join('、')} 甲方验收净额更正为 0`,
      time: occurredAt
    };

    if (activeLines.length === 0) {
      return {
        ...record,
        confirmationStatus: '已作废' as const,
        note: [record.note, '甲方验收扣款后净额为 0'].filter(Boolean).join('；'),
        operationRecords: [operation, ...record.operationRecords],
        updatedAt: occurredAt
      };
    }

    const filesById = new Map(
      activeLines.flatMap((line) => line.acceptanceEvidence).map((file) => [file.id, file])
    );
    return {
      ...record,
      amount: Number(activeLines.reduce((sum, line) => sum + line.amount, 0).toFixed(2)),
      files: Array.from(filesById.values()).map((file) => ({ ...file })),
      operationRecords: [operation, ...record.operationRecords],
      taskSettlement: { ...record.taskSettlement, lineItems: activeLines },
      updatedAt: occurredAt
    };
  });

  return { issues, records: nextRecords };
}

export function getCustomerTaskSettlementMergeIssues({
  batches,
  brands,
  customers,
  canDirectCorrect,
  records
}: {
  batches: readonly CustomerTaskSettlementBatch[];
  brands: readonly BrandRecord[];
  customers: readonly CustomerRecord[];
  canDirectCorrect: (record: FinanceReceivablePayableRecord) => boolean;
  records: readonly FinanceReceivablePayableRecord[];
}): CustomerTaskSettlementMergeIssue[] {
  return batches.flatMap<CustomerTaskSettlementMergeIssue>((batch) => {
    const batchTaskIds = new Set(batch.lineItems.map((line) => line.taskId));
    const existingRecords = records.filter(
      (record) =>
        record.sourceType === '任务结算' &&
        record.confirmationStatus !== '已作废' &&
        (
          record.taskSettlement?.batchId === batch.id
          || record.sourceNo === batch.id
          || record.taskSettlement?.lineItems.some((line) => batchTaskIds.has(line.taskId))
        )
    );
    const existingRecord = existingRecords[0];

    if (!existingRecord) {
      const missingDimensions = [
        brands.some((row) => row.id === batch.brandId) ? undefined : '品牌档案',
        customers.some((row) => row.id === batch.customerId) ? undefined : '客户档案'
      ].filter((label): label is string => Boolean(label));

      if (missingDimensions.length === 0) {
        return [];
      }

      return [createCustomerTaskSettlementIssue({
        batchId: batch.id,
        differenceAmount: batch.amount,
        kind: '来源主数据缺失' as const,
        message: `${batch.settlementPeriod} 任务结算缺少${missingDimensions.join('、')}，尚未生成应收`,
        taskIds: batch.lineItems.map((line) => line.taskId)
      })];
    }

    if (!existingRecord.taskSettlement) {
      return [createCustomerTaskSettlementIssue({
        batchId: batch.id,
        differenceAmount: batch.amount,
        kind: '来源快照缺失' as const,
        message: `${existingRecord.documentNo} 缺少任务结算来源快照`,
        recordId: existingRecord.id,
        taskIds: batch.lineItems.map((line) => line.taskId)
      })];
    }

    if (existingRecords.some((record) => hasTaskSettlementChanged(record, batch))) {
      if (existingRecords.every(canDirectCorrect)) {
        return [];
      }
      return [createCustomerTaskSettlementIssue({
        batchId: batch.id,
        differenceAmount: Number((batch.amount - existingRecords.reduce(
          (sum, record) => sum + getReceivablePayableConfirmedAmount(record),
          0
        )).toFixed(2)),
        kind: '来源更正待财务调整' as const,
        message: `${existingRecord.documentNo} 对应甲方验收已更正，原应收已有财务后续，需通过冲销或后续调整处理`,
        recordId: existingRecord.id,
        taskIds: batch.lineItems.map((line) => line.taskId)
      })];
    }

    const existingTaskIds = new Set(
      existingRecords.flatMap((record) => record.taskSettlement?.lineItems.map((line) => line.taskId) ?? [])
    );
    const lateTaskIds = batch.lineItems
      .map((line) => line.taskId)
      .filter((taskId) => !existingTaskIds.has(taskId));
    const coveredAmount = existingRecords.reduce(
      (sum, record) => sum + getReceivablePayableConfirmedAmount(record),
      0
    );
    const differenceAmount = Number((batch.amount - coveredAmount).toFixed(2));

    if (differenceAmount === 0 && lateTaskIds.length === 0) {
      return [];
    }

    return [createCustomerTaskSettlementIssue({
      batchId: batch.id,
      differenceAmount,
      kind: '批次差异' as const,
      message: `${batch.settlementPeriod} 任务汇总在应收生成后发生变化，原应收保持不变`,
      recordId: existingRecord.id,
      taskIds: lateTaskIds
    })];
  });
}

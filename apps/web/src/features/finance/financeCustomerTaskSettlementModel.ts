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
import { getDefaultReceivablePayableTaxBasis } from './financeTaxBasisModel';

export type CustomerTaskSettlementMergeIssue = {
  batchId: string;
  differenceAmount: number;
  kind: '来源主数据缺失' | '来源快照缺失' | '来源撤销待财务更正' | '批次差异';
  message: string;
  recordId?: string;
  taskIds: string[];
};

export type CustomerTaskReversalReconciliationResult = {
  issues: CustomerTaskSettlementMergeIssue[];
  records: FinanceReceivablePayableRecord[];
};

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
  recordKind,
  stores
}: {
  batch: CustomerTaskSettlementBatch;
  brand: BrandRecord;
  customer: CustomerRecord;
  lineItems: CustomerTaskSettlementBatch['lineItems'];
  recordKind: FinanceCustomerTaskSettlementSnapshot['recordKind'];
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
    recordKind,
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
  recordKind = '原始结算',
  stores
}: {
  batch: CustomerTaskSettlementBatch;
  brand: BrandRecord;
  customer: CustomerRecord;
  accountingPeriod?: string;
  confirmDate?: string;
  lineItems?: CustomerTaskSettlementBatch['lineItems'];
  recordKind?: FinanceCustomerTaskSettlementSnapshot['recordKind'];
  stores: readonly StoreRecord[];
}): FinanceReceivablePayableRecord {
  const latestAcceptedAt = lineItems.map((line) => line.acceptedAt).sort().at(-1)
    ?? `${batch.settlementPeriod}-01 09:00`;
  const effectiveConfirmDate = confirmDate ?? latestAcceptedAt.slice(0, 10);
  const compactPeriod = accountingPeriod.replace('-', '');
  const lineIdentity = lineItems.map((line) => line.taskId).sort().join(':');
  const sourceNo = recordKind === '原始结算'
    ? batch.id
    : `${batch.id}:adjustment:${createStableSuffix(lineIdentity)}`;
  const documentNo = `AR-${compactPeriod}-T${createStableSuffix(sourceNo)}`;
  const amount = Number(lineItems.reduce((sum, line) => sum + line.amount, 0).toFixed(2));
  const category = '设计服务收入';
  const categorySnapshot = getFinanceCategorySnapshot(category);
  const taskSettlement = buildTaskSettlementSnapshot({ batch, brand, customer, lineItems, recordKind, stores });
  const taxBasis = getDefaultReceivablePayableTaxBasis({
    amount,
    direction: '应收',
    sourceType: '任务结算'
  });
  const sourceTitleBase = batch.settlementMode === '按月汇总'
    ? `${batch.brandName} ${batch.settlementPeriod} 任务结算`
    : `${batch.brandName} ${batch.lineItems[0]?.taskName ?? '任务结算'}`;
  const sourceTitle = recordKind === '后续调整' ? `${sourceTitleBase}后续调整` : sourceTitleBase;

  return {
    accountingPeriod,
    amount,
    category,
    categorySnapshot,
    confirmDate: effectiveConfirmDate,
    confirmationStatus: '已确认',
    counterparty: batch.customerName,
    counterpartyId: customer.id,
    counterpartyType: '客户',
    direction: '应收',
    documentNo,
    dueDate: batch.dueDate,
    files: buildTaskSettlementEvidenceFiles(lineItems),
    id: `ar-${sourceNo}`,
    linkedTransactionNos: [],
    note: recordKind === '后续调整'
      ? `原月度应收已生成，本记录承接后来确认的 ${lineItems.length} 条任务。`
      : batch.settlementMode === '按月汇总'
        ? `按自然月汇总 ${lineItems.length} 条已验收任务。`
        : '根据内部验收结果自动确认任务收入。',
    operationRecords: [
      {
        action: '生成应收',
        actor: '系统',
        id: `op-ar-${sourceNo}`,
        object: documentNo,
        summary: recordKind === '后续调整'
          ? `根据 ${lineItems.length} 条迟到验收任务生成后续调整应收`
          : `根据 ${lineItems.length} 条已验收任务生成应收`,
        time: recordKind === '后续调整' ? `${effectiveConfirmDate} 09:00` : latestAcceptedAt
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
    updatedAt: recordKind === '后续调整' ? `${effectiveConfirmDate} 09:00` : latestAcceptedAt
  };
}

export function mergeCustomerTaskReceivablePayableRecords({
  batches,
  brands,
  customers,
  records,
  stores
}: {
  batches: readonly CustomerTaskSettlementBatch[];
  brands: readonly BrandRecord[];
  customers: readonly CustomerRecord[];
  records: FinanceReceivablePayableRecord[];
  stores: readonly StoreRecord[];
}): FinanceReceivablePayableRecord[] {
  const generatedRecords = batches.flatMap((batch) => {
    const brand = brands.find((row) => row.id === batch.brandId);
    const customer = customers.find((row) => row.id === batch.customerId);

    if (!brand || !customer) {
      return [];
    }

    const batchRecords = records.filter(
      (record) =>
        record.sourceType === '任务结算' &&
        (record.taskSettlement?.batchId === batch.id || record.sourceNo === batch.id)
    );

    if (batchRecords.length === 0) {
      return [buildCustomerTaskReceivablePayableRecord({ batch, brand, customer, stores })];
    }

    const coveredTaskIds = new Set(
      batchRecords.flatMap((record) => record.taskSettlement?.lineItems.map((line) => line.taskId) ?? [])
    );
    const lateLineItems = batch.lineItems.filter((line) => !coveredTaskIds.has(line.taskId));

    if (lateLineItems.length === 0) {
      return [];
    }

    return [
      buildCustomerTaskReceivablePayableRecord({
        accountingPeriod: batch.generatedAt.slice(0, 7),
        batch,
        brand,
        confirmDate: batch.generatedAt.slice(0, 10),
        customer,
        lineItems: lateLineItems,
        recordKind: '后续调整',
        stores
      })
    ];
  });

  return generatedRecords.length > 0 ? [...records, ...generatedRecords] : records;
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
      issues.push({
        batchId: record.taskSettlement.batchId,
        differenceAmount: -reversedLines.reduce((sum, line) => sum + line.amount, 0),
        kind: '来源撤销待财务更正',
        message: `${record.documentNo} 对应任务验收已撤销，已有财务后续，需通过冲销或后续调整更正`,
        recordId: record.id,
        taskIds: reversedLines.map((line) => line.taskId)
      });
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

export function getCustomerTaskSettlementMergeIssues({
  batches,
  brands,
  customers,
  records
}: {
  batches: readonly CustomerTaskSettlementBatch[];
  brands: readonly BrandRecord[];
  customers: readonly CustomerRecord[];
  records: readonly FinanceReceivablePayableRecord[];
}): CustomerTaskSettlementMergeIssue[] {
  return batches.flatMap<CustomerTaskSettlementMergeIssue>((batch) => {
    const existingRecords = records.filter(
      (record) =>
        record.sourceType === '任务结算' &&
        (record.taskSettlement?.batchId === batch.id || record.sourceNo === batch.id)
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

      return [{
        batchId: batch.id,
        differenceAmount: batch.amount,
        kind: '来源主数据缺失' as const,
        message: `${batch.settlementPeriod} 任务结算缺少${missingDimensions.join('、')}，尚未生成应收`,
        taskIds: batch.lineItems.map((line) => line.taskId)
      }];
    }

    if (!existingRecord.taskSettlement) {
      return [{
        batchId: batch.id,
        differenceAmount: batch.amount,
        kind: '来源快照缺失' as const,
        message: `${existingRecord.documentNo} 缺少任务结算来源快照`,
        recordId: existingRecord.id,
        taskIds: batch.lineItems.map((line) => line.taskId)
      }];
    }

    const existingTaskIds = new Set(
      existingRecords.flatMap((record) => record.taskSettlement?.lineItems.map((line) => line.taskId) ?? [])
    );
    const lateTaskIds = batch.lineItems
      .map((line) => line.taskId)
      .filter((taskId) => !existingTaskIds.has(taskId));
    const coveredAmount = existingRecords.reduce((sum, record) => sum + record.amount, 0);
    const differenceAmount = Number((batch.amount - coveredAmount).toFixed(2));

    if (differenceAmount === 0 && lateTaskIds.length === 0) {
      return [];
    }

    return [{
      batchId: batch.id,
      differenceAmount,
      kind: '批次差异' as const,
      message: `${batch.settlementPeriod} 任务汇总在应收生成后发生变化，原应收保持不变`,
      recordId: existingRecord.id,
      taskIds: lateTaskIds
    }];
  });
}

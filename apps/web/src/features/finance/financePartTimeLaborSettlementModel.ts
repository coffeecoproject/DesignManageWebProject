import type { PeopleMember } from '../people/peopleTypes';
import type { PartTimeLaborSettlementBatch } from '../tasks/partTimeLaborSettlementModel';
import { getFinanceCategorySnapshot } from './financeData';
import { buildResidentLaborPaymentSnapshot } from './financeNaturalPersonPaymentModel';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import { getDefaultReceivablePayableTaxBasis } from './financeTaxBasisModel';

function addCalendarDays(dateText: string, days: number) {
  const date = new Date(`${dateText.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function createStableSuffix(value: string) {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return String(hash % 10000).padStart(4, '0');
}

export function buildPartTimeLaborReceivablePayableRecord(
  batch: PartTimeLaborSettlementBatch,
  person: Pick<PeopleMember, 'id' | 'identityNo'>
): FinanceReceivablePayableRecord {
  const latestAcceptedAt = batch.sources.map((source) => source.acceptedAt).sort().at(-1) ?? `${batch.settlementPeriod}-01 09:00`;
  const confirmDate = latestAcceptedAt.slice(0, 10);
  const compactPeriod = batch.settlementPeriod.replace('-', '');
  const documentNo = `AP-${compactPeriod}-L${createStableSuffix(batch.batchKey)}`;
  const category = '外协付款' as const;
  const categorySnapshot = getFinanceCategorySnapshot(category);
  const naturalPersonPayment = buildResidentLaborPaymentSnapshot({
    grossIncomeAmount: batch.grossAmount,
    identityNo: person.identityNo,
    paymentFactId: `labor:${batch.batchKey}`,
    personId: batch.employeeNo,
    personName: batch.employeeName,
    sourceBatchNo: batch.id,
    sourceRecordNos: batch.sources.map((source) => source.taskNo),
    taxPeriod: batch.settlementPeriod
  });
  const taxBasis = getDefaultReceivablePayableTaxBasis({
    amount: batch.grossAmount,
    direction: '应付',
    sourceType: '外协结算'
  });

  return {
    accountingPeriod: batch.settlementPeriod,
    amount: batch.grossAmount,
    category,
    categorySnapshot,
    confirmDate,
    confirmationStatus: '已确认',
    counterparty: batch.employeeName,
    counterpartyId: batch.employeeNo,
    counterpartyType: '外协',
    direction: '应付',
    documentNo,
    dueDate: addCalendarDays(confirmDate, 7),
    files: batch.sources.map((source) => ({
      id: `${source.acceptanceId}/record`,
      name: `${source.taskNo} 任务验收记录`,
      status: '已归档',
      type: '验收记录',
      updatedAt: source.acceptedAt.slice(0, 10)
    })),
    id: `ap-labor:${batch.batchKey}`,
    linkedTransactionNos: [],
    naturalPersonPayment,
    note: `税前劳务 ${batch.grossAmount.toFixed(2)} 元，付款时按实际支付月份确定扣缴期间。`,
    operationRecords: [
      {
        action: '生成应付',
        actor: '系统',
        id: `op-ap-labor:${batch.batchKey}`,
        object: documentNo,
        summary: `根据 ${batch.sources.length} 条已验收兼职任务生成劳务应付`,
        time: latestAcceptedAt
      }
    ],
    owner: '李明',
    reportAggregation: categorySnapshot.reportAggregation,
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: batch.id,
    sourceTitle: `${batch.employeeName} ${batch.laborProjectId} 劳务结算`,
    sourceType: '外协结算',
    taxBasis,
    updatedAt: latestAcceptedAt
  };
}

export function mergePartTimeLaborReceivablePayableRecords({
  batches,
  people,
  records
}: {
  batches: readonly PartTimeLaborSettlementBatch[];
  people: readonly PeopleMember[];
  records: FinanceReceivablePayableRecord[];
}): FinanceReceivablePayableRecord[] {
  const existingPaymentFactIds = new Set(
    records
      .map((record) => record.naturalPersonPayment?.paymentFactId)
      .filter((paymentFactId): paymentFactId is string => Boolean(paymentFactId))
  );
  const generatedRecords = batches.flatMap((batch) => {
    const paymentFactId = `labor:${batch.batchKey}`;
    if (existingPaymentFactIds.has(paymentFactId)) {
      return [];
    }

    const person = people.find((member) => member.id === batch.employeeNo);
    return person ? [buildPartTimeLaborReceivablePayableRecord(batch, person)] : [];
  });

  return generatedRecords.length > 0 ? [...records, ...generatedRecords] : records;
}

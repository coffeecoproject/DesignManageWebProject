import type {
  FinanceInvoiceAllocationMatchBasis,
  FinanceInvoiceAllocationTargetType,
  FinanceInvoiceBusinessAllocation,
  FinanceInvoiceDirection,
  FinanceInvoiceRecord
} from './financeInvoiceData';
import { isFinanceInvoiceAllocationEffective } from './financeInvoiceModel';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import { isFinanceReceivablePayableConfirmed } from './financeReceivablesPayablesModel';
import { getFinanceAccrualTaxPolicy } from './financeTaxPolicyModel';

export type FinanceInvoiceAssociationMatchBasis = FinanceInvoiceAllocationMatchBasis;

export type FinanceInvoiceBusinessAssociationCandidate = {
  allocatedAmount: number;
  availableAmount: number;
  businessRecord: FinanceReceivablePayableRecord;
  id: string;
  matchBasis: FinanceInvoiceAssociationMatchBasis;
};


export type FinanceBusinessInvoiceAssociationCandidate = {
  availableAmount: number;
  id: string;
  invoice: FinanceInvoiceRecord;
  matchBasis: FinanceInvoiceAssociationMatchBasis;
  matchedAmount: number;
};

export type FinanceInvoiceAssociationDraft = {
  amount: number;
  matchBasis: FinanceInvoiceAssociationMatchBasis;
  targetId: string;
  targetNo: string;
  targetTitle: string;
  targetType: FinanceInvoiceAllocationTargetType;
};

export type FinanceBusinessInvoiceAssociationDraft = {
  amount: number;
  invoiceId: string;
  matchBasis: FinanceInvoiceAssociationMatchBasis;
};

type AllocationBuildContext = {
  actor: string;
  occurredAt: string;
  sequence: number;
};

const moneyTolerance = 0.01;

function roundMoney(amount: number) {
  return Number(amount.toFixed(2));
}

function normalizeBusinessText(value: string) {
  return value.trim().toLowerCase();
}

function isSameMoneyAmount(left: number, right: number) {
  return Math.abs(left - right) < moneyTolerance;
}

type AssociationSemanticRow = {
  amount: number;
  key: string;
};

function normalizeAssociationSemanticRows(rows: AssociationSemanticRow[]) {
  const amountByKey = new Map<string, number>();

  rows.forEach((row) => {
    amountByKey.set(row.key, roundMoney((amountByKey.get(row.key) ?? 0) + row.amount));
  });

  return Array.from(amountByKey.entries())
    .filter(([, amount]) => Math.abs(amount) > moneyTolerance)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
}

function haveAssociationSemanticRowsChanged(currentRows: AssociationSemanticRow[], initialRows: AssociationSemanticRow[]) {
  const current = normalizeAssociationSemanticRows(currentRows);
  const initial = normalizeAssociationSemanticRows(initialRows);

  if (current.length !== initial.length) {
    return true;
  }

  return current.some(([key, amount], index) => {
    const initialRow = initial[index];

    return !initialRow || initialRow[0] !== key || !isSameMoneyAmount(amount, initialRow[1]);
  });
}

function getActiveInvoiceAllocations(
  invoice: FinanceInvoiceRecord | undefined,
  allocations: FinanceInvoiceBusinessAllocation[]
) {
  if (!invoice || invoice.invoiceStatus !== '正常') {
    return [];
  }

  return allocations.filter(
    (allocation) => allocation.invoiceId === invoice.id && isFinanceInvoiceAllocationEffective(allocation)
  );
}

function getActiveNormalAllocations(
  allocations: FinanceInvoiceBusinessAllocation[],
  invoiceRows: FinanceInvoiceRecord[]
) {
  const normalInvoiceIds = new Set(invoiceRows.filter((invoice) => invoice.invoiceStatus === '正常').map((invoice) => invoice.id));

  return allocations.filter(
    (allocation) => normalInvoiceIds.has(allocation.invoiceId) && isFinanceInvoiceAllocationEffective(allocation)
  );
}

export function isFinanceReceivablePayableInvoiceAssociationRequired(record: FinanceReceivablePayableRecord) {
  const taxPolicy = getFinanceAccrualTaxPolicy({
    direction: record.direction,
    sourceType: record.sourceType
  });

  return (
    isFinanceReceivablePayableConfirmed(record) &&
    record.taxBasis.basisSource !== '不涉及发票' &&
    taxPolicy.invoiceEvidenceRequired
  );
}

export function getFinanceReceivablePayableInvoiceDirection(record: FinanceReceivablePayableRecord): FinanceInvoiceDirection {
  return record.direction === '应收' ? '销项' : '进项';
}

export function doesInvoiceAllocationMatchReceivablePayable(
  allocation: FinanceInvoiceBusinessAllocation,
  record: FinanceReceivablePayableRecord
) {
  return allocation.targetType === '应收应付' && allocation.targetId === record.id;
}

export function getInvoiceAssociationMatchBasis(
  invoice: FinanceInvoiceRecord,
  record: FinanceReceivablePayableRecord,
  allocations: FinanceInvoiceBusinessAllocation[] = []
): FinanceInvoiceAssociationMatchBasis | undefined {
  if (!isFinanceReceivablePayableInvoiceAssociationRequired(record) || invoice.invoiceStatus !== '正常') {
    return undefined;
  }

  if (invoice.direction !== getFinanceReceivablePayableInvoiceDirection(record)) {
    return undefined;
  }

  const existingAllocation = getActiveInvoiceAllocations(invoice, allocations).find((allocation) =>
    doesInvoiceAllocationMatchReceivablePayable(allocation, record)
  );

  if (existingAllocation) {
    return existingAllocation.matchBasis;
  }

  if (invoice.businessReferenceNo && (invoice.businessReferenceNo === record.documentNo || invoice.businessReferenceNo === record.sourceNo)) {
    return record.sourceType === '员工报销' ? '报销票据' : '来源单据';
  }

  if (normalizeBusinessText(invoice.counterparty) === normalizeBusinessText(record.counterparty)) {
    return '名称一致';
  }

  return undefined;
}

export function getInvoiceBusinessAssociationAllocatedAmount(
  record: FinanceReceivablePayableRecord,
  invoices: FinanceInvoiceRecord[],
  allocations: FinanceInvoiceBusinessAllocation[],
  options?: { excludeInvoiceId?: string }
) {
  return getActiveNormalAllocations(allocations, invoices).reduce(
    (total, allocation) =>
      allocation.invoiceId !== options?.excludeInvoiceId && doesInvoiceAllocationMatchReceivablePayable(allocation, record)
        ? total + Math.max(0, allocation.taxIncludedAmount)
        : total,
    0
  );
}

export function buildInvoiceBusinessAssociationCandidates(
  invoice: FinanceInvoiceRecord,
  invoices: FinanceInvoiceRecord[],
  allocations: FinanceInvoiceBusinessAllocation[],
  receivablePayableRows: FinanceReceivablePayableRecord[]
): FinanceInvoiceBusinessAssociationCandidate[] {
  return receivablePayableRows
    .flatMap((record) => {
      const matchBasis = getInvoiceAssociationMatchBasis(invoice, record, allocations);

      if (!matchBasis) {
        return [];
      }

      const allocatedAmount = getInvoiceBusinessAssociationAllocatedAmount(record, invoices, allocations, {
        excludeInvoiceId: invoice.id
      });
      const availableAmount = roundMoney(Math.max(0, record.amount - allocatedAmount));

      if (availableAmount <= moneyTolerance && matchBasis !== '已有关联') {
        return [];
      }

      return [{
        allocatedAmount,
        availableAmount,
        businessRecord: record,
        id: `invoice-business-${invoice.id}-${record.id}`,
        matchBasis
      } satisfies FinanceInvoiceBusinessAssociationCandidate];
    })
    .sort((left, right) => {
      const rank: Record<FinanceInvoiceAssociationMatchBasis, number> = {
        已有关联: 0,
        来源单据: 1,
        报销票据: 2,
        名称一致: 3,
        红冲原票: 4
      };

      return rank[left.matchBasis] - rank[right.matchBasis] || right.businessRecord.confirmDate.localeCompare(left.businessRecord.confirmDate);
    });
}

export function buildBusinessInvoiceAssociationCandidates(
  record: FinanceReceivablePayableRecord,
  invoices: FinanceInvoiceRecord[],
  allocations: FinanceInvoiceBusinessAllocation[]
): FinanceBusinessInvoiceAssociationCandidate[] {
  return invoices
    .flatMap((invoice) => {
      const matchBasis = getInvoiceAssociationMatchBasis(invoice, record, allocations);

      if (!matchBasis) {
        return [];
      }

      const matchedAmount = getActiveInvoiceAllocations(invoice, allocations)
        .reduce((total, allocation) => total + Math.max(0, allocation.taxIncludedAmount), 0);
      const matchedToCurrentRecord = getActiveInvoiceAllocations(invoice, allocations)
        .filter((allocation) => doesInvoiceAllocationMatchReceivablePayable(allocation, record))
        .reduce((total, allocation) => total + Math.max(0, allocation.taxIncludedAmount), 0);
      const availableAmount = roundMoney(Math.max(0, invoice.taxIncludedAmount - (matchedAmount - matchedToCurrentRecord)));

      if (availableAmount <= moneyTolerance && matchedToCurrentRecord <= moneyTolerance) {
        return [];
      }

      return [{
        availableAmount,
        id: `business-invoice-${record.id}-${invoice.id}`,
        invoice,
        matchBasis,
        matchedAmount
      } satisfies FinanceBusinessInvoiceAssociationCandidate];
    })
    .sort((left, right) => left.invoice.invoiceDate.localeCompare(right.invoice.invoiceDate));
}

function buildTaxAllocationParts(invoice: FinanceInvoiceRecord, amounts: number[]) {
  const totalGrossAmount = Math.abs(invoice.taxIncludedAmount);
  const totalTaxAmount = Math.abs(invoice.taxAmount);
  const totalNetAmount = Math.abs(invoice.taxExcludedAmount);
  let allocatedTaxAmount = 0;
  let allocatedNetAmount = 0;

  return amounts.map((amount, index) => {
    const grossAmount = roundMoney(Math.abs(amount));
    const isFullAllocation = isSameMoneyAmount(amounts.reduce((total, currentAmount) => total + Math.abs(currentAmount), 0), totalGrossAmount);
    const isLastAllocation = index === amounts.length - 1;
    const taxAmount = isFullAllocation && isLastAllocation
      ? roundMoney(totalTaxAmount - allocatedTaxAmount)
      : roundMoney(totalGrossAmount > moneyTolerance ? grossAmount * totalTaxAmount / totalGrossAmount : 0);
    const netAmount = isFullAllocation && isLastAllocation
      ? roundMoney(totalNetAmount - allocatedNetAmount)
      : roundMoney(grossAmount - taxAmount);

    allocatedTaxAmount = roundMoney(allocatedTaxAmount + taxAmount);
    allocatedNetAmount = roundMoney(allocatedNetAmount + netAmount);

    return { taxAmount, taxExcludedAmount: netAmount, taxIncludedAmount: grossAmount };
  });
}

export function buildInvoiceBusinessAllocations(
  invoice: FinanceInvoiceRecord,
  drafts: FinanceInvoiceAssociationDraft[],
  context: AllocationBuildContext
) {
  const normalizedDrafts = drafts
    .map((draft) => ({ ...draft, amount: roundMoney(draft.amount) }))
    .filter((draft) => Number.isFinite(draft.amount) && draft.amount > moneyTolerance);
  const taxParts = buildTaxAllocationParts(invoice, normalizedDrafts.map((draft) => draft.amount));

  return normalizedDrafts.map((draft, index) => ({
    createdAt: context.occurredAt,
    createdBy: context.actor,
    id: `invoice-allocation-${invoice.id}-${draft.targetType}-${draft.targetId}-${context.sequence}-${index + 1}`,
    invoiceId: invoice.id,
    matchBasis: draft.matchBasis,
    status: '有效' as const,
    targetId: draft.targetId,
    targetNo: draft.targetNo,
    targetTitle: draft.targetTitle,
    targetType: draft.targetType,
    ...taxParts[index]
  } satisfies FinanceInvoiceBusinessAllocation));
}

export function buildRedInvoiceBusinessAllocations(
  redInvoice: FinanceInvoiceRecord,
  originalInvoice: FinanceInvoiceRecord,
  allocations: FinanceInvoiceBusinessAllocation[],
  context: AllocationBuildContext
) {
  const originalAllocations = getActiveInvoiceAllocations(originalInvoice, allocations)
    .filter((allocation) => allocation.taxIncludedAmount > moneyTolerance);
  const redAmount = Math.abs(redInvoice.taxIncludedAmount);
  const originalAmount = Math.abs(originalInvoice.taxIncludedAmount);
  const allocatableAmount = originalAllocations.reduce((total, allocation) => total + allocation.taxIncludedAmount, 0);

  if (redInvoice.invoiceStatus !== '红冲' || originalAmount <= moneyTolerance || allocatableAmount + moneyTolerance < redAmount) {
    return [];
  }

  const grossAmounts = originalAllocations.map((allocation, index) => {
    if (index === originalAllocations.length - 1) {
      const used = originalAllocations.slice(0, index).reduce(
        (total, current) => total + roundMoney(current.taxIncludedAmount * redAmount / originalAmount),
        0
      );

      return roundMoney(redAmount - used);
    }

    return roundMoney(allocation.taxIncludedAmount * redAmount / originalAmount);
  });
  const taxParts = buildTaxAllocationParts(
    {
      ...redInvoice,
      taxAmount: Math.abs(redInvoice.taxAmount),
      taxExcludedAmount: Math.abs(redInvoice.taxExcludedAmount),
      taxIncludedAmount: redAmount
    },
    grossAmounts
  );

  return originalAllocations.map((allocation, index) => ({
    createdAt: context.occurredAt,
    createdBy: context.actor,
    id: `invoice-red-allocation-${redInvoice.id}-${context.sequence}-${allocation.id}`,
    invoiceId: redInvoice.id,
    matchBasis: '红冲原票' as const,
    sourceAllocationId: allocation.id,
    status: '有效' as const,
    targetId: allocation.targetId,
    targetNo: allocation.targetNo,
    targetTitle: allocation.targetTitle,
    targetType: allocation.targetType,
    taxAmount: -taxParts[index].taxAmount,
    taxExcludedAmount: -taxParts[index].taxExcludedAmount,
    taxIncludedAmount: -taxParts[index].taxIncludedAmount
  } satisfies FinanceInvoiceBusinessAllocation));
}

export function buildInvoiceBusinessAssociationDrafts(
  candidates: FinanceInvoiceBusinessAssociationCandidate[],
  amountsByCandidateId: Record<string, number>
): FinanceInvoiceAssociationDraft[] {
  return candidates.flatMap((candidate) => {
    const amount = roundMoney(amountsByCandidateId[candidate.id] ?? 0);

    if (amount <= moneyTolerance) {
      return [];
    }

    return [{
      amount,
      matchBasis: candidate.matchBasis,
      targetId: candidate.businessRecord.id,
      targetNo: candidate.businessRecord.documentNo,
      targetTitle: candidate.businessRecord.sourceTitle,
      targetType: '应收应付'
    } satisfies FinanceInvoiceAssociationDraft];
  });
}

export function haveInvoiceAssociationDraftsChanged(
  invoiceId: string,
  drafts: FinanceInvoiceAssociationDraft[],
  allocations: FinanceInvoiceBusinessAllocation[]
) {
  const currentRows = drafts.map((draft) => ({
    amount: draft.amount,
    key: `${draft.targetType}:${draft.targetId}:${draft.matchBasis}`
  }));
  const initialRows = allocations
    .filter((allocation) => allocation.invoiceId === invoiceId && isFinanceInvoiceAllocationEffective(allocation))
    .map((allocation) => ({
      amount: Math.max(0, allocation.taxIncludedAmount),
      key: `${allocation.targetType}:${allocation.targetId}:${allocation.matchBasis}`
    }));

  return haveAssociationSemanticRowsChanged(currentRows, initialRows);
}

export function haveBusinessInvoiceAssociationDraftsChanged(
  businessRecordId: string,
  drafts: FinanceBusinessInvoiceAssociationDraft[],
  allocations: FinanceInvoiceBusinessAllocation[]
) {
  const currentRows = drafts.map((draft) => ({
    amount: draft.amount,
    key: `${draft.invoiceId}:${draft.matchBasis}`
  }));
  const initialRows = allocations
    .filter((allocation) => (
      allocation.targetType === '应收应付' &&
      allocation.targetId === businessRecordId &&
      isFinanceInvoiceAllocationEffective(allocation)
    ))
    .map((allocation) => ({
      amount: Math.max(0, allocation.taxIncludedAmount),
      key: `${allocation.invoiceId}:${allocation.matchBasis}`
    }));

  return haveAssociationSemanticRowsChanged(currentRows, initialRows);
}

export function getInvoiceMatchedReceivablePayableTargets(
  invoice: FinanceInvoiceRecord | undefined,
  allocations: FinanceInvoiceBusinessAllocation[],
  records: FinanceReceivablePayableRecord[]
) {
  if (!invoice) {
    return [];
  }

  const targetIds = new Set(
    getActiveInvoiceAllocations(invoice, allocations)
      .filter((allocation) => allocation.targetType === '应收应付')
      .map((allocation) => allocation.targetId)
  );

  return records.filter((record) => targetIds.has(record.id));
}

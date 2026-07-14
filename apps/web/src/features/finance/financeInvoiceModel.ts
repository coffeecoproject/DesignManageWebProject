import type { FinanceTransactionRecord } from './financeData';
import type {
  FinanceInvoiceBusinessAllocation,
  FinanceInvoiceMatchStatus,
  FinanceInvoiceRecord
} from './financeInvoiceData';

export type FinanceTransactionInvoiceAssociationStatus = '无需关联' | '未关联' | '部分关联' | '已关联';
export type FinanceRedInvoiceOriginalAssociationStatus = '待关联原票' | '已关联原票';

export type FinanceTransactionMatchedInvoice = {
  amount: number;
  counterparty: string;
  direction: FinanceInvoiceRecord['direction'];
  id: string;
  invoiceDate: string;
  invoiceNo: string;
  invoiceStatus: FinanceInvoiceRecord['invoiceStatus'];
  totalAmount: number;
};

export type FinanceTransactionInvoiceAssociation = {
  matchedAmount: number;
  matchedInvoices: FinanceTransactionMatchedInvoice[];
  remainingAmount: number;
  requiredAmount: number;
  status: FinanceTransactionInvoiceAssociationStatus;
};

export type FinanceOriginalInvoiceRedSummary = {
  alreadyRedAmount: number;
  availableRedAmount: number;
  currentRedAmount: number;
  isOverLimit: boolean;
  originalInvoiceAmount: number;
  remainingAfterCurrentAmount: number;
};

const moneyTolerance = 0.01;

export function isInvoiceEffective(record: FinanceInvoiceRecord) {
  return record.invoiceStatus !== '作废';
}

export function getInvoiceAmount(record: FinanceInvoiceRecord) {
  return isInvoiceEffective(record) ? record.taxIncludedAmount : 0;
}

export function getInvoiceTaxExcludedAmount(record: FinanceInvoiceRecord) {
  return isInvoiceEffective(record) ? record.taxExcludedAmount : 0;
}

export function getInvoiceTaxAmount(record: FinanceInvoiceRecord) {
  return isInvoiceEffective(record) ? record.taxAmount : 0;
}

export function isSameMoneyAmount(left: number, right: number) {
  return Math.abs(left - right) < moneyTolerance;
}

export function isFinanceInvoiceAllocationEffective(allocation: FinanceInvoiceBusinessAllocation) {
  return allocation.status === '有效';
}

export function getInvoiceAllocations(
  invoice: Pick<FinanceInvoiceRecord, 'id' | 'invoiceStatus'>,
  allocations: FinanceInvoiceBusinessAllocation[]
) {
  if (invoice.invoiceStatus === '作废') {
    return [];
  }

  return allocations.filter(
    (allocation) => allocation.invoiceId === invoice.id && isFinanceInvoiceAllocationEffective(allocation)
  );
}

export function getInvoiceMatchedAmount(record: FinanceInvoiceRecord, allocations: FinanceInvoiceBusinessAllocation[]) {
  if (record.invoiceStatus !== '正常') {
    return 0;
  }

  return getInvoiceAllocations(record, allocations)
    .reduce((total, allocation) => total + Math.max(0, allocation.taxIncludedAmount), 0);
}

export function getInvoiceMatchedBusinessNos(record: FinanceInvoiceRecord, allocations: FinanceInvoiceBusinessAllocation[]) {
  return Array.from(new Set(getInvoiceAllocations(record, allocations).map((allocation) => allocation.targetNo)));
}

export function getInvoiceMatchStatus(
  record: FinanceInvoiceRecord,
  allocations: FinanceInvoiceBusinessAllocation[] = []
): FinanceInvoiceMatchStatus {
  if (record.invoiceStatus === '作废') {
    return '已作废';
  }

  const matchedAmount = getInvoiceMatchedAmount(record, allocations);

  if (isSameMoneyAmount(matchedAmount, Math.abs(record.taxIncludedAmount))) {
    return '已匹配';
  }

  if (isSameMoneyAmount(matchedAmount, 0)) {
    return '未匹配';
  }

  return '部分匹配';
}

export function getRedInvoiceOriginalAssociationStatus(record: FinanceInvoiceRecord): FinanceRedInvoiceOriginalAssociationStatus {
  return record.invoiceStatus === '红冲' && record.originalInvoiceId ? '已关联原票' : '待关联原票';
}

export function getRedInvoiceAmount(record: FinanceInvoiceRecord) {
  return record.invoiceStatus === '红冲' && isInvoiceEffective(record) ? Math.abs(record.taxIncludedAmount) : 0;
}

export function getOriginalInvoiceRedAmount(
  originalInvoiceId: string,
  invoices: FinanceInvoiceRecord[],
  options?: { excludeRedInvoiceId?: string }
) {
  return invoices.reduce((total, invoice) => {
    if (
      invoice.id === options?.excludeRedInvoiceId ||
      invoice.invoiceStatus !== '红冲' ||
      invoice.originalInvoiceId !== originalInvoiceId ||
      !isInvoiceEffective(invoice)
    ) {
      return total;
    }

    return total + getRedInvoiceAmount(invoice);
  }, 0);
}

export function buildOriginalInvoiceRedSummary(
  originalInvoice: FinanceInvoiceRecord,
  invoices: FinanceInvoiceRecord[],
  currentRedInvoice?: FinanceInvoiceRecord
): FinanceOriginalInvoiceRedSummary {
  const originalInvoiceAmount = Math.abs(originalInvoice.taxIncludedAmount);
  const alreadyRedAmount = getOriginalInvoiceRedAmount(originalInvoice.id, invoices, {
    excludeRedInvoiceId: currentRedInvoice?.id
  });
  const currentRedAmount = currentRedInvoice ? getRedInvoiceAmount(currentRedInvoice) : 0;
  const availableRedAmount = Math.max(0, originalInvoiceAmount - alreadyRedAmount);
  const remainingAfterCurrentAmount = Number((availableRedAmount - currentRedAmount).toFixed(2));

  return {
    alreadyRedAmount,
    availableRedAmount,
    currentRedAmount,
    isOverLimit: remainingAfterCurrentAmount < -moneyTolerance,
    originalInvoiceAmount,
    remainingAfterCurrentAmount: Math.max(0, remainingAfterCurrentAmount)
  };
}

export function getOriginalInvoiceForRedInvoice(redInvoice: FinanceInvoiceRecord, invoices: FinanceInvoiceRecord[]) {
  return redInvoice.originalInvoiceId ? invoices.find((invoice) => invoice.id === redInvoice.originalInvoiceId) : undefined;
}

export function getRedInvoiceOriginalAssociationAffectedInvoices(
  currentInvoice: FinanceInvoiceRecord,
  nextInvoice: FinanceInvoiceRecord,
  invoices: FinanceInvoiceRecord[]
) {
  if (currentInvoice.invoiceStatus !== '红冲' && nextInvoice.invoiceStatus !== '红冲') {
    return [];
  }

  const originalInvoiceIds = new Set(
    [currentInvoice.originalInvoiceId, nextInvoice.originalInvoiceId].filter((invoiceId): invoiceId is string => Boolean(invoiceId))
  );

  if (!originalInvoiceIds.size) {
    return [];
  }

  return invoices.filter((invoice) => originalInvoiceIds.has(invoice.id));
}

export function isTransactionInvoiceAssociationRequired(record: FinanceTransactionRecord) {
  if (record.status === '已作废' || record.direction === '内部转入') {
    return false;
  }

  if (record.direction === '收入') {
    return record.counterpartyType === '客户';
  }

  if (record.direction === '支出') {
    return record.counterpartyType === '供应商' || record.counterpartyType === '外协';
  }

  return false;
}

export function doesInvoiceAllocationMatchTransaction(
  record: FinanceTransactionRecord,
  allocation: FinanceInvoiceBusinessAllocation
) {
  return allocation.targetType === '未开票收入' && allocation.targetId === record.id;
}

export function buildTransactionInvoiceAssociation(
  record: FinanceTransactionRecord,
  invoices: FinanceInvoiceRecord[],
  allocations: FinanceInvoiceBusinessAllocation[] = []
): FinanceTransactionInvoiceAssociation {
  const requiredAmount = isTransactionInvoiceAssociationRequired(record) ? record.amount : 0;
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const matchedAllocations = allocations.filter((allocation) => {
    const invoice = invoiceById.get(allocation.invoiceId);

    return Boolean(invoice && invoice.invoiceStatus === '正常' && isFinanceInvoiceAllocationEffective(allocation)) &&
      doesInvoiceAllocationMatchTransaction(record, allocation);
  });
  const matchedInvoices = matchedAllocations.flatMap((allocation) => {
    const invoice = invoiceById.get(allocation.invoiceId);

    return invoice ? [{
      amount: allocation.taxIncludedAmount,
      counterparty: invoice.counterparty,
      direction: invoice.direction,
      id: `${invoice.id}-${allocation.id}`,
      invoiceDate: invoice.invoiceDate,
      invoiceNo: invoice.invoiceNo,
      invoiceStatus: invoice.invoiceStatus,
      totalAmount: invoice.taxIncludedAmount
    }] : [];
  });

  if (!requiredAmount) {
    return {
      matchedAmount: 0,
      matchedInvoices,
      remainingAmount: 0,
      requiredAmount,
      status: '无需关联'
    };
  }

  const matchedAmount = matchedAllocations.reduce(
    (total, allocation) => total + Math.max(0, allocation.taxIncludedAmount),
    0
  );
  const remainingAmount = Math.max(0, requiredAmount - matchedAmount);

  if (isSameMoneyAmount(matchedAmount, 0)) {
    return { matchedAmount, matchedInvoices, remainingAmount, requiredAmount, status: '未关联' };
  }

  if (matchedAmount >= requiredAmount || isSameMoneyAmount(matchedAmount, requiredAmount)) {
    return { matchedAmount, matchedInvoices, remainingAmount: 0, requiredAmount, status: '已关联' };
  }

  return { matchedAmount, matchedInvoices, remainingAmount, requiredAmount, status: '部分关联' };
}

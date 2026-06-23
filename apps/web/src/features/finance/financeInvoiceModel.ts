import type { FinanceTransactionRecord } from './financeData';
import type { FinanceInvoiceDirection, FinanceInvoiceMatchStatus, FinanceInvoiceRecord } from './financeInvoiceData';

export type FinanceTransactionInvoiceAssociationStatus = '无需关联' | '未关联' | '部分关联' | '已关联';
export type FinanceRedInvoiceOriginalAssociationStatus = '待关联原票' | '已关联原票';

export type FinanceTransactionMatchedInvoice = {
  amount: number;
  counterparty: string;
  direction: FinanceInvoiceDirection;
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
  return Math.abs(left - right) < 0.01;
}

export function getInvoiceMatchedAmount(record: FinanceInvoiceRecord) {
  return record.matchedTransactions.reduce((total, match) => total + match.amount, 0);
}

export function getInvoiceMatchedTransactionNos(record: FinanceInvoiceRecord) {
  return Array.from(new Set(record.matchedTransactions.map((match) => match.transactionNo)));
}

export function getInvoiceMatchStatus(record: FinanceInvoiceRecord): FinanceInvoiceMatchStatus {
  const matchedAmount = getInvoiceMatchedAmount(record);

  if (isSameMoneyAmount(matchedAmount, record.taxIncludedAmount)) {
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
  return record.invoiceStatus === '红冲' && isInvoiceEffective(record) ? Math.abs(record.totalAmount) : 0;
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
  const originalInvoiceAmount = Math.abs(originalInvoice.totalAmount);
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
    isOverLimit: remainingAfterCurrentAmount < -0.01,
    originalInvoiceAmount,
    remainingAfterCurrentAmount: Math.max(0, remainingAfterCurrentAmount)
  };
}

export function getOriginalInvoiceForRedInvoice(redInvoice: FinanceInvoiceRecord, invoices: FinanceInvoiceRecord[]) {
  return redInvoice.originalInvoiceId ? invoices.find((invoice) => invoice.id === redInvoice.originalInvoiceId) : undefined;
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

function getMatchedTransactionContribution(invoice: FinanceInvoiceRecord, amount: number) {
  if (invoice.invoiceStatus === '红冲') {
    return 0;
  }

  return Math.max(0, amount);
}

export function buildTransactionInvoiceAssociation(
  record: FinanceTransactionRecord,
  invoices: FinanceInvoiceRecord[]
): FinanceTransactionInvoiceAssociation {
  const requiredAmount = isTransactionInvoiceAssociationRequired(record) ? record.amount : 0;
  const matchedInvoices = invoices.flatMap((invoice) =>
    invoice.matchedTransactions
      .filter((match) => match.transactionNo === record.transactionNo)
      .map((match) => ({
        amount: match.amount,
        counterparty: invoice.counterparty,
        direction: invoice.direction,
        id: `${invoice.id}-${match.id}`,
        invoiceDate: invoice.invoiceDate,
        invoiceNo: invoice.invoiceNo,
        invoiceStatus: invoice.invoiceStatus,
        totalAmount: invoice.totalAmount
      }))
  );

  if (!requiredAmount) {
    return {
      matchedAmount: 0,
      matchedInvoices,
      remainingAmount: 0,
      requiredAmount,
      status: '无需关联'
    };
  }

  const matchedAmount = invoices.reduce(
    (total, invoice) =>
      total +
      invoice.matchedTransactions.reduce(
        (invoiceTotal, match) =>
          match.transactionNo === record.transactionNo
            ? invoiceTotal + getMatchedTransactionContribution(invoice, match.amount)
            : invoiceTotal,
        0
      ),
    0
  );
  const remainingAmount = Math.max(0, requiredAmount - matchedAmount);

  if (isSameMoneyAmount(matchedAmount, 0)) {
    return {
      matchedAmount,
      matchedInvoices,
      remainingAmount,
      requiredAmount,
      status: '未关联'
    };
  }

  if (matchedAmount >= requiredAmount || isSameMoneyAmount(matchedAmount, requiredAmount)) {
    return {
      matchedAmount,
      matchedInvoices,
      remainingAmount: 0,
      requiredAmount,
      status: '已关联'
    };
  }

  return {
    matchedAmount,
    matchedInvoices,
    remainingAmount,
    requiredAmount,
    status: '部分关联'
  };
}

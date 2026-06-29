import type { FinanceInvoiceRecord } from './financeInvoiceData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import { isFinanceReceivablePayableConfirmed } from './financeReceivablesPayablesModel';
import { getFinanceAccrualTaxPolicy } from './financeTaxPolicyModel';

export type FinanceInvoiceReceivablePayableMatchLabel = '来源一致' | '对象一致' | '报销票据';

function normalizeBusinessText(value: string) {
  return value.trim().toLowerCase();
}

function isSameMoneyAmount(left: number, right: number) {
  return Math.abs(left - right) < 0.01;
}

export function isFinanceReceivablePayableInvoiceMatchApplicable(record: FinanceReceivablePayableRecord) {
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

export function getFinanceReceivablePayableInvoiceDirection(record: FinanceReceivablePayableRecord) {
  return record.direction === '应收' ? '销项' : '进项';
}

export function doesInvoiceBusinessRefMatchReceivablePayable(
  invoiceRef: FinanceInvoiceRecord['matchedBusinessRefs'][number],
  record: FinanceReceivablePayableRecord
) {
  return invoiceRef.recordId === record.id || invoiceRef.recordNo === record.documentNo || invoiceRef.sourceNo === record.sourceNo;
}

export function getInvoiceReceivablePayableMatchLabel(
  invoice: FinanceInvoiceRecord,
  record: FinanceReceivablePayableRecord
): FinanceInvoiceReceivablePayableMatchLabel | undefined {
  if (!isFinanceReceivablePayableInvoiceMatchApplicable(record)) {
    return undefined;
  }

  if (invoice.direction !== getFinanceReceivablePayableInvoiceDirection(record)) {
    return undefined;
  }

  if (invoice.matchedBusinessRefs.some((ref) => doesInvoiceBusinessRefMatchReceivablePayable(ref, record))) {
    return '来源一致';
  }

  if (normalizeBusinessText(invoice.counterparty) === normalizeBusinessText(record.counterparty)) {
    return '对象一致';
  }

  if (
    record.sourceType === '员工报销' &&
    invoice.direction === '进项' &&
    isSameMoneyAmount(invoice.totalAmount, record.amount) &&
    invoice.invoiceDate <= record.confirmDate
  ) {
    return '报销票据';
  }

  return undefined;
}

export function compareInvoiceReceivablePayableMatchLabel(
  left: FinanceInvoiceReceivablePayableMatchLabel,
  right: FinanceInvoiceReceivablePayableMatchLabel
) {
  const labelOrder: Record<FinanceInvoiceReceivablePayableMatchLabel, number> = {
    来源一致: 0,
    对象一致: 1,
    报销票据: 2
  };

  return labelOrder[left] - labelOrder[right];
}

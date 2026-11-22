// Contract receipts for the customer contract pages, derived from confirmed receivables and their posted
// settlement transactions. The app hands the result to the customers module.
import type { CustomerContractReceiptMethod, CustomerContractReceiptRecord, CustomerContractReceiptView, CustomerContractRecord } from '../customers';
import type { FinanceTransactionRecord } from './financeData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import {
  getFinanceReceivablePayableLinkedTransactionRows,
  getFinanceReceivablePayableSettlementSignedAmount,
  isFinanceReceivablePayablePostedSettlementTransaction
} from './financeReceivablesPayablesModel';

function getReceivableContractId(record: FinanceReceivablePayableRecord) {
  return record.contractId ?? record.taskSettlement?.contractId;
}

function getReceiptMethod(transaction: FinanceTransactionRecord): CustomerContractReceiptMethod {
  if (transaction.paymentMethod === '对公账户收款') {
    return '银行转账';
  }

  if (transaction.paymentMethod === '现金暂收') {
    return '现金';
  }

  return '其他';
}

function getReceiptNote(transaction: FinanceTransactionRecord) {
  const adjustment = transaction.adjustmentContext;

  if (adjustment) {
    return `${adjustment.mode}：${adjustment.reason}`;
  }

  return transaction.note || transaction.sourceTitle;
}

function buildReceiptRecord({
  financeRows,
  receivable,
  transaction
}: {
  financeRows: FinanceTransactionRecord[];
  receivable: FinanceReceivablePayableRecord;
  transaction: FinanceTransactionRecord;
}): CustomerContractReceiptRecord | undefined {
  const amount = getFinanceReceivablePayableSettlementSignedAmount(receivable, transaction, financeRows);

  if (amount === 0) {
    return undefined;
  }

  return {
    amount: Number(amount.toFixed(2)),
    id: `${receivable.id}:${transaction.transactionNo}`,
    method: getReceiptMethod(transaction),
    note: getReceiptNote(transaction),
    receivedAt: transaction.occurredAt,
    recorder: transaction.reviewedBy ?? transaction.registeredBy
  };
}

export function deriveCustomerContractReceiptViews({
  contracts,
  financeRows,
  receivablePayableRows
}: {
  contracts: readonly CustomerContractRecord[];
  financeRows: FinanceTransactionRecord[];
  receivablePayableRows: readonly FinanceReceivablePayableRecord[];
}): CustomerContractReceiptView[] {
  const receivablesByContractId = new Map<string, FinanceReceivablePayableRecord[]>();

  for (const record of receivablePayableRows) {
    const contractId = getReceivableContractId(record);

    if (record.direction !== '应收' || record.confirmationStatus !== '已确认' || !contractId) {
      continue;
    }

    const current = receivablesByContractId.get(contractId) ?? [];
    current.push(record);
    receivablesByContractId.set(contractId, current);
  }

  return contracts.map((contract) => {
    const receiptRecords = (receivablesByContractId.get(contract.id) ?? [])
      .flatMap((receivable) => (
        getFinanceReceivablePayableLinkedTransactionRows(receivable, financeRows)
          .filter(isFinanceReceivablePayablePostedSettlementTransaction)
          .map((transaction) => buildReceiptRecord({ financeRows, receivable, transaction }))
          .filter((record): record is CustomerContractReceiptRecord => Boolean(record))
      ))
      .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt) || right.id.localeCompare(left.id));
    const receivedAmount = Number(
      Math.max(0, receiptRecords.reduce((total, record) => total + record.amount, 0)).toFixed(2)
    );
    const reversalCount = receiptRecords.filter((record) => record.amount < 0).length;
    const receiptCount = receiptRecords.filter((record) => record.amount > 0).length;

    return {
      ...contract,
      latestReceiptAt: receiptRecords.find((record) => record.amount > 0)?.receivedAt ?? '-',
      receivedAmount,
      receiptNote: receiptRecords.length === 0
        ? '暂无已入账收款。'
        : `${receiptCount} 笔已入账收款${reversalCount > 0 ? `，${reversalCount} 笔冲正` : ''}。`,
      receiptRecords
    };
  });
}

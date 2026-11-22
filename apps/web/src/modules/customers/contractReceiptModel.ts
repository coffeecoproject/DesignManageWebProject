import { formatContractMoney } from './contractFormModel';
import type { CustomerContractReceiptRecord, CustomerContractRecord } from './customerData';

export type CustomerContractReceiptStatus = '未收' | '已收' | '部分已收' | '已收齐';

export type CustomerContractReceiptView = CustomerContractRecord & {
  latestReceiptAt: string;
  receivedAmount: number;
  receiptNote: string;
  receiptRecords: CustomerContractReceiptRecord[];
};

export const contractReceiptStatusTone = {
  未收: 'amber',
  已收: 'green',
  部分已收: 'blue',
  已收齐: 'green'
} as const;

export function getContractReceiptStatus(
  record: Pick<CustomerContractReceiptView, 'amount' | 'amountMode' | 'receivedAmount'>
): CustomerContractReceiptStatus {
  if (record.receivedAmount <= 0) {
    return '未收';
  }

  if (record.amountMode === '无固定金额') {
    return '已收';
  }

  if (record.amount !== null && record.receivedAmount >= record.amount) {
    return '已收齐';
  }

  return '部分已收';
}

export function getContractUnreceivedAmount(
  record: Pick<CustomerContractReceiptView, 'amount' | 'amountMode' | 'receivedAmount'>
) {
  if (record.amountMode !== '固定金额' || record.amount === null) {
    return null;
  }

  return Math.max(record.amount - record.receivedAmount, 0);
}

export function getContractReceiptCellDisplay(record: CustomerContractReceiptView) {
  const status = getContractReceiptStatus(record);
  const receivedText = record.receivedAmount > 0 ? `已收 ${formatContractMoney(record.receivedAmount)}` : '暂无收款';

  return {
    primary: record.amountMode === '无固定金额' ? '无固定金额' : `固定金额 / ${formatContractMoney(record.amount)}`,
    secondary: `${receivedText} / ${status}`,
    status
  };
}

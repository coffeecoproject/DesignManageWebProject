import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import type {
  FinancePaymentMethod,
  FinanceSourceType,
  FinanceTransactionDirection,
  FinanceTransactionRecord
} from './financeData';
import {
  financeToday,
  getAccountingPeriod,
  getDefaultFinanceReviewDueAt,
  getPublicAccountSignedAmount,
  parseMoney
} from './financeUtils';

export type FinanceTransactionAdjustmentMode = '冲正' | '补差';

export type FinanceTransactionAdjustmentBankContext = {
  amount: number;
  bankSerialNo: string;
  counterparty: string;
  direction: '入账' | '出账';
  statementDate: string;
  summary: string;
};

export type FinanceTransactionAdjustmentFormValue = {
  amountText: string;
  mode: FinanceTransactionAdjustmentMode;
  note: string;
  occurredAt: string;
  reason: string;
};

type BuildFinanceTransactionAdjustmentInput = {
  bankContext?: FinanceTransactionAdjustmentBankContext;
  existingRows: FinanceTransactionRecord[];
  files: RelatedFileRecord[];
  form: FinanceTransactionAdjustmentFormValue;
  originRecord: FinanceTransactionRecord;
};

function formatAmountInput(amount: number) {
  return amount > 0 ? amount.toFixed(2) : '';
}

function getBankSignedAmount(bankContext: FinanceTransactionAdjustmentBankContext) {
  return bankContext.direction === '出账' ? -bankContext.amount : bankContext.amount;
}

function getOppositeTransactionDirection(direction: FinanceTransactionDirection): FinanceTransactionDirection {
  if (direction === '收入') {
    return '支出';
  }

  if (direction === '支出') {
    return '收入';
  }

  return '内部转入';
}

function getAdjustmentPaymentMethod(direction: FinanceTransactionDirection, originRecord: FinanceTransactionRecord): FinancePaymentMethod {
  if (direction === '收入') {
    return originRecord.paymentMethod === '员工代收' || originRecord.paymentMethod === '现金暂收'
      ? originRecord.paymentMethod
      : '对公账户收款';
  }

  return '对公账户付款';
}

export function getFinanceTransactionAdjustmentSignedDifference(
  originRecord: FinanceTransactionRecord,
  bankContext?: FinanceTransactionAdjustmentBankContext
) {
  if (!bankContext) {
    return undefined;
  }

  return getBankSignedAmount(bankContext) - getPublicAccountSignedAmount(originRecord);
}

export function getDefaultFinanceTransactionAdjustmentAmount(
  originRecord: FinanceTransactionRecord,
  mode: FinanceTransactionAdjustmentMode,
  bankContext?: FinanceTransactionAdjustmentBankContext
) {
  if (mode === '冲正') {
    return originRecord.amount;
  }

  const signedDifference = getFinanceTransactionAdjustmentSignedDifference(originRecord, bankContext);

  return signedDifference === undefined ? 0 : Math.abs(signedDifference);
}

export function getDefaultFinanceTransactionAdjustmentAmountText(
  originRecord: FinanceTransactionRecord,
  mode: FinanceTransactionAdjustmentMode,
  bankContext?: FinanceTransactionAdjustmentBankContext
) {
  return formatAmountInput(getDefaultFinanceTransactionAdjustmentAmount(originRecord, mode, bankContext));
}

export function createFinanceTransactionAdjustmentForm(
  originRecord: FinanceTransactionRecord,
  bankContext?: FinanceTransactionAdjustmentBankContext
): FinanceTransactionAdjustmentFormValue {
  const mode: FinanceTransactionAdjustmentMode = bankContext ? '补差' : '冲正';

  return {
    amountText: getDefaultFinanceTransactionAdjustmentAmountText(originRecord, mode, bankContext),
    mode,
    note: '',
    occurredAt: financeToday,
    reason: ''
  };
}

export function getFinanceTransactionAdjustmentAmount(form: FinanceTransactionAdjustmentFormValue) {
  return parseMoney(form.amountText);
}

export function getFinanceTransactionAdjustmentDirection(
  originRecord: FinanceTransactionRecord,
  form: FinanceTransactionAdjustmentFormValue,
  bankContext?: FinanceTransactionAdjustmentBankContext
): FinanceTransactionDirection {
  if (form.mode === '冲正') {
    return getOppositeTransactionDirection(originRecord.direction);
  }

  const signedDifference = getFinanceTransactionAdjustmentSignedDifference(originRecord, bankContext);

  if (signedDifference === undefined) {
    return originRecord.direction;
  }

  return signedDifference >= 0 ? '收入' : '支出';
}

function buildAdjustmentTransactionNo(existingRows: FinanceTransactionRecord[], occurredAt: string) {
  const periodCode = getAccountingPeriod(occurredAt).replace('-', '');
  const samePeriodCount = existingRows.filter((record) => record.transactionNo.startsWith(`FIN-ADJ-${periodCode}`)).length;

  return `FIN-ADJ-${periodCode}-${String(samePeriodCount + 1).padStart(4, '0')}`;
}

function getAdjustmentSourceType(mode: FinanceTransactionAdjustmentMode): FinanceSourceType {
  return mode === '冲正' ? '流水冲正' : '流水补差';
}

export function buildFinanceTransactionAdjustmentRecord({
  bankContext,
  existingRows,
  files,
  form,
  originRecord
}: BuildFinanceTransactionAdjustmentInput): FinanceTransactionRecord {
  const amount = getFinanceTransactionAdjustmentAmount(form);
  const direction = getFinanceTransactionAdjustmentDirection(originRecord, form, bankContext);
  const transactionNo = buildAdjustmentTransactionNo(existingRows, form.occurredAt);
  const sourceType = getAdjustmentSourceType(form.mode);
  const sourceTitleParts = [`${form.mode}处理`, originRecord.transactionNo];

  if (bankContext) {
    sourceTitleParts.push(bankContext.bankSerialNo);
  }

  return {
    accountingPeriod: getAccountingPeriod(form.occurredAt),
    adjustmentContext: {
      bankSerialNo: bankContext?.bankSerialNo,
      mode: form.mode,
      originTransactionNo: originRecord.transactionNo,
      reason: form.reason.trim()
    },
    amount,
    category: originRecord.category,
    categorySnapshot: originRecord.categorySnapshot,
    counterparty: originRecord.counterparty,
    counterpartyType: originRecord.counterpartyType,
    currency: 'CNY',
    direction,
    files,
    handler: originRecord.handler,
    id: `fin-adjust-${Date.now()}`,
    invoiceDeclarationStatus: '不适用',
    note: form.note.trim() || form.reason.trim(),
    occurredAt: form.occurredAt,
    operationRecords: [
      {
        action: `发起${form.mode}`,
        actor: '李明',
        id: `fin-op-adjust-${Date.now()}`,
        object: transactionNo,
        summary: `${form.mode}原流水 ${originRecord.transactionNo}，原因：${form.reason.trim()}`,
        time: `${financeToday} 16:50`
      }
    ],
    paymentMethod: getAdjustmentPaymentMethod(direction, originRecord),
    publicAccountId: originRecord.publicAccountId,
    publicAccountSnapshot: originRecord.publicAccountSnapshot,
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    reviewDueAt: getDefaultFinanceReviewDueAt(form.occurredAt),
    sourceNo: originRecord.transactionNo,
    sourceTitle: sourceTitleParts.join(' / '),
    sourceType,
    status: '待复核',
    transactionNo,
    updatedAt: `${financeToday} 16:50`,
    voucherStatus: files.length > 0 ? '已上传' : '待补充'
  };
}

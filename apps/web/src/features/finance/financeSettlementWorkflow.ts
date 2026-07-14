import type { FinanceTransactionRecord } from './financeData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import { getFinanceTransactionAdjustmentBlocker } from './financeTransactionAdjustmentModel';
import {
  applyFinanceReceivablePayableSettlementReview,
  canRegisterFinanceReceivablePayableSettlement,
  getFinanceReceivablePayableLinkedTransactionRows,
  getFinanceReceivablePayableRegisterableAmount,
  getFinanceReceivablePayableSettlementTargets,
  linkFinanceReceivablePayableSettlementTransaction
} from './financeReceivablesPayablesModel';

export type FinanceSettlementWorkflowState = {
  financeRows: FinanceTransactionRecord[];
  receivablePayableRows: FinanceReceivablePayableRecord[];
};

export type FinanceSettlementWorkflowResult =
  | ({ success: true } & FinanceSettlementWorkflowState)
  | { message: string; success: false };

type FinanceTransactionReviewInput = {
  operationId: string;
  reviewedAt: string;
  reviewer: string;
  transactionId: string;
};

const moneyTolerance = 0.01;

function isSameMoney(first: number, second: number) {
  return Math.abs(first - second) < moneyTolerance;
}

function getNaturalPersonSettlementBlocker(
  record: FinanceReceivablePayableRecord,
  transaction: FinanceTransactionRecord,
  financeRows: FinanceTransactionRecord[] = []
) {
  const sourceSnapshot = record.naturalPersonPayment;

  if (sourceSnapshot?.incomeType !== '劳务报酬') {
    return undefined;
  }

  const originTransaction = transaction.adjustmentContext?.mode === '冲正'
    ? financeRows.find(
        (candidate) => candidate.transactionNo === transaction.adjustmentContext?.originTransactionNo
      )
    : undefined;
  const paymentTransaction = originTransaction ?? transaction;
  const paymentSnapshot = paymentTransaction.naturalPersonPayment;

  if (paymentSnapshot?.incomeType !== '劳务报酬') {
    return '自然人劳务付款缺少所得及代扣信息';
  }

  if (
    paymentSnapshot.paymentFactId !== sourceSnapshot.paymentFactId
    || paymentSnapshot.personId !== sourceSnapshot.personId
    || !isSameMoney(paymentSnapshot.grossIncomeAmount, sourceSnapshot.grossIncomeAmount)
    || !isSameMoney(paymentSnapshot.netPaymentAmount, paymentTransaction.amount)
    || !isSameMoney(
      paymentSnapshot.netPaymentAmount + paymentSnapshot.withheldTaxAmount,
      paymentSnapshot.grossIncomeAmount
    )
    || paymentSnapshot.taxPeriod !== paymentTransaction.accountingPeriod
  ) {
    return '自然人劳务付款金额、人员或扣缴期间与应付事项不一致';
  }

  return undefined;
}

export function commitFinanceTransactionAdjustmentRegistration(
  state: FinanceSettlementWorkflowState,
  transaction: FinanceTransactionRecord
): FinanceSettlementWorkflowResult {
  const adjustmentContext = transaction.adjustmentContext;

  if (!adjustmentContext) {
    return { message: '当前流水不是冲正补差记录', success: false };
  }

  if (
    state.financeRows.some(
      (candidate) => candidate.id === transaction.id || candidate.transactionNo === transaction.transactionNo
    )
  ) {
    return { message: '该冲正补差流水已经登记', success: false };
  }

  const originTransaction = state.financeRows.find(
    (candidate) => candidate.transactionNo === adjustmentContext.originTransactionNo
  );
  const blocker = getFinanceTransactionAdjustmentBlocker(
    originTransaction,
    adjustmentContext.mode,
    state.financeRows,
    transaction.id
  );

  if (blocker) {
    return { message: blocker, success: false };
  }

  if (
    transaction.status !== '待复核'
    || transaction.sourceNo !== originTransaction?.transactionNo
    || transaction.sourceType !== (adjustmentContext.mode === '冲正' ? '流水冲正' : '流水补差')
  ) {
    return { message: '冲正补差流水状态或来源不一致', success: false };
  }

  if (
    adjustmentContext.mode === '冲正'
    && originTransaction?.naturalPersonPayment?.incomeType === '劳务报酬'
    && !isSameMoney(transaction.amount, originTransaction.amount)
  ) {
    return { message: '自然人劳务付款只能按原银行实付金额全额冲正', success: false };
  }

  return {
    financeRows: [transaction, ...state.financeRows],
    receivablePayableRows: state.receivablePayableRows,
    success: true
  };
}

export function commitFinanceReceivablePayableSettlementRegistration(
  state: FinanceSettlementWorkflowState,
  recordId: string,
  transaction: FinanceTransactionRecord
): FinanceSettlementWorkflowResult {
  const record = state.receivablePayableRows.find((candidate) => candidate.id === recordId);

  if (!record) {
    return { message: '应收应付事项不存在', success: false };
  }

  if (
    state.financeRows.some(
      (candidate) => candidate.id === transaction.id || candidate.transactionNo === transaction.transactionNo
    )
  ) {
    return { message: '该收付款流水已经登记', success: false };
  }

  const linkedTransactionRows = getFinanceReceivablePayableLinkedTransactionRows(record, state.financeRows);

  if (!canRegisterFinanceReceivablePayableSettlement(record, linkedTransactionRows)) {
    return { message: '当前事项没有可登记的收付款金额', success: false };
  }

  if (transaction.status !== '待复核' || transaction.sourceNo !== record.documentNo) {
    return { message: '流水状态或来源与应收应付事项不一致', success: false };
  }

  const reservationAmount = transaction.naturalPersonPayment?.grossIncomeAmount ?? transaction.amount;
  const registerableAmount = getFinanceReceivablePayableRegisterableAmount(record, linkedTransactionRows);

  if (reservationAmount <= 0 || reservationAmount - registerableAmount >= moneyTolerance) {
    return { message: '登记金额超过事项剩余可收付金额', success: false };
  }

  const naturalPersonBlocker = getNaturalPersonSettlementBlocker(record, transaction);

  if (naturalPersonBlocker) {
    return { message: naturalPersonBlocker, success: false };
  }

  return {
    financeRows: [transaction, ...state.financeRows],
    receivablePayableRows: state.receivablePayableRows.map((candidate) =>
      candidate.id === recordId
        ? linkFinanceReceivablePayableSettlementTransaction(candidate, transaction)
        : candidate
    ),
    success: true
  };
}

export function commitFinanceTransactionReview(
  state: FinanceSettlementWorkflowState,
  input: FinanceTransactionReviewInput
): FinanceSettlementWorkflowResult {
  const transaction = state.financeRows.find((candidate) => candidate.id === input.transactionId);

  if (!transaction || transaction.status !== '待复核') {
    return { message: '当前流水不在待复核状态', success: false };
  }

  if (transaction.voucherStatus !== '已上传') {
    return { message: '请先补充凭证，再复核入账', success: false };
  }

  const settlementTargets = getFinanceReceivablePayableSettlementTargets(
    state.receivablePayableRows,
    transaction,
    state.financeRows
  );

  if (transaction.adjustmentContext) {
    const originTransaction = state.financeRows.find(
      (candidate) => candidate.transactionNo === transaction.adjustmentContext?.originTransactionNo
    );
    const adjustmentBlocker = getFinanceTransactionAdjustmentBlocker(
      originTransaction,
      transaction.adjustmentContext.mode,
      state.financeRows,
      transaction.id
    );

    if (adjustmentBlocker) {
      return { message: adjustmentBlocker, success: false };
    }
  }

  for (const record of settlementTargets) {
    const naturalPersonBlocker = getNaturalPersonSettlementBlocker(record, transaction, state.financeRows);

    if (naturalPersonBlocker) {
      return { message: naturalPersonBlocker, success: false };
    }
  }

  const reviewedTransaction: FinanceTransactionRecord = {
    ...transaction,
    operationRecords: [
      ...transaction.operationRecords,
      {
        action: '复核入账',
        actor: input.reviewer,
        id: input.operationId,
        object: transaction.transactionNo,
        summary: '核对流水信息和凭证后入账',
        time: input.reviewedAt
      }
    ],
    reviewedAt: input.reviewedAt,
    reviewedBy: input.reviewer,
    status: '已入账',
    updatedAt: input.reviewedAt
  };

  return {
    financeRows: state.financeRows.map((candidate) =>
      candidate.id === transaction.id ? reviewedTransaction : candidate
    ),
    receivablePayableRows: applyFinanceReceivablePayableSettlementReview(
      state.receivablePayableRows,
      transaction,
      state.financeRows
    ),
    success: true
  };
}

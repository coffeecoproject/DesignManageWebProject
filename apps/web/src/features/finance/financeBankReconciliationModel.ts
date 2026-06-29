import {
  financePrimaryCategorySeeds,
  financeSecondaryCategorySeeds,
  getFinanceCategorySnapshot,
  type FinanceCounterpartyScope,
  type FinancePaymentMethod,
  type FinanceSecondaryCategoryConfig,
  type FinanceTransactionCategory,
  type FinanceTransactionDirection,
  type FinanceTransactionRecord
} from './financeData';
import type { BankMatchStatus, BankStatementDirection, BankStatementRecord } from './financeBankImportContract';
import {
  financeToday,
  formatMoney,
  getAccountingPeriod,
  getDefaultFinanceReviewDueAt,
  getPublicAccountSignedAmount
} from './financeUtils';

export type BankReconciliationFlowFormValue = {
  category: FinanceTransactionCategory;
  note: string;
  primaryCategoryId: string;
  sourceNo: string;
  sourceTitle: string;
};

export type BankReconciliationResolution = {
  adjustedSystemSignedAmount?: number;
  bankSignedAmount: number;
  canConfirmWithAdjustments: boolean;
  effectiveReason: string;
  effectiveStatus: BankMatchStatus;
  pendingAdjustmentRecords: FinanceTransactionRecord[];
  relatedAdjustmentRecords: FinanceTransactionRecord[];
  remainingDifference?: number;
  reviewedAdjustmentRecords: FinanceTransactionRecord[];
};

const moneyTolerance = 0.005;

function getTransactionDirection(direction: BankStatementDirection): Exclude<FinanceTransactionDirection, '内部转入'> {
  return direction === '入账' ? '收入' : '支出';
}

function getBankSignedAmount(record: BankStatementRecord) {
  return record.direction === '出账' ? -record.amount : record.amount;
}

function isBankAmountAdjustmentRecord(
  record: FinanceTransactionRecord,
  bankRecord: BankStatementRecord,
  originRecord: FinanceTransactionRecord
) {
  return (
    record.status !== '已作废' &&
    record.sourceType === '流水补差' &&
    (
      bankRecord.matchedTransactionIds.includes(record.id) ||
      (record.sourceNo === originRecord.transactionNo && record.sourceTitle.includes(bankRecord.bankSerialNo))
    )
  );
}

function sumPublicAccountSignedAmount(records: FinanceTransactionRecord[]) {
  return records.reduce((total, record) => total + getPublicAccountSignedAmount(record), 0);
}

function isMoneySettled(amount: number) {
  return Math.abs(amount) < moneyTolerance;
}

export function getBankReconciliationResolution(
  bankRecord: BankStatementRecord,
  systemRecord: FinanceTransactionRecord | undefined,
  financeRows: FinanceTransactionRecord[]
): BankReconciliationResolution {
  const bankSignedAmount = getBankSignedAmount(bankRecord);

  if (!systemRecord || bankRecord.matchStatus !== '金额不一致') {
    return {
      bankSignedAmount,
      canConfirmWithAdjustments: false,
      effectiveReason: bankRecord.matchReason,
      effectiveStatus: bankRecord.matchStatus,
      pendingAdjustmentRecords: [],
      relatedAdjustmentRecords: [],
      reviewedAdjustmentRecords: []
    };
  }

  const relatedAdjustmentRecords = financeRows.filter((record) => isBankAmountAdjustmentRecord(record, bankRecord, systemRecord));
  const pendingAdjustmentRecords = relatedAdjustmentRecords.filter((record) => record.status === '待复核');
  const reviewedAdjustmentRecords = relatedAdjustmentRecords.filter((record) => record.status === '已入账');
  const returnedAdjustmentRecords = relatedAdjustmentRecords.filter((record) => record.status === '退回修改');
  const adjustedSystemSignedAmount = getPublicAccountSignedAmount(systemRecord) + sumPublicAccountSignedAmount(reviewedAdjustmentRecords);
  const remainingDifference = bankSignedAmount - adjustedSystemSignedAmount;

  if (isMoneySettled(remainingDifference) && reviewedAdjustmentRecords.length > 0) {
    return {
      adjustedSystemSignedAmount,
      bankSignedAmount,
      canConfirmWithAdjustments: true,
      effectiveReason: `调整流水 ${reviewedAdjustmentRecords.map((record) => record.transactionNo).join('、')} 已入账，差额已抹平，待确认对账`,
      effectiveStatus: '待确认',
      pendingAdjustmentRecords,
      relatedAdjustmentRecords,
      remainingDifference: 0,
      reviewedAdjustmentRecords
    };
  }

  if (pendingAdjustmentRecords.length > 0) {
    return {
      adjustedSystemSignedAmount,
      bankSignedAmount,
      canConfirmWithAdjustments: false,
      effectiveReason: `调整流水 ${pendingAdjustmentRecords.map((record) => record.transactionNo).join('、')} 待复核，复核入账后再确认对账`,
      effectiveStatus: '暂不可对账',
      pendingAdjustmentRecords,
      relatedAdjustmentRecords,
      remainingDifference,
      reviewedAdjustmentRecords
    };
  }

  if (returnedAdjustmentRecords.length > 0) {
    return {
      adjustedSystemSignedAmount,
      bankSignedAmount,
      canConfirmWithAdjustments: false,
      effectiveReason: `调整流水 ${returnedAdjustmentRecords.map((record) => record.transactionNo).join('、')} 已退回，需要重新处理金额不一致`,
      effectiveStatus: '金额不一致',
      pendingAdjustmentRecords,
      relatedAdjustmentRecords,
      remainingDifference,
      reviewedAdjustmentRecords
    };
  }

  return {
    adjustedSystemSignedAmount,
    bankSignedAmount,
    canConfirmWithAdjustments: false,
    effectiveReason: bankRecord.matchReason,
    effectiveStatus: bankRecord.matchStatus,
    pendingAdjustmentRecords,
    relatedAdjustmentRecords,
    remainingDifference,
    reviewedAdjustmentRecords
  };
}

function getPaymentMethod(direction: BankStatementDirection): FinancePaymentMethod {
  return direction === '入账' ? '对公账户收款' : '对公账户付款';
}

function getCounterpartyType(scope: FinanceCounterpartyScope): FinanceTransactionRecord['counterpartyType'] {
  if (scope === '客户') {
    return '客户';
  }

  if (scope === '员工') {
    return '员工';
  }

  if (scope === '合作人员') {
    return '外协';
  }

  if (scope === '供应商') {
    return '供应商';
  }

  return '内部';
}

function buildNextBankGeneratedTransactionNo(records: FinanceTransactionRecord[], occurredAt: string) {
  const period = getAccountingPeriod(occurredAt).replace('-', '');
  const maxSequence = records.reduce((max, record) => {
    if (record.transactionNo.slice(4, 10) !== period) {
      return max;
    }

    const sequence = Number(record.transactionNo.slice(-4));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `FIN-${period}-${String(maxSequence + 1).padStart(4, '0')}`;
}

export function getBankReconciliationCategoryOptions(
  direction: BankStatementDirection,
  primaryCategoryId?: string
): FinanceSecondaryCategoryConfig[] {
  const targetDirection = getTransactionDirection(direction);
  const paymentMethod = getPaymentMethod(direction);

  return financeSecondaryCategorySeeds
    .filter((category) => (
      category.status === '启用' &&
      category.direction === targetDirection &&
      category.paymentMethods.includes(paymentMethod) &&
      (!primaryCategoryId || category.primaryId === primaryCategoryId)
    ))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getBankReconciliationPrimaryCategoryOptions(direction: BankStatementDirection) {
  const secondaryRows = getBankReconciliationCategoryOptions(direction);
  const primaryIds = new Set(secondaryRows.map((category) => category.primaryId));

  return financePrimaryCategorySeeds
    .filter((category) => category.status === '启用' && category.direction === getTransactionDirection(direction) && primaryIds.has(category.id))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getDefaultBankReconciliationPrimaryCategoryId(record: BankStatementRecord) {
  const preferredCategory = record.direction === '入账' ? '客户回款' : '外协付款';
  const preferredSecondary = getBankReconciliationCategoryOptions(record.direction).find((category) => category.name === preferredCategory);

  return preferredSecondary?.primaryId ?? getBankReconciliationPrimaryCategoryOptions(record.direction)[0]?.id ?? '';
}

export function getDefaultBankReconciliationCategory(record: BankStatementRecord, primaryCategoryId = getDefaultBankReconciliationPrimaryCategoryId(record)) {
  const preferredCategory = record.direction === '入账' ? '客户回款' : '外协付款';
  const scopedOptions = getBankReconciliationCategoryOptions(record.direction, primaryCategoryId);

  return scopedOptions.find((category) => category.name === preferredCategory)?.name ?? scopedOptions[0]?.name ?? '';
}

export function getBankReconciliationPrimaryCategoryName(primaryCategoryId: string) {
  return financePrimaryCategorySeeds.find((category) => category.id === primaryCategoryId)?.name ?? '-';
}

export function createBankReconciliationFlowForm(record?: BankStatementRecord): BankReconciliationFlowFormValue {
  const primaryCategoryId = record ? getDefaultBankReconciliationPrimaryCategoryId(record) : '';

  return {
    category: record ? getDefaultBankReconciliationCategory(record, primaryCategoryId) : '',
    note: record ? `银行流水补登记：${record.bankSerialNo}` : '',
    primaryCategoryId,
    sourceNo: record?.bankSerialNo ?? '',
    sourceTitle: record?.summary ?? ''
  };
}

export function buildFinanceTransactionFromBankStatement(
  record: BankStatementRecord,
  form: BankReconciliationFlowFormValue,
  financeRows: FinanceTransactionRecord[]
): FinanceTransactionRecord {
  const transactionNo = buildNextBankGeneratedTransactionNo(financeRows, record.statementDate);
  const categoryOption = getBankReconciliationCategoryOptions(record.direction).find((category) => category.name === form.category);
  const categorySnapshot = getFinanceCategorySnapshot(form.category);
  const sourceTitle = form.sourceTitle.trim() || record.summary;

  return {
    accountingPeriod: getAccountingPeriod(record.statementDate),
    amount: record.amount,
    category: form.category,
    categorySnapshot,
    counterparty: record.counterparty,
    counterpartyType: getCounterpartyType(categoryOption?.counterpartyScope ?? '内部'),
    currency: 'CNY',
    direction: getTransactionDirection(record.direction),
    files: [
      {
        id: `bank-statement-file-${record.id}`,
        name: `${record.bankSerialNo}_银行流水记录`,
        status: '已上传',
        type: '银行流水',
        updatedAt: record.statementDate
      }
    ],
    id: `fin-bank-${record.id}-${transactionNo}`,
    invoiceDeclarationStatus: record.direction === '入账' && categorySnapshot.includeInReport ? '待关联发票' : '不适用',
    note: form.note.trim(),
    occurredAt: record.statementDate,
    operationRecords: [
      {
        action: '补登记系统流水',
        actor: '李明',
        id: `fin-bank-op-${record.id}`,
        object: transactionNo,
        summary: `根据银行流水 ${record.bankSerialNo} 补登记 ${formatMoney(record.amount)}`,
        time: `${financeToday} 10:40`
      }
    ],
    paymentMethod: getPaymentMethod(record.direction),
    publicAccountId: record.publicAccountId,
    publicAccountSnapshot: record.publicAccountSnapshot,
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    reviewDueAt: getDefaultFinanceReviewDueAt(record.statementDate),
    sourceNo: form.sourceNo.trim() || record.bankSerialNo,
    sourceTitle,
    sourceType: categoryOption?.defaultSourceType ?? '手工登记',
    status: '待复核',
    transactionNo,
    updatedAt: `${financeToday} 10:40`,
    voucherStatus: '已上传'
  };
}

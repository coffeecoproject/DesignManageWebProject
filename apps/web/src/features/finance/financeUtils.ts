import type { StatusTagTone } from '../../components/Detail';
import type { CellTextTone } from '../../components/TableCell';
import { financeSecondaryCategorySeeds, getFinanceCategorySnapshot } from './financeData';
import type {
  FinanceCollectionStatus,
  FinanceInvoiceDeclarationStatus,
  FinancePaymentMethod,
  FinanceReconciliationStatus,
  FinanceTransactionCategory,
  FinanceTransactionDirection,
  FinanceTransactionRecord,
  FinanceTransactionStatus,
  FinanceVoucherStatus
} from './financeData';
import type { FinanceTransactionInvoiceAssociation, FinanceTransactionInvoiceAssociationStatus } from './financeInvoiceModel';

export const financeToday = '2026-06-15';

export const directionTone = {
  收入: 'green',
  支出: 'red',
  内部转入: 'blue'
} as const satisfies Record<FinanceTransactionDirection, StatusTagTone>;

export const transactionStatusTone = {
  待复核: 'amber',
  退回修改: 'red',
  已入账: 'green',
  已作废: 'gray'
} as const satisfies Record<FinanceTransactionStatus, StatusTagTone>;

export const reconciliationStatusTone = {
  未对账: 'blue',
  已对账: 'green',
  对账异常: 'red'
} as const satisfies Record<FinanceReconciliationStatus, StatusTagTone>;

export const voucherStatusTone = {
  已上传: 'green',
  待补充: 'amber'
} as const satisfies Record<FinanceVoucherStatus, StatusTagTone>;

export const collectionStatusTone = {
  不适用: 'gray',
  待转入对公: 'amber',
  部分转入对公: 'blue',
  已转入对公: 'green',
  待存入对公: 'amber',
  已存入对公: 'green',
  待报销: 'amber',
  已报销: 'green'
} as const satisfies Record<FinanceCollectionStatus, StatusTagTone>;

export const invoiceAssociationStatusTone = {
  无需关联: 'gray',
  未关联: 'amber',
  部分关联: 'blue',
  已关联: 'green'
} as const satisfies Record<FinanceTransactionInvoiceAssociationStatus, StatusTagTone>;

export const invoiceDeclarationStatusTone = {
  不适用: 'gray',
  待关联发票: 'amber',
  部分关联发票: 'blue',
  已关联发票: 'green',
  未开票待确认: 'amber',
  未开票已申报: 'green',
  本期暂不计入: 'gray',
  后续开票待处理: 'amber',
  后续开票已处理: 'green'
} as const satisfies Record<FinanceInvoiceDeclarationStatus, StatusTagTone>;

export const collectionStatusDisplayName: Record<FinanceCollectionStatus, string> = {
  不适用: '不适用',
  待转入对公: '待转入对公',
  部分转入对公: '部分转入对公',
  已转入对公: '已转入对公',
  待存入对公: '待存入对公',
  已存入对公: '已存入对公',
  待报销: '待报销',
  已报销: '已报销'
};

export const financeCategoryDisplayName = Object.fromEntries(
  financeSecondaryCategorySeeds.map((category) => [category.name, category.name])
) as Record<FinanceTransactionCategory, string>;

export function getFinanceCategoryDisplayName(category: FinanceTransactionCategory) {
  return financeCategoryDisplayName[category] ?? category;
}

export function getFinanceRecordCategorySnapshot(record: FinanceTransactionRecord) {
  return record.categorySnapshot ?? getFinanceCategorySnapshot(record.category);
}

export function formatMoney(amount: number) {
  return `${amount.toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} 元`;
}

export function parseMoney(value: string) {
  const amount = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function getAccountingPeriod(occurredAt: string) {
  return occurredAt.slice(0, 7);
}

export function getSignedAmount(record: FinanceTransactionRecord) {
  if (!getFinanceRecordCategorySnapshot(record).includeInReport) {
    return 0;
  }

  if (record.direction === '内部转入') {
    return 0;
  }

  return record.direction === '收入' ? record.amount : -record.amount;
}

export function getPublicAccountSignedAmount(record: FinanceTransactionRecord) {
  if (record.settlementAccountType !== '对公账户') {
    return 0;
  }

  return record.direction === '支出' ? -record.amount : record.amount;
}

export function getAmountTone(record: FinanceTransactionRecord): CellTextTone {
  if (record.status === '已作废') {
    return 'muted';
  }

  if (record.direction === '内部转入') {
    return 'transfer';
  }

  return record.direction === '收入' ? 'income' : 'expense';
}

export function getFinanceTransactionInvoiceDeclarationStatus(
  record: FinanceTransactionRecord,
  invoiceAssociation: FinanceTransactionInvoiceAssociation
): FinanceInvoiceDeclarationStatus {
  const explicitStatus = record.invoiceDeclarationStatus;

  if (
    explicitStatus === '未开票已申报' &&
    (invoiceAssociation.status === '部分关联' || invoiceAssociation.status === '已关联')
  ) {
    return '后续开票待处理';
  }

  if (explicitStatus === '后续开票已处理') {
    return explicitStatus;
  }

  if (invoiceAssociation.status === '无需关联') {
    return explicitStatus ?? '不适用';
  }

  if (invoiceAssociation.status === '已关联') {
    return '已关联发票';
  }

  if (invoiceAssociation.status === '部分关联') {
    return '部分关联发票';
  }

  if (explicitStatus) {
    return explicitStatus;
  }

  return record.direction === '收入' ? '未开票待确认' : '待关联发票';
}

export function getFinanceDirectionLabels(direction: FinanceTransactionDirection, paymentMethod?: FinancePaymentMethod) {
  if (direction === '内部转入') {
    return {
      amount: '转入金额',
      counterparty: '处理对象',
      handler: '经办人',
      paymentMethod: '处理方式',
      publicAccount: '进入对公账户',
      uploadVoucher: '上传转入凭证',
      voucherEmpty: '暂无转入凭证文件',
      voucherSection: '转入凭证'
    };
  }

  const isExpense = direction === '支出';
  let handler = isExpense ? '付款经办人' : '收款经办人';

  if (paymentMethod === '员工代收') {
    handler = '代收经办人';
  }

  if (paymentMethod === '现金暂收') {
    handler = '现金经办人';
  }

  if (paymentMethod === '员工垫付') {
    handler = '垫付员工';
  }

  return {
    amount: isExpense ? '付款金额' : '收款金额',
    counterparty: isExpense ? '付款对象' : '收款对象',
    handler,
    paymentMethod: isExpense ? '付款方式' : '收款方式',
    publicAccount: isExpense ? '付款对公账户' : '入账对公账户',
    uploadVoucher: isExpense ? '上传付款凭证' : '上传收款凭证',
    voucherEmpty: isExpense ? '暂无付款凭证文件' : '暂无收款凭证文件',
    voucherSection: isExpense ? '付款凭证' : '收款凭证'
  };
}

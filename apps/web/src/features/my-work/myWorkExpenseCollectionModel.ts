import type { OperationRecord } from '../../components/OperationRecordTable';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import { getDateScopeRange, type DateScopeFilterValue } from '../../components/DateFilterFields';
import {
  financePrimaryCategorySeeds,
  financeSecondaryCategorySeeds,
  getFinanceSeedPublicAccountRef,
  getFinanceCategorySnapshot,
  type FinanceSecondaryCategoryConfig,
  type FinanceTransactionCategory,
  type FinanceTransactionRecord
} from '../finance/financeData';
import {
  getReceivablePayableOutstandingAmount,
  type FinanceReceivablePayableRecord
} from '../finance/financeReceivablesPayablesData';
import { isFinanceReceivablePayableConfirmed } from '../finance/financeReceivablesPayablesModel';
import { financeToday, formatMoney, getAccountingPeriod, getDefaultFinanceReviewDueAt } from '../finance/financeUtils';
import type { PublicAccountRef } from '../system/PublicAccountConfigState';

export type MyWorkExpenseCollectionKind = '费用报销' | '代收登记';
export type MyWorkExpenseCollectionStatus = '草稿' | '待审核' | '待复核' | '退回修改' | '已确认' | '已关闭';
export type MyWorkExpenseOriginalType = '电子原件' | '纸质原件' | '无正式票据';
export type MyWorkExpensePaperStatus = '无需提交' | '待提交' | '已收到' | '已归档';
export type MyWorkExpensePaymentMethod = '微信' | '支付宝' | '银行卡' | '现金';
export type MyWorkCollectionMethod = '银行转账' | '微信' | '支付宝' | '现金';
export type MyWorkExpenseCollectionFilterValue = '全部';

export type MyWorkExpenseCollectionRecord = {
  amount: number;
  category: FinanceTransactionCategory;
  code: string;
  collectionMethod?: MyWorkCollectionMethod;
  customerName?: string;
  files: RelatedFileRecord[];
  id: string;
  kind: MyWorkExpenseCollectionKind;
  linkedFinanceTransactionNo?: string;
  note: string;
  occurredAt: string;
  operationRecords: OperationRecord[];
  originalType?: MyWorkExpenseOriginalType;
  paperStatus?: MyWorkExpensePaperStatus;
  paymentMethod?: MyWorkExpensePaymentMethod;
  publicAccountId?: string;
  relatedReceivableNo?: string;
  relatedTarget?: string;
  status: MyWorkExpenseCollectionStatus;
  title: string;
  transferFiles?: RelatedFileRecord[];
  updatedAt: string;
};

export type MyWorkExpenseCollectionFormValue = {
  amount: number;
  category: FinanceTransactionCategory;
  collectionMethod: MyWorkCollectionMethod;
  customerName: string;
  files: RelatedFileRecord[];
  kind: MyWorkExpenseCollectionKind;
  note: string;
  occurredAt: string;
  originalType: MyWorkExpenseOriginalType;
  paymentMethod: MyWorkExpensePaymentMethod;
  primaryCategoryId: string;
  publicAccountId: string;
  relatedReceivableNo: string;
  relatedTarget: string;
  title: string;
  transferFiles: RelatedFileRecord[];
};

export type MyWorkExpenseCollectionFilters = {
  keyword: string;
  kind: MyWorkExpenseCollectionFilterValue | MyWorkExpenseCollectionKind;
  occurredTime: DateScopeFilterValue;
  status: MyWorkExpenseCollectionFilterValue | MyWorkExpenseCollectionStatus;
};

export type MyWorkExpenseCollectionMetrics = {
  confirmedCount: number;
  draftCount: number;
  financeConfirmCount: number;
  pendingApprovalCount: number;
  pendingMyActionCount: number;
  pendingReviewCount: number;
  totalCount: number;
};

export type MyWorkReceivableOption = {
  customerName: string;
  label: string;
  sourceTitle: string;
  value: string;
};

export const myWorkExpenseCollectionCurrentMonth = financeToday.slice(0, 7);

export const myWorkExpenseCollectionKindOptions: MyWorkExpenseCollectionKind[] = ['费用报销', '代收登记'];
export const myWorkExpenseCollectionStatusOptions: MyWorkExpenseCollectionStatus[] = [
  '草稿',
  '待审核',
  '待复核',
  '退回修改',
  '已确认',
  '已关闭'
];
export const myWorkExpenseOriginalTypeOptions: MyWorkExpenseOriginalType[] = ['电子原件', '纸质原件', '无正式票据'];
export const myWorkExpensePaymentMethodOptions: MyWorkExpensePaymentMethod[] = ['微信', '支付宝', '银行卡', '现金'];
export const myWorkCollectionMethodOptions: MyWorkCollectionMethod[] = ['银行转账', '微信', '支付宝', '现金'];

export const defaultMyWorkExpenseCollectionFilters: MyWorkExpenseCollectionFilters = {
  keyword: '',
  kind: '全部',
  occurredTime: { mode: 'currentMonth' },
  status: '全部'
};

export const myWorkExpenseCollectionSeedRecords: MyWorkExpenseCollectionRecord[] = [
  {
    amount: 486.5,
    category: '差旅交通',
    code: 'EC-202606-001',
    files: [
      {
        id: 'expense-file-001',
        name: '长沙出差交通发票.pdf',
        status: '已上传',
        type: '费用凭证',
        updatedAt: '2026-06-12'
      }
    ],
    id: 'expense-collection-001',
    kind: '费用报销',
    note: '长沙岳麓首店现场沟通交通费用。',
    occurredAt: '2026-06-12',
    operationRecords: [
      {
        action: '提交报销',
        actor: '李明',
        id: 'expense-op-001',
        object: 'EC-202606-001',
        summary: '提交差旅交通报销 486.50 元',
        time: '2026-06-12 18:20'
      },
      {
        action: '财务确认',
        actor: '财务专员',
        id: 'expense-op-002',
        object: 'EC-202606-001',
        summary: '费用凭证已确认，待进入付款处理',
        time: '2026-06-13 10:10'
      }
    ],
    originalType: '电子原件',
    paperStatus: '无需提交',
    paymentMethod: '微信',
    relatedTarget: '新岚茶集 / 长沙岳麓首店',
    status: '已确认',
    title: '长沙现场交通费',
    updatedAt: '2026-06-13 10:10'
  },
  {
    amount: 9800,
    category: '客户回款',
    code: 'EC-202606-002',
    collectionMethod: '微信',
    customerName: '湖北星际装饰有限公司',
    files: [
      {
        id: 'collection-file-001',
        name: '星际空间客户付款截图.png',
        status: '已上传',
        type: '收款凭证',
        updatedAt: '2026-06-14'
      }
    ],
    id: 'expense-collection-002',
    kind: '代收登记',
    note: '客户现场先转给员工，需转入公司对公账户。',
    occurredAt: '2026-06-14',
    operationRecords: [
      {
        action: '提交代收',
        actor: '李明',
        id: 'collection-op-001',
        object: 'EC-202606-002',
        summary: '登记客户代收 9,800.00 元',
        time: '2026-06-14 15:30'
      }
    ],
    relatedReceivableNo: 'AR-202606-001',
    publicAccountId: getFinanceSeedPublicAccountRef().publicAccountId,
    status: '待复核',
    title: '星际空间客户回款',
    transferFiles: [
      {
        id: 'collection-transfer-file-001',
        name: '星际空间客户款转入对公截图.png',
        status: '已上传',
        type: '转入凭证',
        updatedAt: '2026-06-14'
      }
    ],
    updatedAt: '2026-06-14 15:30'
  },
  {
    amount: 1200,
    category: '客户回款',
    code: 'EC-202606-004',
    collectionMethod: '银行转账',
    customerName: '湖南新岚餐饮管理有限公司',
    files: [],
    id: 'expense-collection-004',
    kind: '代收登记',
    note: '客户已确认付款安排，等待员工完成转入对公后提交复核。',
    occurredAt: '2026-06-15',
    operationRecords: [
      {
        action: '保存草稿',
        actor: '李明',
        id: 'collection-op-004',
        object: 'EC-202606-004',
        summary: '保存代收登记草稿 1,200.00 元',
        time: '2026-06-15 09:20'
      }
    ],
    relatedReceivableNo: 'AR-202606-001',
    publicAccountId: '',
    status: '草稿',
    title: '新岚客户临时代收',
    transferFiles: [],
    updatedAt: '2026-06-15 09:20'
  },
  {
    amount: 268,
    category: '办公费用',
    code: 'EC-202606-003',
    files: [],
    id: 'expense-collection-003',
    kind: '费用报销',
    note: '缺少纸质小票原件，需补交后重新提交。',
    occurredAt: '2026-06-10',
    operationRecords: [
      {
        action: '退回修改',
        actor: '财务专员',
        id: 'expense-op-003',
        object: 'EC-202606-003',
        summary: '请补充纸质小票原件并重新提交',
        time: '2026-06-11 09:40'
      }
    ],
    originalType: '纸质原件',
    paperStatus: '待提交',
    paymentMethod: '现金',
    relatedTarget: '办公室用品',
    status: '退回修改',
    title: '门店样品包装材料',
    updatedAt: '2026-06-11 09:40'
  }
];

export function getMyWorkExpenseCategoryOptions(primaryCategoryId?: string) {
  return financeSecondaryCategorySeeds
    .filter((category) => (
      category.status === '启用' &&
      category.direction === '支出' &&
      category.includeInReport &&
      category.defaultSourceType === '报销单' &&
      (!primaryCategoryId || category.primaryId === primaryCategoryId)
    ))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getMyWorkExpensePrimaryCategoryOptions() {
  const secondaryRows = getMyWorkExpenseCategoryOptions();
  const primaryIds = new Set(secondaryRows.map((category) => category.primaryId));

  return financePrimaryCategorySeeds
    .filter((category) => category.status === '启用' && category.direction === '支出' && primaryIds.has(category.id))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getMyWorkExpenseSecondaryCategory(category: FinanceTransactionCategory) {
  return getMyWorkExpenseCategoryOptions().find((categoryOption) => categoryOption.name === category);
}

export function getMyWorkExpensePrimaryCategoryId(category: FinanceTransactionCategory) {
  return getMyWorkExpenseSecondaryCategory(category)?.primaryId ?? getDefaultMyWorkExpensePrimaryCategoryId();
}

export function getMyWorkExpensePrimaryCategoryName(primaryCategoryId: string) {
  return financePrimaryCategorySeeds.find((category) => category.id === primaryCategoryId)?.name ?? '-';
}

export function getDefaultMyWorkExpensePrimaryCategoryId() {
  return getMyWorkExpenseSecondaryCategory('差旅交通')?.primaryId ?? getMyWorkExpensePrimaryCategoryOptions()[0]?.id ?? '';
}

export function getDefaultMyWorkExpenseCategory(primaryCategoryId = getDefaultMyWorkExpensePrimaryCategoryId()) {
  return (
    getMyWorkExpenseCategoryOptions(primaryCategoryId).find((category) => category.name === '差旅交通')?.name ??
    getMyWorkExpenseCategoryOptions(primaryCategoryId)[0]?.name ??
    getMyWorkExpenseCategoryOptions()[0]?.name ??
    ''
  );
}

export function getMyWorkExpenseCategoryOptionByName(category: FinanceTransactionCategory): FinanceSecondaryCategoryConfig | undefined {
  return getMyWorkExpenseCategoryOptions().find((categoryOption) => categoryOption.name === category);
}

export function createMyWorkExpenseCollectionForm(
  record?: MyWorkExpenseCollectionRecord
): MyWorkExpenseCollectionFormValue {
  const primaryCategoryId = record?.category ? getMyWorkExpensePrimaryCategoryId(record.category) : getDefaultMyWorkExpensePrimaryCategoryId();

  return {
    amount: record?.amount ?? 0,
    category: record?.category ?? getDefaultMyWorkExpenseCategory(primaryCategoryId),
    collectionMethod: record?.collectionMethod ?? '银行转账',
    customerName: record?.customerName ?? '',
    files: record?.files ?? [],
    kind: record?.kind ?? '费用报销',
    note: record?.note ?? '',
    occurredAt: record?.occurredAt ?? financeToday,
    originalType: record?.originalType ?? '电子原件',
    paymentMethod: record?.paymentMethod ?? '微信',
    primaryCategoryId,
    relatedReceivableNo: record?.relatedReceivableNo ?? '',
    relatedTarget: record?.relatedTarget ?? '',
    publicAccountId: record?.publicAccountId ?? '',
    title: record?.title ?? '',
    transferFiles: record?.transferFiles ?? []
  };
}

export function normalizeMyWorkPaperStatus(originalType: MyWorkExpenseOriginalType, currentStatus?: MyWorkExpensePaperStatus) {
  if (originalType === '电子原件') {
    return '无需提交';
  }

  if (originalType === '纸质原件') {
    return currentStatus && currentStatus !== '无需提交' && currentStatus !== '已归档' ? currentStatus : '待提交';
  }

  return '无需提交';
}

export function isMyWorkExpenseCollectionDraftSavable(form: MyWorkExpenseCollectionFormValue) {
  return Boolean(
    form.title.trim() ||
      form.amount > 0 ||
      form.note.trim() ||
      form.files.length > 0 ||
      form.transferFiles.length > 0 ||
      form.customerName.trim() ||
      form.relatedTarget.trim()
  );
}

export function isMyWorkExpenseCollectionFormValid(form: MyWorkExpenseCollectionFormValue) {
  const hasCommonFields = form.title.trim() !== '' && form.amount > 0 && form.occurredAt.trim() !== '';

  if (!hasCommonFields) {
    return false;
  }

  if (form.kind === '费用报销') {
    const needsMissingVoucherReason = form.originalType === '无正式票据';

    return (
      form.primaryCategoryId.trim() !== '' &&
      form.category.trim() !== '' &&
      form.paymentMethod.trim() !== '' &&
      form.files.length > 0 &&
      (!needsMissingVoucherReason || form.note.trim() !== '')
    );
  }

  return (
    form.customerName.trim() !== '' &&
    form.collectionMethod.trim() !== '' &&
    form.publicAccountId.trim() !== '' &&
    form.transferFiles.length > 0
  );
}

export function buildMyWorkCollectionReceivableOptions(records: FinanceReceivablePayableRecord[]): MyWorkReceivableOption[] {
  return records
    .filter(
      (record) =>
        isFinanceReceivablePayableConfirmed(record) &&
        record.direction === '应收' &&
        getReceivablePayableOutstandingAmount(record) > 0
    )
    .map((record) => ({
      customerName: record.counterparty,
      label: `${record.counterparty} / ${record.sourceTitle} / 未收 ${formatMoney(getReceivablePayableOutstandingAmount(record))}`,
      sourceTitle: record.sourceTitle,
      value: record.documentNo
    }));
}

export function isMyWorkExpenseCollectionRecordInDateScope(
  record: MyWorkExpenseCollectionRecord,
  scope: DateScopeFilterValue
) {
  const range = getDateScopeRange(scope, myWorkExpenseCollectionCurrentMonth);
  return !range || (record.occurredAt >= range.startDate && record.occurredAt <= range.endDate);
}

export function matchesMyWorkExpenseCollectionFilters(
  record: MyWorkExpenseCollectionRecord,
  filters: MyWorkExpenseCollectionFilters
) {
  const keyword = filters.keyword.trim().toLowerCase();

  if (!isMyWorkExpenseCollectionRecordInDateScope(record, filters.occurredTime)) {
    return false;
  }

  if (filters.kind !== '全部' && record.kind !== filters.kind) {
    return false;
  }

  if (filters.status !== '全部' && record.status !== filters.status) {
    return false;
  }

  if (!keyword) {
    return true;
  }

  return [
    record.title,
    record.category,
    record.relatedTarget,
    record.customerName,
    record.relatedReceivableNo,
    record.note,
    record.paymentMethod,
    record.publicAccountId
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

export function buildMyWorkExpenseCollectionMetrics(records: MyWorkExpenseCollectionRecord[]): MyWorkExpenseCollectionMetrics {
  return {
    draftCount: records.filter((record) => record.status === '草稿').length,
    confirmedCount: records.filter((record) => record.status === '已确认').length,
    financeConfirmCount: records.filter((record) => record.status === '待复核').length,
    pendingApprovalCount: records.filter((record) => record.status === '待审核').length,
    pendingMyActionCount: records.filter((record) => (
      record.status === '草稿' ||
      record.status === '退回修改' ||
      (record.kind === '费用报销' && record.paperStatus === '待提交')
    )).length,
    pendingReviewCount: records.filter((record) => record.status === '待复核').length,
    totalCount: records.length
  };
}

function getSubmittedStatus(kind: MyWorkExpenseCollectionKind): MyWorkExpenseCollectionStatus {
  return kind === '费用报销' ? '待审核' : '待复核';
}

function buildMyWorkExpenseCollectionOperation({
  action,
  amount,
  code,
  id,
  kind,
  summaryPrefix
}: {
  action: string;
  amount: number;
  code: string;
  id: string;
  kind: MyWorkExpenseCollectionKind;
  summaryPrefix: string;
}): OperationRecord {
  return {
    action,
    actor: '李明',
    id,
    object: code,
    summary: `${summaryPrefix}${kind} ${formatMoney(amount)}`,
    time: `${financeToday} 09:00`
  };
}

export function createMyWorkExpenseCollectionRecordFromForm(
  form: MyWorkExpenseCollectionFormValue,
  sequence: number,
  mode: 'draft' | 'submit' = 'submit'
): MyWorkExpenseCollectionRecord {
  const code = `EC-${form.occurredAt.slice(0, 7).replace('-', '')}-${String(sequence).padStart(3, '0')}`;
  const paperStatus = normalizeMyWorkPaperStatus(form.originalType);
  const status: MyWorkExpenseCollectionStatus = mode === 'draft' ? '草稿' : getSubmittedStatus(form.kind);

  return {
    amount: form.amount,
    category: form.kind === '费用报销' ? form.category : '客户回款',
    code,
    collectionMethod: form.kind === '代收登记' ? form.collectionMethod : undefined,
    customerName: form.kind === '代收登记' ? form.customerName : undefined,
    files: form.files,
    id: `expense-collection-${form.occurredAt.replaceAll('-', '')}-${String(sequence).padStart(3, '0')}`,
    kind: form.kind,
    note: form.note,
    occurredAt: form.occurredAt,
    operationRecords: [
      buildMyWorkExpenseCollectionOperation({
        action: mode === 'draft' ? '保存草稿' : form.kind === '费用报销' ? '提交报销' : '提交代收',
        amount: form.amount,
        code,
        id: `expense-collection-op-${form.occurredAt.replaceAll('-', '')}-${String(sequence).padStart(3, '0')}`,
        kind: form.kind,
        summaryPrefix: mode === 'draft' ? '保存草稿：' : '提交'
      })
    ],
    originalType: form.kind === '费用报销' ? form.originalType : undefined,
    paymentMethod: form.kind === '费用报销' ? form.paymentMethod : undefined,
    paperStatus: form.kind === '费用报销' ? paperStatus : undefined,
    relatedReceivableNo: form.kind === '代收登记' ? form.relatedReceivableNo : undefined,
    relatedTarget: form.kind === '费用报销' ? form.relatedTarget : undefined,
    publicAccountId: form.kind === '代收登记' ? form.publicAccountId : undefined,
    status,
    title: form.title,
    transferFiles: form.kind === '代收登记' ? form.transferFiles : undefined,
    updatedAt: `${financeToday} 09:00`
  };
}

export function resubmitMyWorkExpenseCollectionRecordFromForm(
  record: MyWorkExpenseCollectionRecord,
  form: MyWorkExpenseCollectionFormValue,
  mode: 'draft' | 'submit' = 'submit'
): MyWorkExpenseCollectionRecord {
  const paperStatus = normalizeMyWorkPaperStatus(form.originalType, record.paperStatus);
  const status: MyWorkExpenseCollectionStatus = mode === 'draft' ? '草稿' : getSubmittedStatus(form.kind);

  return {
    ...record,
    amount: form.amount,
    category: form.kind === '费用报销' ? form.category : '客户回款',
    collectionMethod: form.kind === '代收登记' ? form.collectionMethod : undefined,
    customerName: form.kind === '代收登记' ? form.customerName : undefined,
    files: form.files,
    kind: form.kind,
    note: form.note,
    occurredAt: form.occurredAt,
    operationRecords: [
      buildMyWorkExpenseCollectionOperation({
        action: mode === 'draft' ? '保存草稿' : '重新提交',
        amount: form.amount,
        code: record.code,
        id: `${record.id}-${mode === 'draft' ? 'draft' : 'resubmit'}-${record.operationRecords.length + 1}`,
        kind: form.kind,
        summaryPrefix: mode === 'draft' ? '保存草稿：' : '重新提交'
      }),
      ...record.operationRecords
    ],
    originalType: form.kind === '费用报销' ? form.originalType : undefined,
    paymentMethod: form.kind === '费用报销' ? form.paymentMethod : undefined,
    paperStatus: form.kind === '费用报销' ? paperStatus : undefined,
    relatedReceivableNo: form.kind === '代收登记' ? form.relatedReceivableNo : undefined,
    relatedTarget: form.kind === '费用报销' ? form.relatedTarget : undefined,
    publicAccountId: form.kind === '代收登记' ? form.publicAccountId : undefined,
    status,
    title: form.title,
    transferFiles: form.kind === '代收登记' ? form.transferFiles : undefined,
    updatedAt: `${financeToday} 09:00`
  };
}

function buildNextMyWorkFinanceTransactionNo(records: FinanceTransactionRecord[], occurredAt: string) {
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

export function linkMyWorkCollectionFinanceTransaction(
  record: MyWorkExpenseCollectionRecord,
  transactionNo: string
): MyWorkExpenseCollectionRecord {
  return {
    ...record,
    linkedFinanceTransactionNo: transactionNo,
    operationRecords: [
      {
        action: '进入流水复核',
        actor: '系统',
        id: `${record.id}-finance-link-${record.operationRecords.length + 1}`,
        object: record.code,
        summary: `生成待复核收款流水 ${transactionNo}`,
        time: `${financeToday} 09:00`
      },
      ...record.operationRecords
    ]
  };
}

export function buildFinanceTransactionFromMyWorkCollection(
  record: MyWorkExpenseCollectionRecord,
  financeRows: FinanceTransactionRecord[],
  publicAccountRef: PublicAccountRef
): FinanceTransactionRecord | undefined {
  if (
    record.kind !== '代收登记' ||
    record.status !== '待复核' ||
    !record.publicAccountId ||
    record.publicAccountId !== publicAccountRef.publicAccountId ||
    !record.transferFiles?.length
  ) {
    return undefined;
  }

  const transactionNo = buildNextMyWorkFinanceTransactionNo(financeRows, record.occurredAt);
  const categorySnapshot = getFinanceCategorySnapshot('客户回款');
  const paymentMethod = record.collectionMethod === '现金' ? '现金暂收' : '员工代收';

  return {
    accountingPeriod: getAccountingPeriod(record.occurredAt),
    amount: record.amount,
    category: '客户回款',
    categorySnapshot,
    counterparty: record.customerName ?? '未填写客户',
    counterpartyType: '客户',
    currency: 'CNY',
    direction: '收入',
    files: [
      ...(record.files ?? []),
      ...(record.transferFiles ?? [])
    ].map((file) => ({
      ...file,
      status: '已上传' as const,
      updatedAt: financeToday
    })),
    handler: '李明',
    id: `fin-flow-${record.id}`,
    invoiceDeclarationStatus: '待关联发票',
    note: record.note,
    occurredAt: record.occurredAt,
    operationRecords: [
      {
        action: '登记代收流水',
        actor: '李明',
        id: `${record.id}-finance-op-001`,
        object: transactionNo,
        summary: `代收已转入公司账户，提交流水复核 ${formatMoney(record.amount)}`,
        time: `${financeToday} 09:00`
      }
    ],
    paymentMethod,
    publicAccountId: publicAccountRef.publicAccountId,
    publicAccountSnapshot: publicAccountRef.publicAccountSnapshot,
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    relatedReceivableNo: record.relatedReceivableNo,
    reviewDueAt: getDefaultFinanceReviewDueAt(record.occurredAt),
    sourceNo: record.code,
    sourceTitle: record.title,
    sourceType: paymentMethod === '现金暂收' ? '现金暂收流水' : '员工代收流水',
    status: '待复核',
    transactionNo,
    updatedAt: `${financeToday} 09:00`,
    voucherStatus: '已上传'
  };
}

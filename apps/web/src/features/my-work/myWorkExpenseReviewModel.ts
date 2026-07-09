import type { OperationRecord } from '../../components/OperationRecordTable';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import { getFinanceCategorySnapshot } from '../finance/financeData';
import type { FinanceReceivablePayableRecord } from '../finance/financeReceivablesPayablesData';
import { getDefaultReceivablePayableTaxBasis } from '../finance/financeTaxBasisModel';
import { financeToday, formatMoney, getAccountingPeriod } from '../finance/financeUtils';
import {
  getMyWorkExpensePrimaryCategoryId,
  getMyWorkExpensePrimaryCategoryName,
  myWorkExpenseCollectionSeedRecords,
  type MyWorkExpenseCollectionRecord,
  type MyWorkExpenseOriginalType,
  type MyWorkExpensePaymentMethod
} from './myWorkExpenseCollectionModel';

export type MyWorkExpenseReviewStatus = '待审核' | '需调整' | '已通过';

export type MyWorkExpenseReviewRecord = {
  amount: number;
  category: string;
  code: string;
  dueAt: string;
  files: RelatedFileRecord[];
  id: string;
  note: string;
  occurredAt: string;
  operationRecords: OperationRecord[];
  originalType: MyWorkExpenseOriginalType;
  paymentMethod: MyWorkExpensePaymentMethod;
  relatedTarget: string;
  reviewStatus: MyWorkExpenseReviewStatus;
  submittedAt: string;
  submitterName: string;
  title: string;
  updatedAt: string;
};

export type MyWorkExpenseReviewMetrics = {
  overdueCount: number;
  returnedCount: number;
  pendingCount: number;
};

export type MyWorkExpenseReviewDecision = {
  reviewerName: string;
  returnedReason?: string;
};

export const myWorkExpenseReviewToday = financeToday;

function toReviewRecord(record: MyWorkExpenseCollectionRecord, overrides: Partial<MyWorkExpenseReviewRecord> = {}): MyWorkExpenseReviewRecord {
  return {
    amount: record.amount,
    category: record.category,
    code: record.code,
    dueAt: record.occurredAt,
    files: record.files,
    id: `review-${record.id}`,
    note: record.note,
    occurredAt: record.occurredAt,
    operationRecords: record.operationRecords,
    originalType: record.originalType ?? '电子原件',
    paymentMethod: record.paymentMethod ?? '微信',
    relatedTarget: record.relatedTarget ?? '-',
    reviewStatus: record.status === '退回修改' ? '需调整' : '待审核',
    submittedAt: record.updatedAt,
    submitterName: '李明',
    title: record.title,
    updatedAt: record.updatedAt,
    ...overrides
  };
}

const expenseSeedRows = myWorkExpenseCollectionSeedRecords.filter((record) => record.kind === '费用报销');

export const myWorkExpenseReviewSeedRecords: MyWorkExpenseReviewRecord[] = [
  toReviewRecord(expenseSeedRows[0], {
    dueAt: '2026-06-15',
    reviewStatus: '待审核',
    submittedAt: '2026-06-12 18:20'
  }),
  toReviewRecord(expenseSeedRows[1], {
    dueAt: '2026-06-12',
    reviewStatus: '需调整',
    submittedAt: '2026-06-10 17:10'
  }),
  {
    amount: 320,
    category: '办公费用',
    code: 'EC-202606-004',
    dueAt: '2026-06-18',
    files: [
      {
        id: 'expense-review-file-001',
        name: '办公用品发票.pdf',
        status: '已上传',
        type: '费用凭证',
        updatedAt: '2026-06-16'
      }
    ],
    id: 'review-expense-collection-004',
    note: '会议资料打印和办公用品补充。',
    occurredAt: '2026-06-16',
    operationRecords: [
      {
        action: '提交报销',
        actor: '示例全职 A',
        id: 'expense-review-op-001',
        object: 'EC-202606-004',
        summary: '提交办公费用报销 320.00 元',
        time: '2026-06-16 14:30'
      }
    ],
    originalType: '电子原件',
    paymentMethod: '银行卡',
    relatedTarget: '办公室用品',
    reviewStatus: '待审核',
    submittedAt: '2026-06-16 14:30',
    submitterName: '示例全职 A',
    title: '会议资料与办公用品',
    updatedAt: '2026-06-16 14:30'
  }
];

export function getExpenseReviewCategoryLabel(record: Pick<MyWorkExpenseReviewRecord, 'category'>) {
  const primaryCategoryId = getMyWorkExpensePrimaryCategoryId(record.category);

  return `${getMyWorkExpensePrimaryCategoryName(primaryCategoryId)} / ${record.category}`;
}

export function isExpenseReviewOverdue(record: Pick<MyWorkExpenseReviewRecord, 'dueAt' | 'reviewStatus'>, today = myWorkExpenseReviewToday) {
  return record.reviewStatus === '待审核' && record.dueAt < today;
}

export function buildMyWorkExpenseReviewQueue(records: MyWorkExpenseReviewRecord[]) {
  return records
    .filter((record) => record.reviewStatus === '待审核')
    .sort(
      (left, right) =>
        Number(isExpenseReviewOverdue(right)) - Number(isExpenseReviewOverdue(left)) ||
        left.dueAt.localeCompare(right.dueAt) ||
        left.submittedAt.localeCompare(right.submittedAt)
    );
}

export function buildMyWorkExpenseReviewMetrics(records: MyWorkExpenseReviewRecord[]): MyWorkExpenseReviewMetrics {
  return {
    overdueCount: records.filter((record) => isExpenseReviewOverdue(record)).length,
    pendingCount: records.filter((record) => record.reviewStatus === '待审核').length,
    returnedCount: records.filter((record) => record.reviewStatus === '需调整').length
  };
}

export function approveExpenseReviewRecord(record: MyWorkExpenseReviewRecord, decision: MyWorkExpenseReviewDecision): MyWorkExpenseReviewRecord {
  return {
    ...record,
    operationRecords: [
      {
        action: '审核通过',
        actor: decision.reviewerName,
        id: `${record.id}-approve-${record.operationRecords.length + 1}`,
        object: record.code,
        summary: `通过报销审核 ${formatMoney(record.amount)}`,
        time: `${financeToday} 09:00`
      },
      ...record.operationRecords
    ],
    reviewStatus: '已通过',
    updatedAt: `${financeToday} 09:00`
  };
}

function buildNextExpensePayableDocumentNo(records: FinanceReceivablePayableRecord[], accountingPeriod: string) {
  const periodCode = accountingPeriod.replace('-', '');
  const prefix = `AP-${periodCode}-`;
  const maxSequence = records.reduce((max, record) => {
    if (!record.documentNo.startsWith(prefix)) {
      return max;
    }

    const sequence = Number(record.documentNo.slice(prefix.length));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `${prefix}${String(maxSequence + 1).padStart(3, '0')}`;
}

export function buildReceivablePayableFromExpenseReview(
  record: MyWorkExpenseReviewRecord,
  existingRows: FinanceReceivablePayableRecord[]
): FinanceReceivablePayableRecord {
  const accountingPeriod = getAccountingPeriod(record.occurredAt);
  const categorySnapshot = getFinanceCategorySnapshot(record.category);
  const documentNo = buildNextExpensePayableDocumentNo(existingRows, accountingPeriod);
  const sourceTitle = `${record.submitterName} ${record.title}`;
  const taxSource = {
    amount: record.amount,
    direction: '应付' as const,
    sourceType: '员工报销'
  };

  return {
    accountingPeriod,
    amount: record.amount,
    category: record.category,
    categorySnapshot,
    confirmDate: financeToday,
    confirmationStatus: '已确认',
    counterparty: record.submitterName,
    counterpartyType: '员工',
    direction: '应付',
    documentNo,
    dueDate: financeToday,
    files: record.files.map((file) => ({ ...file, status: '已上传', updatedAt: financeToday })),
    id: `ap-expense-${record.id}`,
    linkedTransactionNos: [],
    note: record.note,
    operationRecords: [
      {
        action: '生成应付',
        actor: '系统',
        id: `rp-op-expense-${record.id}`,
        object: documentNo,
        summary: `费用报销审核通过后生成应付 ${formatMoney(record.amount)}`,
        time: `${financeToday} 09:00`
      },
      ...record.operationRecords
    ],
    owner: '李明',
    reportAggregation: categorySnapshot.reportAggregation,
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: record.code,
    sourceTitle,
    sourceType: '员工报销',
    taxBasis: getDefaultReceivablePayableTaxBasis(taxSource),
    updatedAt: `${financeToday} 09:00`
  };
}

export function returnExpenseReviewRecord(record: MyWorkExpenseReviewRecord, decision: MyWorkExpenseReviewDecision): MyWorkExpenseReviewRecord {
  const reason = decision.returnedReason?.trim() || '请补充或修正报销信息';

  return {
    ...record,
    note: record.note,
    operationRecords: [
      {
        action: '退回修改',
        actor: decision.reviewerName,
        id: `${record.id}-return-${record.operationRecords.length + 1}`,
        object: record.code,
        summary: reason,
        time: `${financeToday} 09:00`
      },
      ...record.operationRecords
    ],
    reviewStatus: '需调整',
    updatedAt: `${financeToday} 09:00`
  };
}

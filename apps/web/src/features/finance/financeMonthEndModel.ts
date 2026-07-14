import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import type { OperationRecord } from '../../components/OperationRecordTable';
import type { AccountingVoucherLineSide } from './financeAccountingVoucherModel';
import { financeFixedAssetRecords, financePrepaidExpenseRecords } from './financeMonthEndSourceData';
import { financeToday } from './financeUtils';

export type FinanceMonthEndMatterType = '固定资产折旧' | '待摊费用摊销' | '收入确认';
export type FinanceMonthEndMatterStatus = '待确认' | '待记账' | '已记账' | '无需处理';

export type FinanceMonthEndMatterRecord = {
  accountingPeriod: string;
  amount: number;
  creditSubjectCode: string;
  debitSubjectCode: string;
  id: string;
  note: string;
  operationRecords: OperationRecord[];
  sourceFiles: RelatedFileRecord[];
  sourceModule: '固定资产台账' | '待摊事项' | '应收应付';
  sourceNo: string;
  sourceTitle: string;
  status: FinanceMonthEndMatterStatus;
  title: string;
  type: FinanceMonthEndMatterType;
  voucherDate: string;
};

export type FinanceMonthEndMatterMetrics = {
  bookedCount: number;
  pendingConfirmationCount: number;
  pendingBookingCount: number;
  totalCount: number;
};

export const financeMonthEndMatterStatusTone = {
  待确认: 'amber',
  待记账: 'blue',
  已记账: 'green',
  无需处理: 'gray'
} as const;

export const financeMonthEndMatterTypeTone = {
  固定资产折旧: 'blue',
  待摊费用摊销: 'purple',
  收入确认: 'green'
} as const;

export const financeMonthEndMatterRecords: FinanceMonthEndMatterRecord[] = [
  {
    accountingPeriod: '2026-06',
    amount: financeFixedAssetRecords[0].monthlyDepreciation,
    creditSubjectCode: '1602',
    debitSubjectCode: '5602',
    id: 'month-end-depreciation-202606-001',
    note: '办公设计工作站自 2026-01 启用，按 60 个月直线法计提；本期折旧已由资产台账计算。',
    operationRecords: [
      {
        action: '生成月末事项',
        actor: '系统',
        id: 'month-end-op-depreciation-001',
        object: 'FA-2026-001',
        summary: '根据固定资产卡片生成 2026-06 折旧候选 500.00 元',
        time: '2026-06-30 09:00'
      }
    ],
    sourceFiles: financeFixedAssetRecords[0].files,
    sourceModule: '固定资产台账',
    sourceNo: financeFixedAssetRecords[0].assetNo,
    sourceTitle: financeFixedAssetRecords[0].title,
    status: '待确认',
    title: '办公设计工作站 2026-06 折旧',
    type: '固定资产折旧',
    voucherDate: '2026-06-30'
  },
  {
    accountingPeriod: '2026-06',
    amount: financePrepaidExpenseRecords[0].monthlyAmortization,
    creditSubjectCode: '1123',
    debitSubjectCode: '5602.03',
    id: 'month-end-amortization-202606-001',
    note: '年度设计协同软件服务已按受益期间分摊，本期为第 6 期。',
    operationRecords: [
      {
        action: '生成月末事项',
        actor: '系统',
        id: 'month-end-op-amortization-001',
        object: 'PP-2026-001',
        summary: '根据待摊事项生成 2026-06 摊销候选 600.00 元',
        time: '2026-06-30 09:00'
      }
    ],
    sourceFiles: financePrepaidExpenseRecords[0].files,
    sourceModule: '待摊事项',
    sourceNo: financePrepaidExpenseRecords[0].sourceNo,
    sourceTitle: financePrepaidExpenseRecords[0].title,
    status: '待确认',
    title: '设计协同软件年度服务 2026-06 摊销',
    type: '待摊费用摊销',
    voucherDate: '2026-06-30'
  },
  {
    accountingPeriod: '2026-06',
    amount: 12800,
    creditSubjectCode: '5001',
    debitSubjectCode: '1122',
    id: 'month-end-revenue-202606-001',
    note: '项目阶段验收已由应收应付生成权责凭证，本月无需重复确认收入。',
    operationRecords: [
      {
        action: '核对收入来源',
        actor: '系统',
        id: 'month-end-op-revenue-001',
        object: 'AR-202606-003',
        summary: '已关联项目阶段确认 AR-202606-003，不重复生成收入凭证',
        time: '2026-06-30 09:05'
      }
    ],
    sourceFiles: [
      {
        id: 'month-end-file-revenue-001',
        name: '光谷商业空间_方案确认单.pdf',
        status: '已归档',
        type: '验收确认单',
        updatedAt: '2026-06-12'
      }
    ],
    sourceModule: '应收应付',
    sourceNo: 'AR-202606-003',
    sourceTitle: '光谷商业空间方案阶段权责确认',
    status: '无需处理',
    title: '光谷商业空间方案阶段收入确认',
    type: '收入确认',
    voucherDate: '2026-06-30'
  }
];

export function buildFinanceMonthEndMatterMetrics(rows: FinanceMonthEndMatterRecord[]): FinanceMonthEndMatterMetrics {
  return {
    bookedCount: rows.filter((row) => row.status === '已记账').length,
    pendingConfirmationCount: rows.filter((row) => row.status === '待确认').length,
    pendingBookingCount: rows.filter((row) => row.status === '待记账').length,
    totalCount: rows.length
  };
}

export function isFinanceMonthEndMatterVoucherReady(record: FinanceMonthEndMatterRecord) {
  return record.status === '待记账' || record.status === '已记账';
}

export function confirmFinanceMonthEndMatter(record: FinanceMonthEndMatterRecord, actor = '李明'): FinanceMonthEndMatterRecord {
  if (record.status !== '待确认') {
    return record;
  }

  return {
    ...record,
    operationRecords: [
      {
        action: '确认月末事项',
        actor,
        id: `month-end-op-confirm-${record.id}-${Date.now()}`,
        object: record.sourceNo,
        summary: `确认${record.type} ${record.amount.toFixed(2)} 元，生成待记账凭证`,
        time: `${financeToday} 16:00`
      },
      ...record.operationRecords
    ],
    status: '待记账'
  };
}

export function markFinanceMonthEndMatterBooked(record: FinanceMonthEndMatterRecord, actor = '李明'): FinanceMonthEndMatterRecord {
  if (record.status !== '待记账') {
    return record;
  }

  return {
    ...record,
    operationRecords: [
      {
        action: '凭证已记账',
        actor,
        id: `month-end-op-book-${record.id}-${Date.now()}`,
        object: record.sourceNo,
        summary: `${record.type}凭证已记账并进入总账`,
        time: `${financeToday} 17:10`
      },
      ...record.operationRecords
    ],
    status: '已记账'
  };
}

export function getFinanceMonthEndMatterVoucherLines(record: FinanceMonthEndMatterRecord) {
  return [
    {
      amount: record.amount,
      auxiliary: record.sourceNo,
      side: '借方' as AccountingVoucherLineSide,
      subjectCode: record.debitSubjectCode,
      summary: record.title
    },
    {
      amount: record.amount,
      auxiliary: record.sourceNo,
      side: '贷方' as AccountingVoucherLineSide,
      subjectCode: record.creditSubjectCode,
      summary: record.title
    }
  ];
}

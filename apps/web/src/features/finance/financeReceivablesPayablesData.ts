import type { OperationRecord } from '../../components/OperationRecordTable';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import type { StatusTagTone } from '../../components/Detail';
import type { FinanceCategorySnapshot, FinanceReportAggregation, FinanceTransactionCategory } from './financeData';
import { getFinanceCategorySnapshot } from './financeData';
import {
  getDefaultReceivablePayableTaxBasis,
  type FinanceTaxBasis,
  type FinanceTaxBasisSource
} from './financeTaxBasisModel';

export type FinanceReceivablePayableDirection = '应收' | '应付';
export type FinanceReceivablePayableConfirmationStatus = '待确认' | '已确认' | '已作废';
export type FinanceReceivablePayableSettlementStatus = '未结清' | '部分结清' | '已结清';
export type FinanceReceivablePayableReviewProgressStatus = '待复核' | '部分待复核';
export type FinanceReceivablePayableTaxBasisSource = FinanceTaxBasisSource;
export type FinanceReceivablePayableCounterpartyType = '客户' | '员工' | '外协' | '供应商' | '内部';
export type FinanceReceivablePayableSourceType =
  | '合同应收'
  | '项目阶段确认'
  | '月度绩效'
  | '季度绩效'
  | '薪酬发放'
  | '员工报销'
  | '外协结算'
  | '材料采购'
  | '运营费用';

export type FinanceReceivablePayableTaxBasis = FinanceTaxBasis;

export type FinanceReceivablePayableRecord = {
  accountingPeriod: string;
  amount: number;
  category: FinanceTransactionCategory;
  categorySnapshot: FinanceCategorySnapshot;
  confirmDate: string;
  confirmationStatus: FinanceReceivablePayableConfirmationStatus;
  counterparty: string;
  counterpartyType: FinanceReceivablePayableCounterpartyType;
  direction: FinanceReceivablePayableDirection;
  documentNo: string;
  dueDate: string;
  files: RelatedFileRecord[];
  id: string;
  linkedTransactionNos: string[];
  note: string;
  operationRecords: OperationRecord[];
  owner: string;
  reportAggregation: FinanceReportAggregation;
  settledAmount: number;
  settlementStatus: FinanceReceivablePayableSettlementStatus;
  sourceNo: string;
  sourceTitle: string;
  sourceType: FinanceReceivablePayableSourceType;
  taxBasis: FinanceReceivablePayableTaxBasis;
  updatedAt: string;
};

export const receivablePayableDirectionTone = {
  应收: 'green',
  应付: 'red'
} as const satisfies Record<FinanceReceivablePayableDirection, StatusTagTone>;

export const receivablePayableConfirmationStatusTone = {
  待确认: 'amber',
  已确认: 'green',
  已作废: 'gray'
} as const satisfies Record<FinanceReceivablePayableConfirmationStatus, StatusTagTone>;

export const receivablePayableSettlementStatusTone = {
  未结清: 'amber',
  部分结清: 'blue',
  已结清: 'green'
} as const satisfies Record<FinanceReceivablePayableSettlementStatus, StatusTagTone>;

export const receivablePayableReviewProgressTone = {
  待复核: 'blue',
  部分待复核: 'blue'
} as const satisfies Record<FinanceReceivablePayableReviewProgressStatus, StatusTagTone>;

export const financeReceivablePayableDirectionOptions: FinanceReceivablePayableDirection[] = ['应收', '应付'];

export const financeReceivablePayableConfirmationStatusOptions: FinanceReceivablePayableConfirmationStatus[] = [
  '待确认',
  '已确认',
  '已作废'
];

export const financeReceivablePayableSettlementStatusOptions: FinanceReceivablePayableSettlementStatus[] = [
  '未结清',
  '部分结清',
  '已结清'
];

export const financeReceivablePayableCounterpartyTypeOptions: FinanceReceivablePayableCounterpartyType[] = [
  '客户',
  '员工',
  '外协',
  '供应商',
  '内部'
];

export function getReceivablePayableOutstandingAmount(record: FinanceReceivablePayableRecord) {
  return Math.max(0, record.amount - record.settledAmount);
}

type FinanceReceivablePayableRecordSeed = Omit<FinanceReceivablePayableRecord, 'categorySnapshot' | 'reportAggregation' | 'taxBasis'> & {
  categorySnapshot?: FinanceCategorySnapshot;
  reportAggregation?: FinanceReportAggregation;
  taxBasis?: FinanceReceivablePayableTaxBasis;
};

export const financeReceivablePayableRecords: FinanceReceivablePayableRecord[] = ([
  {
    accountingPeriod: '2026-06',
    amount: 68000,
    category: '客户回款',
    confirmDate: '2026-06-01',
    confirmationStatus: '已确认',
    counterparty: '奈雪华南区域',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-202606-001',
    dueDate: '2026-06-10',
    files: [
      {
        id: 'rp-file-001',
        name: '奈雪华南门店设计服务合同.pdf',
        status: '已上传',
        type: '合同文件',
        updatedAt: '2026-06-01'
      }
    ],
    id: 'ar-202606-001',
    linkedTransactionNos: ['FIN-202606-0001'],
    note: '合同阶段回款已全部收回。',
    operationRecords: [
      {
        id: 'rp-op-001',
        time: '2026-06-01 10:20',
        actor: '系统',
        object: 'AR-202606-001',
        action: '生成应收',
        summary: '根据合同阶段确认生成应收 68,000 元'
      },
      {
        id: 'rp-op-002',
        time: '2026-06-04 09:12',
        actor: '财务复核',
        object: 'AR-202606-001',
        action: '关联流水',
        summary: '关联 FIN-202606-0001 后结清'
      }
    ],
    owner: '李明',
    settledAmount: 68000,
    settlementStatus: '已结清',
    sourceNo: 'CON-2026-001',
    sourceTitle: '奈雪华南门店设计服务合同',
    sourceType: '合同应收',
    updatedAt: '2026-06-04 09:12'
  },
  {
    accountingPeriod: '2026-06',
    amount: 18000,
    category: '客户回款',
    confirmDate: '2026-06-08',
    confirmationStatus: '已确认',
    counterparty: '星河餐饮集团',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-202606-002',
    dueDate: '2026-06-20',
    files: [
      {
        id: 'rp-file-002',
        name: '星河餐饮集团_阶段确认单.pdf',
        status: '已上传',
        type: '确认单',
        updatedAt: '2026-06-08'
      }
    ],
    id: 'ar-202606-002',
    linkedTransactionNos: ['FIN-202606-0005'],
    note: '员工代收 9,800 元，剩余款项待客户支付。',
    operationRecords: [
      {
        id: 'rp-op-003',
        time: '2026-06-08 11:45',
        actor: '系统',
        object: 'AR-202606-002',
        action: '生成应收',
        summary: '根据项目阶段确认生成应收 18,000 元'
      },
      {
        id: 'rp-op-004',
        time: '2026-06-15 09:20',
        actor: '财务复核',
        object: 'AR-202606-002',
        action: '部分收款',
        summary: '关联员工代收流水 9,800 元'
      }
    ],
    owner: '李明',
    settledAmount: 9800,
    settlementStatus: '部分结清',
    sourceNo: 'CON-2026-009',
    sourceTitle: '星河餐饮集团空间设计项目',
    sourceType: '合同应收',
    updatedAt: '2026-06-15 09:20'
  },
  {
    accountingPeriod: '2026-06',
    amount: 12800,
    category: '客户回款',
    confirmDate: '2026-06-12',
    confirmationStatus: '已确认',
    counterparty: '光谷商业空间',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-202606-003',
    dueDate: '2026-06-30',
    files: [
      {
        id: 'rp-file-003',
        name: '光谷商业空间_方案确认单.pdf',
        status: '已上传',
        type: '确认单',
        updatedAt: '2026-06-12'
      }
    ],
    id: 'ar-202606-003',
    linkedTransactionNos: [],
    note: '已完成阶段确认，尚未产生收款流水。',
    operationRecords: [
      {
        id: 'rp-op-005',
        time: '2026-06-12 16:20',
        actor: '系统',
        object: 'AR-202606-003',
        action: '生成应收',
        summary: '根据项目阶段确认生成应收 12,800 元'
      }
    ],
    owner: '李明',
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'PRJ-202606-003',
    sourceTitle: '光谷商业空间方案阶段',
    sourceType: '项目阶段确认',
    updatedAt: '2026-06-12 16:20'
  },
  {
    accountingPeriod: '2026-06',
    amount: 3613.75,
    category: '绩效发放',
    confirmDate: '2026-06-10',
    confirmationStatus: '已确认',
    counterparty: '陈思',
    counterpartyType: '员工',
    direction: '应付',
    documentNo: 'AP-202606-001',
    dueDate: '2026-07-15',
    files: [
      {
        id: 'rp-file-004',
        name: '陈思_2026-06月度绩效确认表.pdf',
        status: '已上传',
        type: '绩效确认',
        updatedAt: '2026-06-10'
      }
    ],
    id: 'ap-202606-001',
    linkedTransactionNos: ['FIN-202606-0002'],
    note: '已登记绩效预发流水，剩余绩效待后续发放。',
    operationRecords: [
      {
        id: 'rp-op-006',
        time: '2026-06-10 10:40',
        actor: '系统',
        object: 'AP-202606-001',
        action: '生成应付',
        summary: '根据月度绩效确认生成应付 3,613.75 元'
      },
      {
        id: 'rp-op-007',
        time: '2026-06-10 11:30',
        actor: '李明',
        object: 'AP-202606-001',
        action: '关联流水',
        summary: '关联绩效预发流水 1,806.88 元'
      }
    ],
    owner: '李明',
    settledAmount: 1806.88,
    settlementStatus: '部分结清',
    sourceNo: 'PERF-202606-20260011',
    sourceTitle: '陈思 2026-06 月度绩效',
    sourceType: '月度绩效',
    updatedAt: '2026-06-10 11:30'
  },
  {
    accountingPeriod: '2026-06',
    amount: 12000,
    category: '工资发放',
    confirmDate: '2026-06-10',
    confirmationStatus: '已确认',
    counterparty: '赵倩',
    counterpartyType: '员工',
    direction: '应付',
    documentNo: 'AP-202606-002',
    dueDate: '2026-07-15',
    files: [
      {
        id: 'rp-file-005',
        name: '赵倩_2026-06工资发放表.pdf',
        status: '已上传',
        type: '薪酬确认',
        updatedAt: '2026-06-10'
      }
    ],
    id: 'ap-202606-002',
    linkedTransactionNos: ['FIN-202606-0003'],
    note: '工资已完成对公发放。',
    operationRecords: [
      {
        id: 'rp-op-008',
        time: '2026-06-10 09:10',
        actor: '系统',
        object: 'AP-202606-002',
        action: '生成应付',
        summary: '根据薪酬发放确认生成应付 12,000 元'
      },
      {
        id: 'rp-op-009',
        time: '2026-06-11 10:04',
        actor: '财务复核',
        object: 'AP-202606-002',
        action: '结清应付',
        summary: '关联工资发放流水后结清'
      }
    ],
    owner: '李明',
    settledAmount: 12000,
    settlementStatus: '已结清',
    sourceNo: 'PAY-202606-20260004',
    sourceTitle: '赵倩 2026-06 工资发放',
    sourceType: '薪酬发放',
    updatedAt: '2026-06-11 10:04'
  },
  {
    accountingPeriod: '2026-06',
    amount: 3200,
    category: '外协付款',
    confirmDate: '2026-06-11',
    confirmationStatus: '已确认',
    counterparty: '示例兼职 B',
    counterpartyType: '外协',
    direction: '应付',
    documentNo: 'AP-202606-003',
    dueDate: '2026-06-18',
    files: [
      {
        id: 'rp-file-006',
        name: '示例兼职B_外协结算单.pdf',
        status: '已上传',
        type: '结算单',
        updatedAt: '2026-06-11'
      }
    ],
    id: 'ap-202606-003',
    linkedTransactionNos: ['FIN-202606-0004'],
    note: '已登记付款流水，等待流水复核后更新结清状态。',
    operationRecords: [
      {
        id: 'rp-op-010',
        time: '2026-06-11 14:40',
        actor: '系统',
        object: 'AP-202606-003',
        action: '生成应付',
        summary: '根据外协结算生成应付 3,200 元'
      }
    ],
    owner: '李明',
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'OUT-202606-0008',
    sourceTitle: '示例兼职 B 外协结算',
    sourceType: '外协结算',
    updatedAt: '2026-06-11 14:40'
  },
  {
    accountingPeriod: '2026-06',
    amount: 486.5,
    category: '差旅交通',
    confirmDate: '2026-05-30',
    confirmationStatus: '已确认',
    counterparty: '刘宇',
    counterpartyType: '员工',
    direction: '应付',
    documentNo: 'AP-202605-018',
    dueDate: '2026-06-05',
    files: [
      {
        id: 'rp-file-007',
        name: '刘宇_差旅交通报销单.pdf',
        status: '已上传',
        type: '报销单',
        updatedAt: '2026-05-30'
      }
    ],
    id: 'ap-202605-018',
    linkedTransactionNos: [],
    note: '费用报销审核通过后生成应付，尚未登记付款流水。',
    operationRecords: [
      {
        id: 'rp-op-011',
        time: '2026-05-30 17:20',
        actor: '系统',
        object: 'AP-202605-018',
        action: '生成应付',
        summary: '根据员工报销确认生成应付 486.50 元'
      }
    ],
    owner: '李明',
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'EXP-202605-0012',
    sourceTitle: '刘宇 差旅交通报销',
    sourceType: '员工报销',
    updatedAt: '2026-05-30 17:20'
  },
] satisfies FinanceReceivablePayableRecordSeed[]).map((record) => {
  const seedRecord = record as FinanceReceivablePayableRecordSeed;
  const categorySnapshot = seedRecord.categorySnapshot ?? getFinanceCategorySnapshot(seedRecord.category);

  return {
    ...seedRecord,
    categorySnapshot,
    reportAggregation: seedRecord.reportAggregation ?? categorySnapshot.reportAggregation,
    taxBasis: seedRecord.taxBasis ?? getDefaultReceivablePayableTaxBasis(seedRecord)
  };
});
